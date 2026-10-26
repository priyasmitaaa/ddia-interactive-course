---
title: Databases and Streams — Keeping Systems in Sync with Change Data Capture
kind: lesson
minutes: 95
chapter: 11
objectives:
- Explain why replication logs and state machine replication show that database writes are a stream
- Explain the race condition and partial-failure problems of dual writes (Figure 11-4)
- Explain change data capture (Figure 11-5): making one database the leader of derived systems
- Compare trigger-based and log-parsing CDC, and explain CDC's asynchrony
- Explain initial snapshots, log compaction, and first-class change-stream APIs
reading:
- Databases and streams | 436-437
- Keeping systems in sync | 437-439
- Change data capture; implementing CDC | 439-440
- Initial snapshot; log compaction | 440-441
- API support for change streams | 441-442
complete:
- In the visualization, you made dual writes diverge, then fixed it with CDC, and rebuilt state from a compacted log
- Exercise 41 (CDC) is done
- You answered the quiz
---

:::problem One write, four systems
Log-based brokers took ideas from databases. Now go the other way. An event records something that happened, and that can be a **write to a database**. A **replication log** is a stream of write events from the leader that followers apply to get an identical copy. **State machine replication** (Chapter 9): if every event is a write and every replica processes the same events in the same order, deterministically, all replicas reach the same state. "It's just another case of event streams!" (pp. 436–437).

Meanwhile, no single system satisfies all needs. A typical web app has an OLTP database for requests, a **cache**, a **full-text index** for search, and a **data warehouse** for analytics, each with its own copy of the data in its own representation. When an item changes in the database, it must also change in the cache, the index and the warehouse. Warehouses are usually fed by **ETL**: a full copy of the database, transformed and bulk-loaded, which is a batch process (p. 437). When that's too slow, people resort to **dual writes**.
:::

:::intuition Dual writes are broken. Make the others followers
**Dual writes** (pp. 437–438): the application writes to each system itself, for example the database, then the search index, then invalidating cache entries. There are two serious problems:
- **A race condition** (Figure 11-4). Client 1 sets X = A and client 2 sets X = B. Both write the database, then the index. With unlucky timing, the database sees A then B (final value B) and the index sees B then A (final value A). **The two systems are permanently inconsistent, and no error occurred.** Without extra concurrency tracking such as version vectors, you won't even notice.
- **Partial failure**: one write succeeds and the other fails. Making both succeed or both fail is the **atomic commit** problem, which is expensive (Chapter 9).

The root cause is that there isn't **a single leader**. The database and the index may each have one, but neither follows the other, so conflicts happen as in multi-leader replication. "The situation would be better if there really was only one leader, for example the database, and if we could make the search index a follower of the database" (pp. 438–439).

**Change data capture (CDC)** (p. 439). Replication logs were long an **internal implementation detail**, not a public API, and many databases had no documented way to get their change log. CDC is the process of **observing all data changes written to a database and extracting them** in a form that can be replicated to other systems, ideally as a stream, immediately. Apply the changes to a search index **in the same order** and the index matches the database. **The index and other derived systems are just consumers of the change stream** (Figure 11-5). CDC makes one database the leader and the others followers. A **log-based broker** is a good transport because it preserves message order, avoiding Figure 11-2's reordering (p. 440).
:::

:::visual DualWriteSim | Figure 11-4 vs Figure 11-5, and log compaction
@props {"initialTab":"race"}
**Try this:**
1. **Application dual-writes**: database "A then B", index "B then A", and they disagree. Tick **first index write fails** too.
2. **Change data capture**: try every combination. The index always ends with the database's value.
3. **Log compaction** tab: slide the number of changes. The compacted log keeps one entry per live key, and a new consumer reading it from offset 0 rebuilds exactly the database's current state.
:::

:::details Implementing CDC, snapshots and compaction (pp. 440–442)
**Implementing CDC.** **Triggers** can do it: observe all changes to tables and add entries to a changelog table (trigger-based replication, Chapter 5). But they "tend to be fragile and have significant performance overheads". **Parsing the replication log** is more robust, though schema changes are a challenge. At scale: **LinkedIn's Databus**, **Facebook's Wormhole**, **Yahoo's Sherpa**. Tools: **Bottled Water** (PostgreSQL, decoding the WAL), **Maxwell** and **Debezium** (MySQL binlog), **Mongoriver** (MongoDB oplog), and **GoldenGate** (Oracle). CDC is usually **asynchronous**: the database doesn't wait for consumers before committing. Adding a slow consumer doesn't slow the system of record, but **all the issues of replication lag apply** (Chapter 5).

