---
title: Describing Performance — Percentiles and Tail Latency
kind: lesson
minutes: 95
chapter: 1
objectives:
- Distinguish throughput, response time, latency and service time
- Explain why the mean is a poor summary of response time, and read p50/p95/p99/p999
- Explain head-of-line blocking and why load testers must send requests independently of responses
- Explain tail latency amplification and why percentiles must be aggregated with histograms
reading:
- Describing performance | 11-14
- Percentiles in Practice (sidebar) and Figure 1-5 | 14-15
complete:
- You can explain what "p99 = 1 second" means to a non-engineer
- You completed at least Tasks 1 and 3 of the percentiles exercise
- You answered the quiz
---

:::problem "The average response time is 200 ms" — so what?
Your dashboard says the average page load is 200 ms. Everyone's happy. But a large customer complains that the site is "always slow" for them. Who is right?

Both can be. Response times aren't one number; they're a **distribution**. Most requests may be fast while a few are terribly slow, and the people hitting the slow ones might be your most valuable customers. To reason about performance as load grows, we need better ways to describe it.
:::

:::intuition A distribution, not a number
First, vocabulary (pp. 11–12):

- **Throughput**: how many records/requests you process per second, or how long a whole job takes. Batch systems (like Hadoop) care most about this.
- **Response time**: what the *client* sees — from sending a request to getting the answer. Online systems care most about this.
- **Service time**: the time actually spent processing the request.
- **Latency**: strictly, the time a request spends *waiting* to be handled (latent). Response time = service time + network delays + queueing delays.

Send the same request again and again and you'll get a different response time each time: a context switch, a lost packet and TCP retransmission, a garbage-collection pause, a page fault that reads from disk, even mechanical vibrations in the server rack.

So describe the distribution with **percentiles**. Sort all response times from fastest to slowest:

- The **median (p50)** is the halfway point: half of requests are faster, half slower. It tells you what a *typical* user experiences.
- **p95, p99, p999** are the thresholds that 95%, 99%, 99.9% of requests beat. "p99 = 1.5 s" means 1 in 100 requests takes 1.5 s or longer.

The **mean** is a poor "typical" value: one 10-second request among 99 fast ones drags the mean up, yet describes nobody's experience.
:::

:::visual PercentileSim | See the tail
**Try this:**
1. Set "Slow outliers" to 0%: mean ≈ median, and p99 is close to them.
2. Raise it to 5%, then 15%. The median barely moves. The mean rises. p95 and p99 leap.
3. Switch to **Sorted** — this is how percentiles are computed.
4. In the second panel, increase the number of backend calls per page and watch how quickly "1% slow calls" becomes "most pages are slow".
:::

:::details Why the tail matters, and how to measure it
**High percentiles ("tail latencies") affect users directly** (p. 13). Amazon specifies internal response times at p99.9, even though it affects 1 in 1,000 requests, because the slowest requests often belong to customers with the most data — i.e. who have bought the most. Amazon also observed that 100 ms more response time cut sales by 1%. But it judged optimising p99.99 too expensive: very high percentiles are dominated by random events beyond your control, with diminishing benefit.

**Percentiles appear in SLOs and SLAs** — service level objectives/agreements. Example: "the service is up if median response time < 200 ms and p99 < 1 s, and it must be up 99.9% of the time."

**Queueing causes much of the tail** (pp. 13–14). A server can only process a few things in parallel (limited by CPU cores). A few slow requests hold up everything queued behind them — **head-of-line blocking**. The later requests may be quick to process, but the client sees a slow response because of the waiting. So measure response time **on the client side**.

