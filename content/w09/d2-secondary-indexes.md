---
title: Partitioning and Secondary Indexes
kind: lesson
minutes: 80
chapter: 6
objectives:
- Explain why secondary indexes don't map neatly to partitions
- Explain document-partitioned (local) indexes and scatter/gather reads
- Explain term-partitioned (global) indexes, and their effect on writes and freshness
- Decide between local and global indexes for a workload
reading:
- Partitioning and secondary indexes | 197-198
- Partitioning secondary indexes by document | 198-199
- Partitioning secondary indexes by term | 200
complete:
- You compared query and write costs of both index types in the visualization
- You can explain why a global index is often updated asynchronously
- You answered the quiz
---

:::problem "Find all red cars"
If records are only accessed by primary key, the key tells you the partition. But **secondary indexes** don't identify a record; they find all occurrences of a value: all actions by user 123, all articles containing "hogwash", all red cars (p. 197). They're the bread and butter of relational databases, common in document databases, and the *raison d'être* of search servers like Solr and Elasticsearch. Key-value stores like HBase and Voldemort avoided them for complexity; Riak added them because they're so useful. Problem: **they don't map neatly to partitions.**
:::

:::intuition Local or global?
A used-car site (Figure 6-4): listings partitioned by document ID (0–499 in partition 0, 500–999 in partition 1); users filter by color and make.

**Document-partitioned (local) index.** Each partition indexes **only its own documents**. Writes are easy: adding, removing or updating a document touches only the partition holding it. But red cars may be in **every** partition, so a query must go to **all partitions** and combine the results: **scatter/gather**.

**Term-partitioned (global) index** (Figure 6-5). One index covering all data — but it must itself be partitioned (on one node it would be a bottleneck), and differently from the documents: e.g. colors a–r on partition 0, s–z on partition 1. The **term** (`color:red`) decides the partition. (The name comes from full-text search, where terms are words.) A query only asks the partition holding its term. But a write of one document may update index entries on **several** partitions.

Analogy: a library with several branches. Local index = each branch has a catalogue of its own books; to find every copy of a title, phone every branch. Global index = one catalogue, split alphabetically across branches; to find a title, phone one branch — but every new book requires updating catalogue entries in possibly several branches.
:::

:::visual SecondaryIndexSim | Figures 6-4 and 6-5
**Try this:**
1. **Local index**: search for red cars — both partitions are contacted. Insert a red Audi — one partition touched.
2. **Global index**: search for red cars — one partition. Insert a red Audi: the document goes to one partition, its index entries possibly to others.
3. Tick **asynchronous index updates**, insert, and search immediately: the new car is missing until the pending updates are applied.
:::

:::details Details and trade-offs (pp. 198–200)
**Local indexes in practice.** Scatter/gather makes secondary-index reads expensive, and even in parallel it's prone to **tail latency amplification** (Week 1: the query waits for the slowest partition). Still widely used: MongoDB, Riak, Cassandra, Elasticsearch, SolrCloud, VoltDB. Vendors recommend structuring partitioning so secondary-index queries hit a single partition, which isn't always possible — especially when filtering on several indexes at once (color **and** make).

*Footnote warning (p. 198):* if your database only supports key-value access and you build a secondary index yourself in application code, take great care to keep it consistent with the data — race conditions and partial write failures easily cause drift (Chapter 7, "The need for multi-object transactions").

**Global indexes in practice.** Partitioning the index by the term itself allows range scans (e.g. asking price); by a hash of the term spreads load more evenly. Reads are efficient (one partition instead of scatter/gather), but writes are slower and more complicated: one document write may affect several index partitions on several nodes. Keeping the index always up to date would need a **distributed transaction** across all affected partitions, which not all databases support (Chapters 7, 9). So updates to global indexes are often **asynchronous**: right after a write, the index may not reflect it. Amazon DynamoDB's global secondary indexes are updated within a fraction of a second normally, but may lag longer during infrastructure faults. Riak's search and Oracle's data warehouse (which lets you choose local or global) also use global indexes.
:::

:::quiz
### mcq
With a document-partitioned (local) secondary index, what does a query for `color:red` require?
- [ ] Contacting only the partition responsible for "red"
- [x] Sending the query to all partitions and combining the results (scatter/gather)
- [ ] A distributed transaction
- [ ] A full table scan on one node
>>>
Each partition only indexes its own documents, and red cars can be anywhere (p. 199).

### mcq
What's the main write-side downside of a term-partitioned (global) index?
- [ ] Writes must scan every partition
- [x] A single document write may need to update index entries on several partitions, on different nodes
- [ ] Writes can't be replicated
- [ ] It forbids range queries
>>>
Every term in the document may live on a different index partition (p. 200).

### predict
A database has a global secondary index updated asynchronously. You insert a red car and immediately search for red cars. What might you see?
- [ ] The new car, guaranteed
- [x] Possibly the old result set without the new car, until the index update propagates
- [ ] An error
- [ ] Duplicate entries
>>>
Asynchronous global indexes are eventually consistent; DynamoDB documents exactly this (p. 200).

### tradeoff
A log-search system ingests 1 million log lines per second and receives a few hundred searches per minute. Which index partitioning fits better?
- [x] Local (document-partitioned): writes stay cheap and local; occasional searches can afford scatter/gather
- [ ] Global, because reads are cheaper
- [ ] No index at all
- [ ] A single unpartitioned index on one node
>>>
Write-heavy, read-light workloads favour local indexes. (Elasticsearch, a common log-search engine, uses document-partitioned indexes, p. 199.)

### explain
Why is scatter/gather "prone to tail latency amplification"? Connect it to Week 1.
>>>
A scatter/gather query must wait for responses from every partition before it can return the combined result. Its response time is therefore the maximum of all the partitions' response times. Even if each partition is slow only 1% of the time, a query that touches 20 partitions is slow about 1 − 0.99²⁰ ≈ 18% of the time — exactly the effect of Figure 1-5, where one slow backend call slows the whole user request.
:::

:::connect Where this goes next
Keeping a global index in sync with documents across partitions is a multi-partition write — tomorrow's rebalancing has the same flavour, and Chapter 7 (transactions) and Chapter 9 (atomic commit) are about making such multi-object changes safe. In Chapter 11 you'll see a third way: derive indexes asynchronously from a change log.
:::
