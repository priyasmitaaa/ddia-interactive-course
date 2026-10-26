---
title: Review — Networks, Clocks and Pauses
kind: review
minutes: 60
chapter: 8
objectives:
- Retrieve this week's three sources of uncertainty from memory
- Apply the right clock to each timing task
- Catch up on Exercises 28 and 29
reading:
- Re-read the first half of the Chapter 8 summary | 302-302
complete:
- You did today's spaced review
- You filled in the "what can't a node trust?" table from memory
- Exercises 28 and 29 are done (or consciously skipped)
---

:::review Today's spaced review
Scheduled questions from Weeks 1–12.
:::

:::task What can't a node trust? (from memory)
Make a three-row table: **network, clock, own execution**. For each row write: what goes wrong (at least three concrete causes); how it shows up to the software (e.g. "no response", "timestamp too low", "nothing; the code didn't notice"); and one mitigation from this week. Then check against the summary on p. 302 and this week's lessons.

Then classify each task as **monotonic clock**, **time-of-day clock** or **neither: use a logical clock**: request timeout; log timestamps; "send reminder at 9:00"; ordering writes from two replicas; p99 latency; cache TTL on one machine; deciding which of two concurrent writes wins.
:::

:::quiz Week 12 checkpoint
### scenario
A health checker pings each database node every second with a 50 ms timeout and triggers a failover after 3 missed pings. During the nightly batch job, failovers happen several times, though no node crashes. Explain the mechanism and what you would change.
>>>
The batch job saturates shared network links and CPUs, so queueing in switches and OS queues, plus possible VM steal time and GC pauses, pushes round-trip times beyond 50 ms (pp. 274–275). Healthy nodes are falsely declared dead, and each failover adds load (catch-up and redirected traffic), which can cascade (p. 273). Changes: choose the timeout from the measured RTT distribution, including busy periods, or use an adaptive detector such as Phi Accrual (p. 276). Isolate or rate-limit the batch traffic. Accept slower detection of real failures as the price.

### mcq
Which statement about time-of-day clocks is correct?
- [ ] They are guaranteed to move forward
- [x] They can be forcibly reset by NTP and jump backwards, so they're unsuitable for measuring elapsed time
- [ ] Their absolute value is meaningless
- [ ] They can't be synchronized between machines
>>>
That describes time-of-day clocks. Monotonic clocks are the ones that always move forward and have a meaningless absolute value (pp. 279–280).

### mcq
Which statement best describes Spanner's approach to transaction timestamps?
- [ ] It uses a single global counter on one server
- [ ] It uses unsynchronized local clocks and LWW
- [x] It uses TrueTime confidence intervals and waits out the interval before committing, so causally later transactions get later timestamps
- [ ] It avoids timestamps entirely with version vectors
>>>
Non-overlapping intervals give a definite order. GPS receivers and atomic clocks keep the wait to about 7 ms (pp. 285–286).

### explain
In one paragraph: why does the book say a node in a distributed system "must assume that its execution can be paused for a significant length of time at any point"? Give two causes and one consequence.
>>>
Many things can preempt a thread at an arbitrary point and resume it later without it noticing. Stop-the-world GC pauses sometimes last minutes, and VMs can be suspended or live-migrated. Other causes: context switches and steal time under load, synchronous disk I/O (even lazy class loading, or network block devices), paging and thrashing, laptop suspension, and SIGSTOP (pp. 288–289). Meanwhile the rest of the system keeps going: other nodes may time out, declare the paused node dead, and hand its lease or leadership to someone else. When the node resumes, it continues as if nothing had happened, so it can act on stale beliefs ("I'm still leader") and, for example, write data it is no longer allowed to write (pp. 287, 289).
:::
