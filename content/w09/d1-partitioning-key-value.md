---
title: Partitioning Key-Value Data — Ranges, Hashes and Hot Spots
kind: lesson
minutes: 95
chapter: 6
objectives:
- Explain why partitioning is needed beyond replication, and how partitioning combines with replication
- Define skew and hot spots, and why random assignment is a bad idea
- Compare key-range and hash partitioning, including the trade-off around range queries
- Explain compound keys (Cassandra) as a hybrid
- Explain why hot keys survive hashing and how key salting helps
reading:
- Chapter 6 opening; partitioning and replication | 191-193
- Partitioning of key-value data; by key range | 193-195
- Partitioning by hash of key; consistent hashing sidebar | 195-196
- Skewed workloads and relieving hot spots | 196-197
complete:
- You produced a hot partition with timestamps and fixed it in the visualization
- You can explain why hashing destroys efficient range queries
- You answered the quiz
---

:::problem When copies aren't enough
Replication puts the *same* data on several machines. But if the dataset is too big for one machine, or the query throughput is too high, copies don't help — you must **break the data up** into **partitions** (p. 191). Each record belongs to exactly one partition, and each partition is effectively a small database of its own.

(Names differ: a *shard* in MongoDB, Elasticsearch, SolrCloud; a *region* in HBase; a *tablet* in Bigtable; a *vnode* in Cassandra and Riak; a *vBucket* in Couchbase. And it has nothing to do with *network partitions*, a kind of fault in Chapter 8.)

The goal: spread **data and query load evenly**, so 10 nodes handle 10× the data and throughput. Partitioned databases were pioneered in the 1980s (Teradata, Tandem NonStop SQL) and rediscovered by NoSQL databases and Hadoop-based warehouses.
:::

:::intuition Encyclopedias and hash buckets
**Partitioning + replication** (Figure 6-1): each partition is replicated to several nodes; a node can hold many partitions — leader for some, follower for others. Everything from Chapter 5 applies per partition, so this chapter ignores replication.

If partitioning is unfair, it's **skewed**; a partition with disproportionate load is a **hot spot**. Assigning records to nodes randomly would spread data evenly, but then you'd have to query **every** node to find a record. We can do better:

**By key range** — like the volumes of a paper encyclopedia (Figure 6-2): each partition owns a continuous range of keys. Know the boundaries, and you know where any key lives. Boundaries needn't be evenly spaced: volume 1 holds A–B, volume 12 holds T–Z, because the data isn't evenly distributed. Used by Bigtable, HBase, RethinkDB, and MongoDB before 2.4.

**By hash of key** — apply a hash function that turns skewed keys into a uniform distribution; each partition owns a range of **hashes** (Figure 6-3). Similar keys get wildly different hashes. The hash needn't be cryptographic (Cassandra and MongoDB use MD5, Voldemort Fowler–Noll–Vo).
:::

:::visual PartitionSim | Where does the load go?
**Try this:**
1. **Key range + sensor timestamps**: historical data is evenly spread, but every *new* write has today's timestamp, so all writes hit one partition.
2. Switch to **hash**: writes spread out — but a range scan for one day now touches every partition.
3. **Celebrity hot key** with hash partitioning: one partition is still hot. Turn on **split hot key** and increase the number of sub-keys.
:::

:::details Trade-offs and hybrids (pp. 194–197)
**Key range.** Within a partition, keys can be kept sorted (SSTables!), so **range scans** are easy, and a key can act as a concatenated index — e.g. sensor readings keyed by `year-month-day-hour-minute-second`: fetching a month is one scan. The downside: **access patterns can create hot spots**. With timestamp keys, partitions correspond to time ranges, and all of today's writes go to today's partition while others sit idle. Fix: make something else the first part of the key — prefix with the **sensor name** — so writes spread across partitions (but fetching many sensors for a time range now needs one range query per sensor).

