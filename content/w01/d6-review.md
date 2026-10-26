---
title: Review — Chapter 1 Checkpoint
kind: review
minutes: 60
chapter: 1
objectives:
- Retrieve this week's ideas from memory without looking
- Apply reliability, scalability and maintainability reasoning to a new system
- Catch up on anything you skipped this week
reading:
- Re-read the Summary | 20-21
complete:
- You did today's spaced review
- You answered the checkpoint questions without looking at the book first
- Anything you skipped this week is done (or consciously skipped)
---

:::note How review days work
Day 6 is lighter. Use it in this order:

1. **Spaced review** (10–15 min): the questions the system picked for you below. Some are from this week, later on they'll be from many weeks back.
2. **Checkpoint** (20–30 min): new questions that mix this week's ideas. Answer from memory first, then check.
3. **Catch-up**: if you skipped an exercise this week, today is the day. If you're fully caught up, take the rest of the day off — rest is part of learning.
:::

:::review Today's spaced review
These come from the lessons you have completed. If it says nothing is due, that's normal early in the course — move on to the checkpoint.
:::

:::task One-page summary from memory
Close the book. On a single sheet of paper (or a text file), write the three concerns of Chapter 1 as headings and, under each, everything you remember: definitions, examples, numbers, techniques. Give yourself 10 minutes. Then open the Summary (pp. 20–21) and the week's lessons and fill in what you missed **in a different colour**. The things in the second colour are exactly what you should look at again.
:::

:::quiz Chapter 1 checkpoint
### scenario
You're designing a photo backup service. List one fault from each of the three categories (hardware, software, human) that could hit it, and for each say how you'd stop it from becoming a failure.
>>>
**Hardware:** a disk storing photos dies → keep each photo on several disks/machines (replication), and re-replicate quickly when one is lost. **Software:** a bug in a new release corrupts uploaded files on every server → roll out gradually to a small subset first, verify checksums of stored files continuously, keep the ability to roll back quickly, and keep backups/immutable copies so data can be recovered. **Human:** an operator deletes the wrong storage bucket → restrict dangerous admin actions behind confirmation or delayed deletion, provide sandbox environments, keep backups and fast recovery tools, and monitor deletion rates.

### mcq
Which statement about tail latency is correct?
- [ ] If the median is good, the p99 must also be good
- [ ] Averaging p99 values from several servers gives the overall p99
- [x] When one request fans out to many backends, the share of slow user requests grows quickly with the number of backend calls
- [ ] Load tests that wait for each response are the most accurate
>>>
Tail latency amplification: the user request waits for the slowest backend, so even rare slow calls hit many users when fan-out is large. The other three are traps from Day 4: the median says nothing about the tail; percentiles can't be averaged (add histograms); closed-loop load tests hide queueing.

### tradeoff
A news site's front page is read 50,000 times per second and changes every few minutes. Should it build the page per request (query on read) or precompute it when news is published (work on write)?
- [ ] Query on read, because it is always simpler
- [x] Precompute on write: writes are rare and reads are extremely frequent, the same trade-off that led Twitter to fan-out on write
- [ ] It makes no difference
- [ ] Neither; the site must scale up instead
>>>
With a read/write ratio this lopsided, doing the work once per publication and serving a cached result is far cheaper overall. It is the same reasoning as Twitter's approach 2 — the load parameters decide.

### explain
Explain the difference between *latency* and *response time*, and give one example of something that adds to response time but not to service time.
>>>
Response time is the whole time the client waits, from sending the request to receiving the answer. Service time is the time actually spent processing the request. Latency, strictly, is the time the request spends waiting to be handled. Response time = service time + network delay + queueing delay. Example: a request waiting in the server's queue behind a slow request (head-of-line blocking), or a TCP retransmission after a lost packet — both add to response time without the server doing more work on that request.

### mcq
Which of the following is the best description of **evolvability**?
- [ ] The system automatically adds machines when load increases
- [ ] The system's code has no bugs
- [x] The ease with which the data system can be adapted to changing requirements, closely linked to its simplicity and abstractions
- [ ] The system can tolerate machine failures without downtime
>>>
Evolvability is the book's name for agility at the level of a whole data system (p. 20). Automatically adding machines is *elasticity*; tolerating machine failure is *reliability/operability*.

### design
In one paragraph, describe the load parameters you would track for a ride-hailing app (riders request rides, drivers send their location every few seconds), and which one you think will drive the architecture.
>>>
Plausible parameters: number of active drivers and the **rate of location updates** (e.g. 500k drivers × one update every 4 s ≈ 125k writes/s), **ride requests per second** at peak (e.g. Friday night), the **read pattern** for matching (a rider's request reads nearby drivers — a geographic query), and the **geographic skew** (a stadium emptying creates a hot spot). The location-update write rate combined with geographically skewed nearby-driver reads probably drives the architecture: it is high-volume, latency-sensitive and unevenly distributed — like Twitter's celebrities, the average hides the hot spots.
:::
