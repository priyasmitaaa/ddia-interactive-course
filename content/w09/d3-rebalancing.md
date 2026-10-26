---
title: Rebalancing Partitions
kind: lesson
minutes: 95
chapter: 6
objectives:
- State the three requirements for rebalancing
- Explain why hash mod N is a bad partitioning strategy
- Explain the fixed-number-of-partitions approach and its limits
- Explain dynamic partitioning (splitting and merging) and pre-splitting
- Explain the risks of fully automatic rebalancing
reading:
- Rebalancing partitions; strategies for rebalancing | 201-204
- Operations — automatic or manual rebalancing | 204-205
complete:
- You measured key movement for all strategies in the rebalancing exercise
- You can explain why Cassandra abandoned one-range-per-node
- You answered the quiz
---

:::problem The cluster never stays the same
Things change (p. 201): query throughput grows (add CPUs), data grows (add disks and RAM), a machine fails (others take over). All of these mean moving data between nodes — **rebalancing**. Minimum requirements:

1. Afterwards, load (storage, reads, writes) is **shared fairly**.
2. During rebalancing, the database keeps accepting **reads and writes**.
3. **Don't move more data than necessary** — network and disks are limited.
:::

:::intuition Move partitions, not keys
**How not to do it: hash mod N.** Why divide hashes into ranges instead of `hash(key) % number_of_nodes`? Because when N changes, *most* keys move. Example from the book: hash 123456 → node 6 of 10 (123456 mod 10), node 3 of 11, node 0 of 12. Adding one node reshuffles almost everything.

**Fixed number of partitions.** Create **many more partitions than nodes** — e.g. 1,000 partitions on 10 nodes, ~100 each. A new node **steals a few partitions from every existing node** (Figure 6-6); removing a node does the reverse. Only **whole partitions** move. The number of partitions and the key→partition mapping never change — only the partition→node assignment. While a transfer is in progress, the old assignment serves reads and writes. You can even give more partitions to more powerful nodes. Used by Riak, Cassandra (since 1.2), Elasticsearch, Couchbase, Voldemort.

Think of a moving company that packs your belongings into numbered boxes once; moving house means moving boxes, never repacking.
:::

:::visual RebalanceSim | Grow the cluster
**Try this:** go from 4 to 5 nodes with each strategy and compare "keys that must move" with the minimum (1/5 = 20%), and the load bar of the busiest node. In "fixed partitions", the red chips are the partitions that moved. Then compare 8 → 9 nodes.
:::

:::details Fixed vs dynamic, and who decides (pp. 202–205)
**Choosing the number of fixed partitions.** It's usually set when the database is created and never changed (splitting/merging is possible in principle, but fixed is operationally simpler, so many systems don't implement splitting). So the initial number is the **maximum number of nodes** you can ever have — choose it high enough for future growth. But each partition has management overhead, so too many is counterproductive. If total data size is very variable, the right partition size is hard to pick: too large → expensive rebalancing and recovery; too small → too much overhead.

**Dynamic partitioning.** For **key-range** partitioning, fixed boundaries would be awful (get them wrong and all data lands in one partition). So HBase and RethinkDB create partitions dynamically: when a partition exceeds a configured size (HBase default: 10 GB) it **splits** into two halves; if it shrinks below a threshold after deletes, it **merges** with a neighbour — like a B-tree's top level. A split half can be moved to another node to balance load (HBase transfers files through HDFS). Advantage: the number of partitions adapts to data volume. Caveat: an **empty database starts with one partition**, so all writes go to one node until the first split. Mitigation: **pre-splitting** an initial set of partitions (HBase, MongoDB) — which, for key ranges, requires knowing the key distribution in advance. Dynamic partitioning works with hash partitioning too: MongoDB (2.4+) supports both and splits dynamically in either case.

**Other strategies.** Cassandra before 1.2 used consistent hashing with pseudo-random boundaries: **one big partition per node** covering a large continuous hash range. Poor load distribution, and adding a node meant an existing node had to split its range and hand half its data over — expensive, hard to do in the background without hurting queries. Replaced with fixed partitions. (A better hash function can avoid these problems, but in practice the most widely used models are hashing with a fixed number of partitions, or dynamic partitioning by key range when range queries are required.)

**Automatic or manual?** A gradient from fully automatic (the system moves partitions itself) to fully manual (an administrator configures the assignment). Couchbase, Riak and Voldemort *suggest* an assignment automatically but need an admin to commit it. Fully automatic is convenient but **unpredictable**: rebalancing is expensive (re-routing requests, moving lots of data) and can overload the network or nodes. Dangerous combined with automatic failure detection: an overloaded node is slow → others conclude it's dead → they rebalance load *away* from it → more load on the others and the network → more nodes overloaded → **cascading failure**. A human in the loop is slower but can prevent operational surprises.
:::

:::practice 22-rebalancing | Count the moving keys
Measure hash mod N, fixed partitions and hash rings with 1/8/64 tokens per node on 100,000 keys.
:::

:::quiz
### mcq
Why is `hash(key) mod N` a bad way to assign keys to nodes?
- [ ] Modulo is slow to compute
- [x] When N changes, most keys map to a different node, so almost all data must move
- [ ] It creates hot spots
- [ ] It can't handle string keys
>>>
p. 201–202; your exercise showed ~90% of keys moving from 10 to 11 nodes.

### mcq
With a fixed number of partitions, what changes when a node is added?
- [ ] The number of partitions
- [ ] Which partition each key belongs to
- [x] Only the assignment of some whole partitions to nodes
- [ ] The hash function
>>>
The key→partition mapping is fixed; partitions move between nodes (p. 202).

### predict
You create a fixed-partition database with 16 partitions. Two years later you need 40 nodes. What's the problem?
- [ ] None, partitions split automatically
- [x] You can't use more than 16 nodes usefully: the initial partition count is the maximum number of nodes
- [ ] Each partition must be replicated 40 times
- [ ] Hash collisions
>>>
Choose the number high enough for future growth, but not absurdly high (p. 202).

### mcq
What problem does pre-splitting solve in dynamically partitioned databases?
- [ ] Too many partitions
- [x] An empty database starts with a single partition, so all early writes go to one node until the first split
- [ ] Partitions merging too often
- [ ] Hash skew
>>>
p. 204. With key ranges, you must know the key distribution in advance.

### scenario
Your database rebalances automatically and detects failures automatically. During a traffic spike, one node becomes slow. Describe how this could become an outage.
>>>
The slow node misses failure-detection timeouts, so the cluster concludes it's dead and automatically rebalances its partitions onto the remaining nodes. Moving those partitions consumes network bandwidth and disk I/O on the other nodes — which are already handling extra load from the spike. They slow down too, start missing timeouts, are declared dead, and trigger more rebalancing: a cascading failure (p. 205). A human in the loop (or rate-limited, delayed rebalancing) prevents this.

### explain
Why did Cassandra move away from "one random hash range per node"? Use your exercise numbers.
>>>
With one random token per node, the ranges are very unequal, so some nodes own far more data than others — in the exercise, the busiest node had about 3.4× its fair share. Adding a node splits just one existing range, taking data from a single neighbour rather than from everyone, which is expensive for that node and leaves the imbalance in place. A fixed number of many partitions per node (or many tokens per node) distributes load evenly and lets a new node take a little from every node (p. 204).
:::

:::connect Where this goes next
"All participants must agree on the assignment" is tomorrow's request-routing problem — and its proper solution, consensus, is Chapter 9. The cascading-failure story is a preview of Chapter 8's argument that you cannot reliably tell a slow node from a dead one.
:::