**Initial snapshot** (pp. 440–441). With the complete log of changes you could rebuild the whole database by replaying it, but keeping everything forever takes too much space and replaying it takes too long, so the log is **truncated**. A new full-text index needs the **whole** database, not only recent changes. So start from a **consistent snapshot** (as when setting up a new follower, Chapter 5) that **corresponds to a known offset** in the change log, so you know where to start applying changes. Some CDC tools integrate this, and others leave it manual.

**Log compaction** (p. 441) avoids repeating the snapshot each time you add a derived system. As with log-structured storage (Chapter 3, Figure 3-2), the storage engine periodically finds records with the same key, throws away duplicates, and **keeps only the most recent update per key**, in the background. A **null value (tombstone)** marks a deletion. A key stays in the log forever unless overwritten or deleted, so the space needed **depends only on the current contents of the database**, not on the number of writes ever made. For CDC: if every change has a primary key and replaces the previous value, the latest write per key is enough. To build a new derived system, start a consumer **at offset 0 of the compacted topic** and scan everything: it contains the latest value for every key, and maybe some older values. That gives a full copy **without a new snapshot of the source database**. **Kafka** supports this, which lets a broker be used for **durable storage**, not just transient messaging.

**API support for change streams** (pp. 441–442). Databases increasingly offer change streams as a **first-class interface**, rather than retrofitted, reverse-engineered CDC. **RethinkDB** lets queries subscribe to changes in their results, **Firebase** and **CouchDB** synchronize data based on a change feed also available to applications, and **Meteor** uses the MongoDB oplog to update user interfaces. **Kafka Connect** integrates CDC tools for many databases with Kafka, from where events feed derived systems and stream processors.
:::

:::practice 41-cdc | Dual writes vs CDC
Reproduce the dual-write race, implement trigger-based CDC into a search index in SQLite, compact the change log, and bootstrap a new index from a snapshot plus a log position.
:::

:::quiz
### mcq
In Figure 11-4, why do the database and search index end up with different values?
- [ ] One of the writes failed
- [x] The two clients' writes were interleaved differently at the two systems: the database applied A then B, the index B then A; neither system follows the other's order
- [ ] The index is eventually consistent
- [ ] Clock skew
>>>
No error occurred, and the systems are silently and permanently inconsistent (p. 438).

### mcq
What does change data capture essentially do?
- [ ] Copies the database nightly
- [x] Makes one database the leader by extracting its ordered change log and having derived systems (indexes, caches, warehouses) apply it as followers
- [ ] Writes to all systems in a distributed transaction
- [ ] Replaces the database with a message broker
>>>
Derived systems become followers of one leader's ordered change log, so they converge to the leader's state (pp. 439–440).

### predict
A CDC topic is log-compacted. User 42 was created, renamed three times, then deleted. What does a new consumer reading from offset 0 see for user 42 once compaction has run?
- [ ] All five changes
- [ ] Only the creation
- [x] Nothing, or at most a tombstone that's eventually removed: only the latest value per key is kept, and a delete leaves no live value
- [ ] The second rename
>>>
Compacted space depends only on current contents (p. 441).

### mcq
Why must a snapshot used to bootstrap a derived system correspond to a known log offset?
- [ ] For compression
- [x] So you know exactly where to start applying changes after loading the snapshot; otherwise changes are skipped or applied twice
- [ ] Because snapshots are stored in the log
- [ ] For security
>>>
The snapshot and the log position together say which changes are already included and which still need applying (pp. 440–441).

### tradeoff
CDC is usually asynchronous. What's the trade-off?
- [x] A slow consumer never slows the system of record, but derived systems lag behind it, so replication-lag anomalies (like not reading your own write in search) apply
- [ ] It's always consistent, but slow
- [ ] It loses writes
- [ ] It requires 2PC
>>>
CDC doesn't make the system of record wait for consumers, which protects its performance but means derived views lag behind (p. 440).

### scenario
Your team keeps Elasticsearch in sync with PostgreSQL by writing to both in application code. Search results occasionally show stale or deleted products. Propose a design, and say how you'd backfill the index for a new field.
>>>
The current design is dual writes, which suffer race conditions and partial failures (pp. 437–438). Instead, make PostgreSQL the single leader. Capture its changes with log-based CDC (for example Debezium reading the WAL via logical decoding, or a tool like Bottled Water, p. 440), publish them in commit order to a partitioned log such as Kafka, partitioned by product ID so per-product order is kept, and have an indexer consume the topic and update Elasticsearch, using upserts and deletes so it's idempotent. Expect some lag. For read-your-writes in the admin UI, read from PostgreSQL. To backfill a new field, either replay a log-compacted CDC topic from offset 0, which gives the latest value of every product without touching the database (p. 441), or take a consistent snapshot at a known log position, load it, then continue from that offset (pp. 440–441). Build the new index alongside the old one and switch over when it has caught up.
:::

:::connect Where this goes next
Tomorrow: event sourcing applies the same log idea at the application level, storing *what happened* as immutable events and deriving every view from them.
:::
