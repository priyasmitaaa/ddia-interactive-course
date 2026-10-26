---
title: Lab — a partitioned key-value store
chapter: 6
topic: Hash partitioning, rebalancing, request routing, local secondary indexes, hot keys
minutes: 100
---

## Objective

Put all of Chapter 6 into one small system: hash partitioning with a fixed number of partitions,
rebalancing by moving whole partitions (Figure 6-6), a metadata service like ZooKeeper (Figure 6-8),
a routing tier that discovers its information is stale and refreshes it, document-partitioned
secondary indexes queried by scatter/gather (Figure 6-4), and key salting for a hot key.

## Setup

Python 3.10+. Files: `practice/23-partitioned-kv/partitioned.py` (TODOs 1–6) and
`test_partitioned.py`. Everything runs in one process; "nodes" are objects.

## Predict first

1. When a fourth node joins a 3-node cluster with 32 partitions, how many partitions move, and to where?
2. A router cached the assignment before rebalancing. What happens on its next request, and how should it recover?
3. How many nodes must a query for "red cars" contact with a local index? After adding a node?

## Your task

1. **TODO 1** `Node.put` with local index maintenance → part of T1, T4.
2. **TODO 2** `partition_of` → T1.
3. **TODO 3** `add_node` rebalancing → T2.
4. **TODO 4** `Router._call` with refresh-on-`WrongNode` → T1, T3.
5. **TODO 5** scatter/gather `query` → T4.
6. **TODO 6** `salted_keys` → T5.

## Run it

```
python practice/23-partitioned-kv/test_partitioned.py
```

## Observe

- Adding a node changes only the assignment of a few whole partitions; no key changes partition.
- The epoch in the metadata service lets anyone tell which version of the assignment they hold.
- A stale router fails once, refreshes, and succeeds — the "how do routers learn about changes" problem of pp. 205–206 solved the simple way.
- Secondary-index queries contact every node, and that number grows with the cluster (tail-latency amplification, Week 1).

## Questions

1. Your rebalancing copies a partition and then switches ownership. What could go wrong with writes that arrive *during* the copy, and how might a real system handle it?
2. What would a term-partitioned (global) index look like in this design? What would a write cost?
3. Why do many systems keep the partition assignment in a separate coordination service instead of in every node?
4. Your salted hot key spreads writes over 20 sub-keys. What do reads of that key now cost?

<details><summary>Discussion</summary>

1. Writes to the old owner after the copy started could be missing on the new owner after the switch (lost updates). Real systems either briefly block writes to the moving partition, or copy a snapshot and then stream the changes made since (snapshot + log, just like setting up a new follower in Chapter 5), switching ownership once caught up. The book notes the old assignment keeps serving while the transfer is in progress (p. 202).
2. Index entries partitioned by term (e.g. `color:red` on one node regardless of which partition the car is in): a query asks one node, but a write must update index partitions on possibly several other nodes — needing a distributed transaction, or asynchronous (temporarily stale) index updates (p. 200).
3. All participants must agree on who owns what; getting that right is a consensus problem (Chapter 9). A coordination service like ZooKeeper does it once, correctly, and notifies subscribers of changes (p. 206).
4. A read must fetch all 20 sub-keys (possibly 20 partitions) and combine them, plus you need bookkeeping of which keys are salted (p. 197).
</details>
