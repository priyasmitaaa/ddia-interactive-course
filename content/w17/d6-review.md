---
title: Review — Part II Wrap-Up
kind: review
minutes: 60
chapter: 9
objectives:
- Consolidate exam mistakes into targeted re-reading
- Retrieve the "map" of Part II from memory
- Prepare for Part III
reading:
- Re-read the Chapter 9 summary's closing paragraphs | 365-365
complete:
- You did today's spaced review, including the exam questions you missed
- You drew the Part II map from memory
- You planned re-reading for your two weakest topics
---

:::review Today's spaced review
Scheduled questions from Weeks 1–17. Your Part II exam mistakes are in here.
:::

:::task The Part II map, from memory
On one page, draw five boxes: **Replication, Partitioning, Transactions, Faults, Consensus**. For each, write its central problem in one line, its main techniques, and its main trade-off. Then draw arrows for every dependency you can think of. For example: Replication → Faults ("failover needs failure detection"), Faults → Consensus ("timeouts + majority"), Consensus → Replication ("leader election without split brain"), Transactions → Consensus ("atomic commit"), Partitioning → Transactions ("cross-partition transactions need 2PC"). Compare with the closing paragraph of p. 365.
:::

:::quiz Part II wrap-up
### mcq
The book ends Part II by saying not every system needs consensus. Which systems typically do without global consensus?
- [ ] Single-leader databases with automatic failover
- [x] Leaderless and multi-leader replication systems, which accept conflicts and branching histories instead
- [ ] ZooKeeper
- [ ] Systems with uniqueness constraints
>>>
"Maybe we simply need to cope without linearizability, and learn to work better with data that has branching and merging version histories" (p. 365).

### mcq
Which Part II idea is the common thread behind fencing tokens, Raft terms and Paxos ballot numbers?
- [ ] Synchronized clocks
- [x] Monotonically increasing epoch or sequence numbers, so that newer authority overrides older, stale authority
- [ ] Version vectors
- [ ] Two-phase locking
>>>
Chapter 8 (p. 294) and Chapter 9 (p. 358).

### explain
In one paragraph, explain to a new teammate why "just add a timeout and failover" is not a complete high-availability design.
>>>
A timeout can't tell a dead node from a slow or paused one, or from a network problem (Chapter 8), so failover will sometimes promote a new leader while the old one is still alive and accepting writes. Without consensus on who the leader is, and epochs or fencing to stop the old one, that's split brain and data loss (pp. 343, 358). Asynchronous replication can also lose acknowledged writes on failover (Chapter 5), and premature failovers under load can cascade (p. 273). A complete design uses a proven consensus mechanism (or a coordination service) to elect leaders, fences stale leaders, chooses replication durability deliberately, and tunes timeouts from measured delays.
:::
