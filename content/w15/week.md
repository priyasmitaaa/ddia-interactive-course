---
title: Consistency and Consensus II — Ordering, Causality and Total Order Broadcast
part: Part II · Distributed Data
chapters:
- 9
---
Ordering has been a recurring theme in this book: replication logs, serializability, timestamps. This week digs into why. Causality gives a partial order of events, and linearizability gives a total one. Lamport timestamps order events consistently with causality, but they aren't enough to enforce uniqueness. Total order broadcast is, and it turns out to be equivalent to linearizable compare-and-set and to consensus.
