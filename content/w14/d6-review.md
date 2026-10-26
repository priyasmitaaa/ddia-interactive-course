---
title: Review — Linearizability
kind: review
minutes: 60
chapter: 9
objectives:
- Retrieve the definition of linearizability and its timing rules from memory
- Classify systems and operations by whether they are linearizable
- Catch up on Lab 31
reading:
- Re-read the Chapter 9 summary paragraph on linearizability | 363-363
complete:
- You did today's spaced review
- You drew a Figure 9-4-style history from memory and checked it in the visualization
- Lab 31 is done (or consciously skipped)
---

:::review Today's spaced review
Scheduled questions from Weeks 1–14.
:::

:::task Draw it from memory
1. Draw a timing diagram with a write of x = 1 lasting a while, and four reads: one before, one after, and two concurrent with it. Label each read's allowed values. Add the Figure 9-3 constraint and show a history that violates it.
2. Without notes, list where linearizability is **needed** (three cases), where it can be **avoided** (compensating transactions), and what it **costs** (availability during network faults, and latency always).
3. Check your diagram in the Linearizability visualization.
:::

:::quiz Week 14 checkpoint
### scenario
A team uses etcd for leader election and also reads configuration from it with plain `get` calls on any etcd member. A node occasionally reads an outdated leader address right after an election. Is etcd broken? What should they do?
>>>
No. By default etcd (like ZooKeeper) gives linearizable writes, but a read can be served by any member and may be stale (footnote iii, p. 320). For a read that must reflect the latest election, request a linearizable read: etcd's quorum read (or ZooKeeper's `sync()` before reading), which effectively orders the read through the consensus log (p. 341). Better still, use the election mechanism's own notifications or leases, and protect the resource with fencing tokens so a stale view can't do damage (Chapter 8).

### mcq
Which combination is called strict serializability?
- [ ] Snapshot isolation plus linearizability
- [x] Serializability plus linearizability
- [ ] Read committed plus causality
- [ ] Two-phase commit plus two-phase locking
>>>
Also called strong one-copy serializability (strong-1SR). 2PL and actual serial execution typically provide it (p. 320).

### mcq
Why might a database choose not to be linearizable even inside a single datacenter with a reliable network?
- [ ] Because of CAP
- [x] For performance: linearizable operations need response times at least proportional to network delay uncertainty
- [ ] Because linearizability is impossible
- [ ] Because it prevents write skew
>>>
Most systems that drop linearizability do it for performance, not fault tolerance (p. 329).

### explain
Explain why a strict quorum (w + r > n) isn't sufficient for linearizability, and what additional steps make reads and writes linearizable.
>>>
Quorum overlap only guarantees that a read *contacts* at least one replica that will eventually have the latest write. With variable network delays, a write can be in progress, having reached some replicas but not others. One reader can then see the new value on its overlapping node and finish, after which a second reader's quorum happens to include only replicas the write hasn't reached yet, and it returns the old value. A later read returning an older value isn't linearizable (Figure 9-6). Fixes: readers perform read repair *synchronously* before returning, so any value a reader has returned is on a quorum, and writers read the latest state from a quorum before writing. That gives linearizable reads and writes, but not compare-and-set, which needs consensus (p. 325).
:::
