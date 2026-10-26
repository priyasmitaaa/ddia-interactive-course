---
title: Reliability — Faults Are Not Failures
kind: lesson
minutes: 85
chapter: 1
objectives:
- Define reliability precisely, and distinguish a fault from a failure
- Explain why hardware faults are usually random and independent, while software faults are correlated
- List concrete techniques for limiting human error
- Explain why deliberately injecting faults can make a system more reliable
reading:
- Reliability, hardware faults, software errors, human errors | 4-8
complete:
- You can explain "fault vs failure" with your own example
- You ran the fault-injection exercise and saw retries create duplicate payments
- You answered the quiz
---

:::problem Things break all the time — and that's normal
Suppose your service runs on 10,000 disks. A single disk lasts, on average, 10 to 50 years before it dies. That sounds very reliable. But with 10,000 of them, you should expect about **one dead disk every day** (p. 5). At scale, "rare" hardware problems become routine.

Add software bugs, network glitches, and humans making configuration mistakes, and something is *always* going wrong somewhere. If every one of those problems made the whole service go down, you could never keep it running. So the real question is not "how do we stop things from breaking?" but **"how do we keep working correctly while things break?"**
:::

:::intuition Fault vs failure
The book draws a sharp line between two words that people use loosely (p. 5):

- A **fault** is when *one component* deviates from its spec: a disk dies, a process crashes, a message gets lost.
- A **failure** is when the *system as a whole* stops providing the required service to the user.

A burst tyre is a fault. Crashing the car is a failure. A spare tyre (redundancy) and a driver who knows how to stop safely (good error handling) keep the fault from becoming a failure.

You can never reduce the probability of faults to zero, so the goal is to design **fault-tolerant** (or **resilient**) systems: mechanisms that stop faults from turning into failures. Notice the word "certain": no system tolerates *every* fault. If the whole planet is swallowed by a black hole, your hosting plan fails, and that's fine. We decide which faults to tolerate.

What does "working correctly" mean? Roughly (p. 4): the application does what the user expected, tolerates users making mistakes, performs well enough for the load, and prevents unauthorised access. Reliability means *continuing to work correctly, even when things go wrong*.
:::

:::visual MttfCalc | How often do disks die?
Play with the size of a cluster and the mean time to failure (MTTF) of each disk.

**Try this:** set 10,000 disks at MTTF ≈ 27 years and look at the expected deaths per day. Then drop to 100 disks: failures become rare events — which is exactly why small systems can get away without much redundancy. Then switch to **mirrored pairs** and see how rarely a pair loses its data, as long as rebuilds are fast. Increase the rebuild time to a week and watch the risk grow.
:::

:::details Three sources of faults
**1. Hardware faults** (pp. 5–6). Disks crash, RAM goes bad, power fails, someone unplugs the wrong cable. The first response is *redundancy of components*: RAID disks, dual power supplies, hot-swappable CPUs, batteries and diesel generators. This keeps a single machine running for years.

But two things changed. More applications run on *many* machines, so hardware faults become frequent. And cloud platforms such as AWS are designed for flexibility over single-machine reliability: virtual machines can disappear without warning. So systems increasingly tolerate the loss of **entire machines** using *software* fault tolerance. A bonus: such a system can be patched one machine at a time (a "rolling upgrade") with no downtime.

Hardware faults are mostly **random and independent**: one disk dying doesn't make another one die (apart from weak correlations, like a hot server rack).

**2. Software errors** (pp. 6–7). These are **systematic** faults — and they are *correlated*: the same bug is present on every machine. Examples from the book:

- A bad input that crashes every instance of a server. The leap second of 30 June 2012 made many applications hang at once because of a Linux kernel bug.
- A runaway process that eats a shared resource (CPU, memory, disk, network).
- A service you depend on slows down, stops responding, or returns corrupted data.
- **Cascading failures**: a small fault in one component triggers faults in others.

Such bugs lie dormant until an unusual situation reveals that the software made an assumption about its environment that is usually — but not always — true. There's no single fix. What helps: thinking carefully about assumptions, thorough testing, process isolation, letting processes crash and restart, and monitoring. A system can also **check its own guarantees** while running — e.g. a message queue verifying that messages in equal messages out — and raise an alert on a discrepancy.

**3. Human errors** (pp. 7–8). One study found that operator *configuration errors* were the leading cause of outages, while hardware played a role in only 10–25% of them. The best systems combine:

