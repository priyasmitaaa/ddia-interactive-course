---
title: What Changed Since 2016 — A Hedged Tour
kind: supplement
minutes: 75
objectives:
- Connect major post-2016 developments to the chapters that explain them
- Recognise which fundamentals stayed the same even as products changed
- Practise evaluating a new system's claims with the course's vocabulary
complete:
- You mapped at least six developments to the chapter that explains them
- You evaluated one current product's documentation with the five-question checklist (Week 17)
- You answered the quiz
---

:::note Supplementary, and time-sensitive
Everything on this page comes from **after** your PDF. It's a deliberately brief, conservative summary of well-established developments. Product details change quickly, so **check current documentation** before relying on any of it. Each item points back to the chapter that gives you the tools to understand it. That's the lasting value.
:::

:::problem New names, old ideas
Since 2016, many new products have appeared, and some old ones were rebuilt. It's tempting to think the book is outdated. In practice, almost every new system recombines ideas you now know: logs, partitioning, replication, consensus, LSM-trees, columnar storage, dataflow and derived data. Recognizing the old idea inside the new product is the skill to practice.
:::

:::intuition Developments, mapped to chapters
- **Exactly-once in Kafka (Ch 11).** From around 2017, Kafka added idempotent producers and transactions that commit output records together with consumer offsets. That's Chapter 11's atomic commit within a restricted environment, which the text mentions as "planned". It covers effects *inside* Kafka. External side effects still need idempotence or end-to-end IDs.
- **Consensus everywhere (Ch 9).** Kafka replaced its ZooKeeper dependency with a built-in Raft-based controller (KRaft). etcd (Raft) underpins Kubernetes. Distributed SQL databases such as CockroachDB, YugabyteDB and TiDB, and Google Spanner as a cloud service, run a consensus group per range of data, combining partitioning (Ch 6), replication (Ch 5) and consensus (Ch 9).
- **Cloud data warehouses and the lakehouse (Ch 3, 10).** Managed warehouses (for example Snowflake, BigQuery, Redshift) separate storage from compute and use columnar storage at their core. Open table formats (Apache Iceberg, Delta Lake, Apache Hudi) add transactional snapshots, schema evolution and "time travel" on top of Parquet files in object storage. That's snapshot isolation (Ch 7) and schema evolution (Ch 4) applied to data lakes (Ch 10).
- **Disaggregated storage and "the log is the database" (Ch 3, 5).** Cloud-native OLTP designs (Amazon Aurora is a well-known example) ship the redo/write-ahead log to a replicated storage layer instead of writing whole pages, an idea Chapter 3's WALs and Chapter 5's log shipping make easy to understand.
- **Change data capture as standard infrastructure (Ch 11).** CDC tools such as Debezium, and managed equivalents, are now common ways to feed search indexes, caches and warehouses, the architecture of Figure 11-5.
- **Stream processing matured (Ch 11).** Event-time windows with watermarks, exactly-once state checkpoints and SQL over streams are now mainstream features, especially in Apache Flink and the Apache Beam model, realizing much of Chapter 11's reasoning-about-time section.
- **Local-first software and CRDTs (Ch 5, 9).** Conflict-free replicated data types and "local-first" applications (the author co-authored an influential 2019 essay on local-first software, and works on CRDT libraries such as Automerge) push multi-leader replication all the way to user devices. That's Chapter 5's conflict resolution taken seriously.
- **Testing distributed systems (Ch 8, 9).** Jepsen analyses continued to find consistency bugs in real databases. Deterministic simulation testing, running a whole distributed system in one deterministic process with injected faults, became popular (FoundationDB is often cited). That's Labs 30, 31 and 35, scaled up.
- **Vectors and AI workloads (Ch 2, 3).** Similarity search over embeddings gained dedicated indexes and extensions in existing databases (for example pgvector for PostgreSQL), an extension of Chapter 3's indexing ideas and Chapter 10's "specialization for different domains".
- **Privacy regulation (Ch 11, deletion).** Laws such as the EU's GDPR (in force from 2018) made "really delete this user's data" a legal requirement, which makes Chapter 11's point that deletion is hard with immutable logs and backups very concrete.
:::

:::extra What stayed the same
- Networks are still unreliable, clocks still drift, processes still pause (Ch 8).
- Linearizability still costs latency, and the network-partition trade-off still holds (Ch 9).
- Two-phase commit still blocks on coordinator failure, so systems still avoid heterogeneous XA (Ch 9).
- Batch outputs are still best derived and swapped atomically, and derived data still needs a clear system of record (Ch 10, 11).
- Choosing a weaker guarantee deliberately, and knowing exactly what you gave up, is still the core skill.
:::

:::details A second edition
Also outside your PDF: a **second edition** of the book, by Martin Kleppmann with co-author Chris Riccomini, has been in preparation, with early-release chapters published by O'Reilly from 2024. Check O'Reilly for its current status and contents. If you have access to it later, read its chapters on cloud-native architectures and on the topics above, to see how the authors updated the material.
:::

:::quiz
### mcq
Kafka's transactions commit output records together with consumer offsets. Which Chapter 11 idea is that?
- [ ] Microbatching
- [x] Atomic commit of all outputs and the input offset, implemented efficiently within a restricted environment
- [ ] Log compaction
- [ ] Processing-time windows
>>>
The text describes this approach and mentions plans to add it to Kafka. External side effects still need idempotence.

### mcq
Open table formats like Apache Iceberg or Delta Lake add which familiar guarantee to files in object storage?
- [ ] Linearizable writes across regions
- [x] Transactional snapshots (snapshot isolation-style reads of a consistent table version), plus schema evolution
- [ ] Byzantine fault tolerance
- [ ] Two-phase commit with XA
>>>
Readers see a consistent version of the table while writers commit new ones, which is Chapter 7's snapshot idea applied to data lakes.

### predict
A new database's marketing says it is "strongly consistent, globally distributed, and always available". What should you suspect first?
- [ ] That it has solved CAP
- [x] That some term is defined loosely: during network partitions it must give up either linearizability or availability for some requests, and linearizability costs latency always
- [ ] That it uses LWW
- [ ] Nothing; this is now possible
>>>
The fundamentals of Chapters 8–9 didn't change. Read the precise guarantees and the failure behavior.

### tradeoff
Why did many systems replace ZooKeeper with built-in Raft quorums?
- [x] To run consensus inside the system itself, with one fewer separately operated distributed system, at the cost of implementing (or embedding) a consensus algorithm correctly
- [ ] Because consensus is no longer needed
- [ ] Because ZooKeeper isn't linearizable
- [ ] Because Raft needs no majority
>>>
The need for consensus (leader election, metadata) is the same as in Chapter 9. Only its packaging changed.

### explain
Pick one post-2016 system you've heard of and explain it in terms of at least three chapters of this course.
>>>
A good answer identifies the system's storage engine (Ch 3), its data model and encoding (Ch 2, 4), its replication and partitioning scheme (Ch 5, 6), its transaction isolation (Ch 7), its consensus or failure-detection approach (Ch 8, 9), and its place in the dataflow (Ch 10, 11). For example, a distributed SQL database splits tables into key ranges (range partitioning, Ch 6), replicates each range with Raft (Ch 9) on LSM-tree storage such as RocksDB or Pebble (Ch 3), and provides serializable transactions using hybrid logical clocks and MVCC (Ch 7, 8, 9). It runs 2PC-like commits across ranges whose participants are themselves consensus groups, which is why it doesn't block on a single coordinator failure (Ch 9).
:::

:::connect Where this goes next
Tomorrow: the published edition's closing theme, which is about the people whose data we process, not about machines.
:::
