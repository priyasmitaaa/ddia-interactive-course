---
title: Milestone 5 — Partitioning, Routing and Rebalancing
kind: project
minutes: 100
objectives:
- Route keys to partitions by hash, and partitions to groups by an assignment map
- Rebalance by moving whole partitions, and compare with hash mod N
- Explain request routing options and where MiniKV's assignment map would live in production
reading:
- Re-read partitioning by hash of key | 195-197
- Re-read rebalancing partitions; fixed number of partitions | 201-204
- Re-read request routing | 205-207
complete:
- All M5_Partitioning tests pass
- You wrote the partitioning section of DESIGN.md
- You answered the quiz
---

:::problem One replica set isn't enough either
A single ReplicaSet holds all data on three nodes, and every write goes through one leader. To scale, **split the key space into partitions**, each its own ReplicaSet, and spread them over groups of machines (Chapter 6). Then adding machines must move as little data as possible.
:::

:::intuition Fixed partitions, an assignment map
- **Key → partition**: `crc32(key) % NUM_PARTITIONS`, with NUM_PARTITIONS fixed at 8. It's a stable hash, unlike Python's per-process `hash()` (Lab 37). Hashing spreads keys evenly but destroys key order, so range scans across keys would need to query every partition (Chapter 6).
- **Partition → group**: an **assignment map**. Adding a group moves **whole partitions** from the most loaded groups until the new group holds its fair share. Only those partitions' keys move. This is Chapter 6's "fixed number of partitions" strategy, used by Riak, Elasticsearch, Couchbase and Voldemort. The anti-pattern is `hash(key) mod number_of_nodes`, which moves most keys whenever the node count changes, and the M5 test measures the difference.
- **Routing**: who knows the assignment map? Chapter 6 offers three options: any node forwards the request, a routing tier, or partition-aware clients. All of them need an authoritative, consistent copy of the map, which is often kept in ZooKeeper or etcd (Chapter 9's coordination services). In MiniKV the `Cluster` object plays that role.

**DESIGN.md, partitioning section**: how many partitions and why (you can't change it later without splitting); how rebalancing works; what happens to in-flight requests during a move (in production: copy the data, catch up via the log, then switch the map entry atomically); hot-key limitations (one celebrity key still lands on one partition, Chapter 6).
:::

:::practice 45-capstone-minikv | M5 — partitioning
Implement `Cluster.put`, `Cluster.get` and `Cluster.add_group`. Run `test_minikv.py M5_Partitioning`.
:::

:::quiz
### mcq
Why does MiniKV use a fixed number of partitions with an assignment map rather than hash(key) mod number_of_groups?
- [ ] It's faster to compute
- [x] When groups are added, only whole partitions move, so only their keys travel; with mod N, most keys would change owner
- [ ] It preserves key order
- [ ] It avoids hot keys
>>>
That's Chapter 6's rebalancing strategies. You choose the partition count up front, generously.

### predict
Going from 2 to 3 groups with 8 partitions, how many partitions does the new group get, and does any key move between the two old groups?
- [ ] 4; yes
- [x] 2 (the fair share, 8 // 3); no, keys only move to the new group
- [ ] 8; yes
- [ ] 1; no
>>>
Moving partitions only onto the new group minimizes data movement.

### tradeoff
What does hash partitioning cost you compared with key-range partitioning?
- [x] Efficient range queries: adjacent keys are scattered across partitions, so a range scan must query all of them; in exchange, load is spread more evenly
- [ ] Durability
- [ ] Replication
- [ ] Nothing
>>>
That's Chapter 6's trade-off between key-range and hash partitioning.

### explain
Describe how you would move a partition to a new group in a real deployment without losing writes or serving wrong data.
>>>
(1) Create new replicas on the new group and bootstrap them from a consistent snapshot of the partition taken at a known log position (Chapter 11's initial snapshot), or let them catch up as followers. (2) Stream the partition's log from that position until the new replicas are nearly caught up. (3) Briefly pause writes for the partition, or fence them with a new epoch, let the new replicas apply the last entries, and atomically update the assignment map in the coordination service (ZooKeeper or etcd) so routers send requests to the new owner. (4) Have the old owner reject requests carrying the old map version, so requests routed with a stale map are retried, which is fencing again. (5) Delete the old copy once nothing routes to it. This is how systems like Kafka and Elasticsearch reassign partitions, and it composes Chapters 5, 6, 9 and 11.
:::

:::connect Tomorrow
Milestone 6: each partition leader's log becomes a change stream feeding a derived index.
:::