- **Designs that minimise opportunities for error** — good APIs and admin tools make the right thing easy (but if they're too restrictive, people work around them).
- **Decoupling** where people make mistakes from where mistakes cause failures — full-featured sandbox environments with real data.
- **Testing at all levels**, from unit tests to whole-system integration tests.
- **Quick, easy recovery** — fast rollback of config changes, gradual rollouts, tools to recompute data.
- **Detailed monitoring** (telemetry) — performance metrics and error rates.
- Good management and training.

### Breaking things on purpose

Counter-intuitively, it can make sense to *increase* the rate of faults (p. 5). Many critical bugs are in poor error handling — code paths that almost never run. By killing processes at random (Netflix's **Chaos Monkey**), you keep the fault-tolerance machinery exercised, and you find the bugs before a real fault does. Today's exercise does exactly this.

One exception to "tolerate rather than prevent": **security**. If an attacker steals data, it cannot be undone, so prevention matters more there.

### How important is reliability?

It's not only for nuclear plants and air traffic control (p. 8). Bugs in business apps cost money and create legal risk; outages of shops lose revenue and reputation. Think of a parent whose only copies of their children's photos are in your app. Sometimes you consciously trade reliability for lower cost — a prototype for an unproven market — but you should know when you are cutting corners.
:::

:::practice 01-fault-injection | Break it on purpose
You'll inject three kinds of network faults between a client and a "bank" server, and discover that the obvious fix — retrying — can silently create money. Take about 40 minutes. Do the "Predict first" step honestly; being surprised is the point.
:::

:::quiz
### mcq
A database server's power supply fails, but a redundant supply takes over and users notice nothing. In the book's terms, this was:
- [x] A fault, but not a failure
- [ ] A failure, but not a fault
- [ ] Both a fault and a failure
- [ ] Neither
>>>
A component deviated from its spec (fault), but the system as a whole kept providing its service, so there was no failure. Fault tolerance is exactly the art of keeping faults from becoming failures.

### mcq
Why do software bugs tend to cause **more** system failures than hardware faults?
- [ ] Software is less tested than hardware
- [x] The same bug exists on every node, so faults are correlated and can hit many machines at once
- [ ] Hardware never fails in modern datacenters
- [ ] Software faults cannot be detected by monitoring
>>>
Hardware faults are mostly random and independent, so redundancy handles them well: it's unlikely that both copies fail at once. A software bug is *systematic*: give every server the same bad input (or the same leap second) and they all fail together — redundancy doesn't help when every replica has the same flaw.

### predict
In the exercise, the client retries any call that times out, up to 5 times, with no request id. Over thousands of payments, what happens?
- [ ] Bob receives exactly the right amount, because retries fix lost messages
- [ ] Bob receives too little, because some payments are never retried
- [x] Bob receives too much, because some "timed-out" payments had actually been applied and were applied again
- [ ] The program crashes
>>>
A timeout means "I don't know", not "it didn't happen". When the *response* was lost, the transfer had already been applied, so a retry applies it twice. The fix is to make the operation **idempotent** (same request id → applied at most once). You'll meet idempotence again in Chapters 8, 9 and 11.

### mcq
Which of these is **not** one of the book's recommended approaches to reducing human error?
- [ ] Sandbox environments where people can experiment with real data without affecting users
- [ ] Making it fast to roll back configuration changes
- [x] Restricting admin interfaces as tightly as possible so operators can't do anything unusual
- [ ] Detailed monitoring of performance metrics and error rates
>>>
The book warns that interfaces that are *too* restrictive make people work around them, which negates their benefit (p. 7). The aim is to make the right thing easy and the wrong thing hard — a balance, not maximum restriction.

### explain
Why might a team deliberately kill random production processes (like Netflix's Chaos Monkey)? Isn't that making things less reliable?
>>>
Fault-handling code only runs when faults happen. If faults are rare, that code is rarely exercised and its bugs stay hidden — and many critical bugs are in error handling. By inducing faults deliberately and regularly, the team continuously tests that the system really tolerates them, and finds bugs at a time of their choosing rather than during a real incident. The short-term increase in faults buys a long-term decrease in failures.

### scenario
Your service runs on 3 identical servers behind a load balancer. On the day a leap second is inserted, all three hang at the same moment. Why didn't having three servers help, and what *would* have helped?
>>>
Redundancy protects against **independent** faults. A software bug triggered by a shared condition (the leap second) is a correlated, systematic fault: all three servers run the same code and see the same clock, so they fail together. Things that help: testing for unusual conditions (leap seconds, clock jumps), staged rollouts and diversity so not everything is exposed at once, monitoring and alerting that catch hangs quickly, and the ability to restart or roll back fast. Some systems also deliberately "smear" leap seconds to avoid the edge case.
:::

:::connect Where this goes next
Today's big idea — *build reliable systems from unreliable parts* — runs through the entire book. Chapter 5 (replication) keeps data available when whole machines die. Chapter 7 (transactions) makes a crash halfway through a multi-step change harmless. Chapter 8 examines faults in networks and clocks in depth, and the "timeout means I don't know" lesson from the exercise is its core. Tomorrow we switch to the second goal: scalability, and how to describe load with numbers.
:::
