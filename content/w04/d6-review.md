---
title: Review — Chapter 3 Checkpoint
kind: assessment
minutes: 70
chapter: 3
objectives:
- Retrieve the whole of Chapter 3 from memory
- Apply OLTP and OLAP storage reasoning to new scenarios
- Mix in questions from Chapters 1 and 2
reading:
- Chapter 3 Summary | 100-101
complete:
- You did today's spaced review
- You answered the checkpoint without notes, then checked
- Your LSM lab passes at least T1–T3
---

:::review Today's spaced review
Questions scheduled for today from Weeks 1–4.
:::

:::task Explain Chapter 3 to someone else
Imagine a friend who knows SQL but nothing about internals asks: "Why are there so many different databases?" Write (or say out loud) a 5-minute answer using Chapter 3: OLTP vs OLAP, the two OLTP schools, column stores. If you can't explain a part simply, that's the part to revisit.
:::

:::quiz Chapter 3 checkpoint
### scenario
An e-commerce company runs both its storefront and its weekly sales reports on one PostgreSQL database. During report runs, checkout latency p99 jumps from 80 ms to 2 s. Explain what's happening using Chapter 3, and propose an architecture.
>>>
The reports are OLAP queries that scan and aggregate huge numbers of rows. They compete with the latency-critical OLTP checkout transactions for disk bandwidth, CPU and cache, and can push hot OLTP data out of memory — the tail latency of checkouts suffers. Proposal: extract the data (dumps or a stream of changes) into a separate data warehouse via ETL, transformed into a star schema (fact_sales with date/product/store/customer dimensions), ideally with column-oriented storage and compression, and run reports there. The OLTP database stays optimised for small indexed reads and writes.

### tradeoff
A time-series database ingests sensor readings at a very high rate and is queried by "readings for sensor X between t1 and t2". Which design fits best?
- [ ] A hash-indexed log keyed by sensor, because writes are appends
- [x] An LSM-tree keyed by (sensor_id, timestamp): sequential writes for high ingest, sorted keys for efficient range scans
- [ ] A B-tree with one index per column
- [ ] A data cube with sensor and hour dimensions only
>>>
Hash indexes can't do range scans. An LSM-tree with a concatenated key gives contiguous ranges per sensor and absorbs a high write rate. (A cube would lose raw readings.)

### mcq
Which statement about analytics storage is **false**?
- [ ] Column stores read only the columns a query needs
- [ ] The first sort key of a column store compresses best
- [ ] Bitmap indexes answer `IN` with bitwise OR and multi-column `AND` with bitwise AND
- [x] Column stores can cheaply update compressed column files in place, like B-trees
>>>
Compressed, sorted columns can't be updated in place; writes go to an in-memory store and are merged into new column files in bulk (p. 98).

### mcq
In an OLTP system, what is often the main bottleneck; in an analytic system?
- [x] OLTP: disk seek time; analytics: disk bandwidth
- [ ] OLTP: disk bandwidth; analytics: disk seek time
- [ ] Both: CPU clock speed
- [ ] Both: network latency
>>>
OLTP does many small random accesses via indexes (seeks); analytics scans huge amounts sequentially (bandwidth) — straight from the summary (p. 100).

### explain
Explain the role of the write-ahead log in both an LSM-tree and a B-tree. Is it the same log in both?
>>>
In both, the WAL is an append-only file written before the main data structure is changed, so a crash can be recovered from. In an **LSM-tree** it protects the in-memory memtable: writes are appended to the WAL, and after a crash the WAL is replayed to rebuild the memtable; once flushed to an SSTable, the WAL can be discarded. In a **B-tree** it protects in-place page modifications: every change is logged before pages are overwritten, so a crash during a multi-page operation (like a split) can be repaired. Same mechanism and idea, protecting different things (volatile memory vs partially overwritten pages).

### design
Design the storage for a "like" button counter service: 50 million posts, 200,000 likes per second at peak, reads of "like count for post X" at 1 million per second. Which Chapter 3 ideas would you use? (One paragraph.)
>>>
A good answer: the workload is many writes per key with point reads, so a log-structured engine is attractive. Option 1: Bitcask-style hash-indexed log — 50M keys fit in memory (~a few GB), one-seek reads, appends for writes, and compaction shrinks the many updates per key (exactly the cat-video example). Option 2: an LSM-tree (RocksDB) if the key count might outgrow RAM. To handle 1M reads/s, keep counts in memory (the OS page cache or an in-memory store) and possibly batch increments in memory before writing (group commit). Durability can be traded for speed by fsyncing in batches. (Scaling beyond one machine — replication and partitioning — comes in Part II.)
:::