**Hash.** Good at distributing keys fairly. Partition boundaries can be evenly spaced or pseudo-random — the latter is sometimes called **consistent hashing**. *Sidebar:* consistent hashing (Karger et al.) was designed for internet-wide caches (CDNs), using random boundaries to avoid central control; "consistent" has nothing to do with replica or ACID consistency; it doesn't work well for databases and is rarely used in practice — the book suggests just saying **hash partitioning**. The big loss: **efficient range queries** — adjacent keys are scattered. In MongoDB's hash-based sharding, range queries go to all partitions; Riak, Couchbase and Voldemort don't support primary-key range queries at all.

**Cassandra's compromise.** A compound primary key: **only the first column is hashed** to choose the partition; the other columns form a **concatenated index** for sorting within the partition's SSTables. You can't range-scan the first column, but with a fixed first column you can range-scan the rest. Elegant for one-to-many data: key `(user_id, update_timestamp)` → all of one user's updates in a time range, sorted, from a single partition.

**Skewed workloads** (pp. 196–197). Hashing can't help when all requests are for the **same key** — e.g. a celebrity with millions of followers causing a storm of activity on their user ID or post ID. Most systems can't compensate automatically, so the **application** must: add a random number (say two digits) to the start or end of a known-hot key, splitting its writes over 100 keys on different partitions. Costs: reads must fetch all 100 keys and combine them; and you need bookkeeping of which keys are split (doing it for every key would be pure overhead).
:::

:::extra Since 2016
Some systems now detect and split hot ranges automatically — for example CockroachDB and TiDB split and move ranges based on load, not just size, and DynamoDB's "adaptive capacity" reshuffles throughput to hot partitions. The book's "perhaps in future, data systems will be able to automatically detect and compensate" has partly come true; application-level salting is still common for extreme single-key hot spots.
:::

:::quiz
### mcq
Why not simply assign records to nodes at random?
- [ ] Random assignment creates hot spots
- [x] Reads would have to query every node, because you couldn't know where a particular record is
- [ ] Hash functions can't produce random numbers
- [ ] It violates replication
>>>
Random placement spreads data evenly but loses the ability to locate a key (p. 193).

### predict
Sensor readings are stored with the timestamp as the key, partitioned by key range, one partition per day. What happens to write load?
- [ ] It's spread evenly over all partitions
- [x] All new writes go to today's partition — a hot spot — while the others sit idle
- [ ] Writes alternate between partitions
- [ ] Writes are rejected
>>>
p. 194–195. Prefix the key with the sensor name to spread writes.

### mcq
What do you lose by partitioning by hash of key instead of by key range?
- [ ] Even distribution
- [ ] The ability to look up a key directly
- [x] Efficient range queries, because adjacent keys are scattered across partitions
- [ ] Replication
>>>
Keys that were adjacent are now spread over all partitions (p. 196).

### mcq
In Cassandra, a table has primary key `(user_id, update_timestamp)`. Which query is efficient?
- [ ] All updates from all users in the last hour
- [x] All updates by user 42 between two timestamps
- [ ] All users whose ID starts with "a"
- [ ] The newest update across all users
>>>
Only `user_id` is hashed to pick the partition; within it, rows are sorted by timestamp, so a range scan for one user is cheap (p. 196).

### tradeoff
A celebrity's post receives 50,000 comments per second, all written under the post's ID. You prefix the key with a random number 00–99. What's the cost?
- [ ] None
- [x] Reads of that post's comments must now fetch and combine 100 keys, and you need bookkeeping to know which keys are split
- [ ] The comments are lost
- [ ] All other keys must also be split
>>>
p. 197. It only makes sense for the few known hot keys.

### explain
Explain why the book recommends avoiding the term "consistent hashing".
>>>
Because it's confusing on two counts. "Consistent" here has nothing to do with replica consistency (Chapter 5) or ACID consistency (Chapter 7) — it describes a rebalancing approach with randomly chosen partition boundaries, invented for internet-wide caching (CDNs). And that particular approach doesn't work well for databases, so it's rarely used; documentation that mentions it is often inaccurate. Saying "hash partitioning" is clearer (p. 196).
:::

:::connect Where this goes next
Partitioning by key works when you always look up by primary key. Tomorrow: what happens to **secondary indexes** — the "find all red cars" queries — in a partitioned database. And remember Chapter 5's consistent prefix reads: they're a partitioning problem, because partitions replicate independently.
:::