**Load testing pitfall.** If a load-generating client waits for each response before sending the next request, queues stay artificially short and the test looks much better than reality. The generator must keep sending requests *independently of response times*. (This is the closed-loop vs open-loop difference you'll measure in the exercise.)

**Tail latency amplification** (sidebar, p. 14; Figure 1-5). When one user request needs several backend calls in parallel, it must wait for the *slowest*. If each call has a 1% chance of being slow, a request that needs 100 calls is slow with probability 1 − 0.99¹⁰⁰ ≈ 63%. Even a small percentage of slow backend calls makes a large proportion of user requests slow.

**Computing percentiles for dashboards.** Keep a rolling window (e.g. the last 10 minutes) and recompute every minute. Sorting the whole list works but is slow; approximation algorithms like **forward decay**, **t-digest** and **HdrHistogram** do it cheaply. And a trap: **averaging percentiles** (across time or machines) is mathematically meaningless — you must **add the histograms** and compute the percentile from the sum.
:::

:::practice 03-percentiles | Produce the numbers yourself
Three tasks: implement percentiles and compare a naive (closed-loop) load test with realistic (open-loop) traffic; aggregate two servers correctly; and simulate tail latency amplification. Task 2 is optional if you're short on time today.
:::

:::quiz
### mcq
Response times for 10 requests (ms): 20, 22, 21, 25, 23, 24, 22, 21, 23, 900. Which statement is true?
- [ ] The mean (~100 ms) is a good description of a typical request
- [x] The median (~22.5 ms) describes a typical request; the mean is pulled up by one outlier
- [ ] The median is 900 ms
- [ ] The p50 and the mean are always equal
>>>
Mean = 1101/10 ≈ 110 ms, which no request actually experienced. The median is the average of the 5th and 6th sorted values (22 and 23) = 22.5 ms. The single 900 ms request is the tail — what p90 or p99 would capture.

### mcq
Your SLA says "p99 < 300 ms". This means:
- [ ] The average response time is under 300 ms
- [ ] No request may ever take more than 300 ms
- [x] At least 99% of requests must complete in under 300 ms
- [ ] 1% of requests must take exactly 300 ms
>>>
The 99th percentile is the threshold that 99% of requests beat. Up to 1% may be slower — which is why some SLAs also specify p99.9.

### predict
Your load tester sends a request, waits for the reply, then sends the next. The server has occasional 300 ms GC pauses. Compared with real traffic at the same throughput, the tester's measured p99 will be:
- [x] Much better (lower) than reality, because no queue ever builds up behind a pause
- [ ] About the same as reality
- [ ] Much worse than reality
- [ ] Impossible to measure
>>>
A closed-loop tester stalls whenever the server stalls, so no requests pile up behind the pause. Real users keep arriving and queue up — head-of-line blocking — so real tail latencies are far worse. In the exercise, the closed loop reported p99 ≈ 14 ms; the open loop at 50% utilisation reported ≈ 450 ms.

### mcq
Server A reports p99 = 800 ms, server B reports p99 = 200 ms, each handling half the traffic. What is the p99 across both servers?
- [ ] Exactly 500 ms, the average
- [ ] Exactly 800 ms, the maximum
- [x] It cannot be computed from these two numbers; you need the underlying distributions (e.g. the histograms) added together
- [ ] Exactly 200 ms, the minimum
>>>
The combined p99 depends on how the values of both servers are spread, which two summary numbers don't capture. The book: averaging percentiles is meaningless; add the histograms instead (p. 14).

### scenario
A product page calls 40 microservices in parallel and waits for all of them. Each service is "fast": its p99 is 50 ms, its median 5 ms. Users complain the page is often slow. Explain what is going on and suggest two remedies.
>>>
Tail latency amplification: the page is as slow as its *slowest* call. With 40 calls, the chance that at least one exceeds its p99 is 1 − 0.99⁴⁰ ≈ 33%, so roughly a third of page loads wait for a tail-latency call, even though each service looks fast on its own dashboard. Remedies: reduce the number of calls on the critical path (combine services, cache, precompute); reduce each service's tail (lower utilisation, fewer GC pauses); send hedged/backup requests when a call is slow; time out non-essential calls and render the page with partial results.

### explain
In your own words: what is head-of-line blocking, and why does it mean you should measure response times on the client side?
>>>
A server processes only a few requests at a time; the rest wait in a queue. If a slow request is at the front, every request behind it waits too, even if each would be fast to process. The server's own measurement of *service time* for those later requests looks fine, but clients experience the waiting time as well. Measuring at the client captures the full response time, including queueing.
:::

:::connect Where this goes next
Percentiles are the language of performance for the rest of the book. In Chapter 3 you'll see why some storage engines have worse tails (compaction interfering with requests). In Chapter 8, "timeouts and unbounded delays" are this same queueing story across a network. And in your Week 6 project you'll benchmark your own storage engine and report p50 and p99, not averages. Tomorrow: what to do when load grows, and the third goal — maintainability.
:::
