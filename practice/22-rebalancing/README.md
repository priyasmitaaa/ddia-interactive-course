---
title: Rebalancing — how much data moves?
chapter: 6
topic: hash mod N, fixed partitions, hash rings with virtual nodes
minutes: 40
---

## Objective

Quantify the book's rebalancing argument (pp. 201–204): grow a cluster from 10 to 11 nodes and
measure what fraction of 100,000 keys must move, and how evenly load is spread afterwards, for
hash mod N, a fixed number of partitions, and a hash ring with 1, 8 or 64 tokens per node.

## Setup

Python 3.10+. Open `practice/22-rebalancing/rebalance.py`. `mod_n_owner` is given; you write the
fixed-partition `add_node` and the hash ring.

## Predict first

1. Going from 10 to 11 nodes, what's the minimum fraction of keys that must move? What will hash mod N move?
2. With one random token per node, will the load be even?
3. Why does using more tokens per node help?

## Your task

1. `add_node(assignment)` — the new node steals partitions from the busiest nodes until balanced. Only partitions moving to the new node change owner.
2. `build_ring(n_nodes, v)` and `ring_owner(key, ring)`.

## Run it

```
python practice/22-rebalancing/rebalance.py
```

## Observe

- hash mod N moves ~90% of keys: almost every key's `hash mod N` changes when N changes.
- Fixed partitions move ~9% (the minimum, 1/11) and stay balanced — but the number of partitions (256) caps the cluster size.
- A ring with one token per node moves very little, but load is badly uneven (a few nodes own huge arcs) — the reason Cassandra replaced it in version 1.2. More tokens per node fix the imbalance.

## Questions

1. Why does the fixed-partition scheme never change which partition a key belongs to? What does change?
2. How should you choose the number of fixed partitions?
3. Why would key-range-partitioned databases (HBase, RethinkDB) use dynamic splitting instead of a fixed number of partitions?
4. Many tokens per node is essentially "many small partitions per node". Explain the connection.

<details><summary>Discussion</summary>

1. partition = hash(key) mod P, and P never changes; only the assignment of partitions to nodes changes (p. 202), so whole partitions are copied to the new node.
2. High enough for the largest cluster you might ever need (it's the maximum number of nodes), but not so high that per-partition management overhead dominates (p. 202).
3. With key ranges, fixed boundaries chosen in advance could put most of the data in a few partitions; dynamic splitting adapts boundaries to the data, splitting a partition when it exceeds a size (10 GB default in HBase) (p. 203).
4. Each token defines a small hash range owned by the node; with many tokens, each node owns many small ranges spread around the ring, so a new node takes a little from everyone — like stealing a few fixed partitions from every node.
</details>
