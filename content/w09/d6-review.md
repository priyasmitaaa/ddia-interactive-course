---
title: Review — Chapter 6 Checkpoint
kind: assessment
minutes: 65
chapter: 6
objectives:
- Retrieve Chapter 6 from memory
- Design partitioning schemes for new workloads
- Mix partitioning with replication and storage-engine ideas
reading:
- Chapter 6 Summary | 208-209
complete:
- You did today's spaced review
- You answered the checkpoint without notes
- The partitioned-KV lab passes
---

:::review Today's spaced review
Scheduled questions from Weeks 1–9.
:::

:::task Draw Figure 6-1 + 6-8 from memory
Draw a four-node cluster holding four partitions, each with one leader and two followers spread across nodes; add a routing tier and a coordination service; draw what happens when a fifth node joins. Then compare with Figures 6-1, 6-6 and 6-8.
:::

:::quiz Chapter 6 checkpoint
### design
Design partitioning for a chat app: messages belong to conversations; the main query is "the latest 50 messages of conversation C", and writes come from millions of conversations at once. Some group chats are huge and very busy.
>>>
Use a compound key `(conversation_id, message_timestamp_or_sequence)`: hash the conversation ID to choose the partition (spreads millions of conversations evenly), and sort by timestamp within the partition so "latest 50 of C" is one range scan on one partition (Cassandra's approach, p. 196). Use a fixed number of partitions (many per node) for easy rebalancing. Huge busy group chats are hot keys: split them by adding a bucket (e.g. by time window or a small random prefix), accepting that reading the latest messages must merge a few sub-keys. Route via a partition-aware client or routing tier with a coordination service.

### mcq
Which combination is typical, according to the book?
- [x] Hash partitioning with a fixed number of partitions; key-range partitioning with dynamic splitting
- [ ] Key-range partitioning with hash mod N
- [ ] Hash partitioning with one partition per node, always
- [ ] Dynamic partitioning only for hashes
>>>
Hashing spreads keys uniformly, so fixed, pre-created partitions stay balanced. Key ranges follow the data, which you can't predict, so their boundaries must adapt by splitting and merging (summary, p. 208).

### tradeoff
An e-commerce site partitions products by product ID and needs "find products by category and price range". Local or global secondary index?
- [ ] Local, because category queries are rare
- [x] Global, partitioned by term (category, possibly with price ranges), if reads dominate — at the cost of slower, multi-partition (often asynchronous) writes
- [ ] No index: scan all partitions every time
- [ ] Neither is possible with hash partitioning
>>>
A read-heavy catalogue benefits from one-partition index reads; product updates are rarer. Partitioning the index by the term itself allows price range scans (p. 200).

### mcq
Which statement about partitioning and replication is correct?
- [ ] A record is stored on exactly one node
- [x] A record belongs to exactly one partition, but that partition may be stored on several nodes
- [ ] Replication replaces partitioning for big datasets
- [ ] Each node holds exactly one partition
>>>
Partitioning decides which subset a record belongs to; replication then copies each partition to several nodes for fault tolerance, and a node usually holds many partitions — leader for some, follower for others (p. 192, Figure 6-1).

### explain
Connect Chapter 6 to Chapter 3: how do SSTables, B-tree splits and Bloom filters relate to ideas in today's chapter?
>>>
Key-range partitioning keeps keys sorted within each partition, just like SSTables, enabling range scans and concatenated keys (Cassandra stores partitions as SSTables). Dynamic partitioning splits a partition that grows too big and merges small ones — the same idea as B-tree page splits at the top level of the tree (the book makes this comparison, p. 203). Bloom filters and indexes are derived data that help avoid unnecessary work, just as routing metadata avoids asking every node; and local secondary indexes per partition are ordinary storage-engine indexes, while global indexes are separately partitioned derived data.

### scenario
After adding nodes, your monitoring shows the new nodes are nearly idle while old nodes are still busy, even though rebalancing reported "done". What could be wrong?
>>>
Possibilities: routers or clients still use stale routing information and keep sending traffic to the old owners (missing notifications, cached maps not refreshed); the hot load is concentrated on a few hot keys/partitions that weren't the ones moved (skew rebalancing can't fix — needs salting or splitting hot ranges); with key-range partitioning, the new nodes received cold ranges while today's hot range stayed; or with a small fixed number of partitions, there weren't enough partitions to give the new nodes a fair share.
:::
