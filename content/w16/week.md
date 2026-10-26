---
title: Consistency and Consensus III — Atomic Commit and Consensus
part: Part II · Distributed Data
chapters:
- 9
---
Finally, consensus: getting nodes to agree, irrevocably. The week starts with atomic commit and two-phase commit: its system of promises, why it blocks when the coordinator fails, and why XA transactions have a mixed reputation. Then come fault-tolerant consensus algorithms (Paxos, Raft, Zab, Viewstamped Replication), built on epochs and quorums, and ZooKeeper, the service that lets applications outsource consensus.
