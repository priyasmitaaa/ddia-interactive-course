---
title: Review — Single-Leader Replication
kind: review
minutes: 60
chapter: 5
objectives:
- Retrieve this week's ideas from memory
- Apply replication-lag reasoning to new product features
- Finish the leader-follower lab if needed
reading:
- Re-read the first half of the Chapter 5 Summary | 186-187
complete:
- You did today's spaced review
- You answered the checkpoint from memory
- The lab tests pass
---

:::review Today's spaced review
Scheduled questions from Weeks 1–7.
:::

:::task Explain failover to a product manager
Write five sentences, no jargon, explaining to a product manager why "the database automatically fails over in 30 seconds" does not mean "we never lose data and never go down". Use at least two of: lost writes, reused IDs, split brain, unnecessary failovers.
:::

:::quiz Single-leader checkpoint
### scenario
A ride-sharing app writes a trip's status ("driver arrived") to the leader and the rider's app polls the trip from random followers every 2 seconds. Riders report the status flickering between "arrived" and "on the way". Diagnose and fix.
>>>
Monotonic reads are violated: successive polls hit different followers with different lag, so a fresh follower shows "arrived" and a staler one shows "on the way" — time goes backwards. Fix: route each rider's reads to the same follower (e.g. hash of the user or trip ID), or include the last seen log position and only accept responses from replicas at least that fresh. For the rider's own actions (e.g. "I cancelled"), read-your-writes also applies (read from the leader or a sufficiently caught-up replica).

### mcq
Which replication-log method most easily allows the leader and followers to run different database versions?
- [ ] Statement-based
- [ ] WAL shipping
- [x] Logical (row-based) log
- [ ] Copying data files nightly
>>>
Decoupled from storage internals, logical logs can be kept backward compatible (p. 154).

### tradeoff
A payments service uses one synchronous follower and three asynchronous ones. The synchronous follower's disk becomes very slow. What happens, and what should the system do?
- [ ] Nothing, writes are unaffected
- [x] Write latency rises (every write waits for the slow follower); the system should make one of the asynchronous followers synchronous instead
- [ ] All followers become asynchronous permanently
- [ ] The leader fails over
>>>
Semi-synchronous setups switch the synchronous role to another follower when the current one is unavailable or slow (p. 148).

### mcq
Which statement about eventual consistency is correct?
- [ ] It guarantees replicas are at most one second behind
- [x] It only promises that if writes stop, replicas eventually converge; there's no bound on how far behind they can be
- [ ] It's only a property of NoSQL databases
- [ ] It prevents users from seeing stale data
>>>
And asynchronously replicated relational databases are eventually consistent too (p. 155 footnote).

### explain
Explain why a snapshot alone is not enough to set up a new follower, and what is needed in addition.
>>>
The leader keeps accepting writes while the snapshot is copied and loaded, so the snapshot becomes outdated immediately. The follower also needs every change made after the snapshot. That's only possible if the snapshot is associated with an exact position in the leader's replication log; the follower then requests all changes from that position and applies them until it has caught up (pp. 149–150).
:::
