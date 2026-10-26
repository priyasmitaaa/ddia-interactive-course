---
title: Part I Exam — Foundations of Data Systems
kind: assessment
minutes: 90
objectives:
- Demonstrate understanding of Chapters 1–4 on unseen scenarios
- Connect ideas across chapters (load parameters, storage engines, encodings)
- Identify topics to revisit before Part II
complete:
- You answered every question before reading its explanation
- You listed (on paper) the three topics you found hardest, and revisited their lessons
---

:::note How to take this exam
Set aside about an hour and do it in one sitting, with the book closed. The questions mix chapters on purpose: in real design discussions, nobody tells you which chapter a problem comes from. Afterwards, note the questions you got wrong — they automatically come back in Review, and the lessons they link to are worth a second look before Part II.
:::

:::problem What this exam checks
Part I built a vocabulary: **reliability, scalability, maintainability**; **load parameters and percentiles**; **relational, document and graph models**; **log-structured and B-tree storage**; **OLTP and OLAP**; **column stores**; **encodings and compatibility**; **data flow through databases, services and messages**. These questions ask you to *use* that vocabulary on situations the book doesn't describe — the real test of understanding.
:::

:::quiz
### scenario
A food-delivery startup stores restaurant menus as JSON documents in a document database. Menus are read constantly and changed rarely. Now they want a feature: "show all dishes containing peanuts across all restaurants, and which customers ordered them last month". Analyse the fit of their current data model for the new feature, and propose a change.
>>>
Menus are a good document fit (self-contained trees, read whole, locality). The new feature is cross-cutting: it queries dishes across all documents by ingredient (needs a secondary index or a scan of every document) and joins dishes to orders and customers (many-to-many, poorly supported in document databases → application-side joins). Options: normalize ingredients/dishes into relational tables (or use the relational database's JSON support for menus plus relational tables for orders), add a secondary index on ingredients, and — since "last month's orders" is an analytic query — run it on a warehouse/column store fed by ETL rather than the OLTP database.

### mcq
Which pairing of workload and storage engine is the most natural?
- [ ] Analytics over 100 columns, 5 billion rows → B-tree with secondary indexes on every column
- [x] Very high write rate of small key-value updates, keys fit in RAM → hash-indexed log (Bitcask-style)
- [ ] Range scans over time-ordered sensor readings → hash index
- [ ] Ad-hoc aggregate queries over history → data cube only, with raw data deleted
>>>
Bitcask's sweet spot is many writes per key with all keys in memory. Analytics wants column stores; range scans need sorted structures; cubes can't replace raw data.

### predict
A service calls 25 backends in parallel per request. Each backend has p99 = 200 ms. Roughly what share of user requests will wait at least one 200+ ms backend response?
- [ ] 1%
- [ ] 5%
- [x] About 22%
- [ ] 99%
>>>
1 − 0.99²⁵ ≈ 0.22. Tail latency amplification (Chapter 1).

### mcq
Which change to a Protocol Buffers schema is safe for both old and new code?
- [ ] Changing the tag number of an existing field
- [ ] Adding a new `required` field
- [x] Adding a new optional field with a new tag number
- [ ] Reusing the tag of a deleted field for a new field
>>>
New tags are skipped by old code (forward) and absent values are fine for new code (backward), as long as the field isn't required (Chapter 4).

### tradeoff
A team notices their LSM-based database has good average latency but occasional 2-second p99.9 spikes on reads during heavy write periods. What's the most likely cause, and a reasonable mitigation?
- [ ] B-tree page splits; switch to a hash index
- [x] Compaction competing for disk bandwidth with reads; rate-limit/tune compaction, give it more I/O headroom, or (if predictability matters more than write throughput) consider a B-tree engine
- [ ] JSON parsing; switch to XML
- [ ] Network partitions; add more replicas
>>>
Chapter 3 (p. 82) and your own Project 1 benchmark: compaction raises tail latency while barely moving averages.

### mcq
Which statement about indexes is correct?
- [ ] Adding an index changes query results
- [ ] Indexes make both reads and writes faster
- [x] An index is derived data that speeds up some reads and slows down every write that must maintain it
- [ ] Column stores need more secondary indexes than row stores
>>>
The fundamental trade-off of Chapter 3 (p. 69), which also underlies materialized views, caches and Twitter's timelines.

### design
Design the storage for an analytics dashboard that shows "orders per country per hour" for the last 2 years, refreshed every minute, at a company with 50 million orders per day. Use at least three ideas from Chapter 3.
>>>
A good answer: ship order events from the OLTP database to a separate warehouse (ETL or a change stream) so analytics doesn't hurt checkout. Store facts in a star schema: `fact_orders` with foreign keys to `dim_date`/`dim_time`, `dim_country`, etc. Use a column-oriented store: the dashboard reads few columns (timestamp, country) over billions of rows; sort by date/hour first so time ranges are contiguous and the sort key compresses with RLE; country has few distinct values → bitmap encoding. For the per-minute refresh, maintain a materialized aggregate (a small data cube: hour × country → count) updated incrementally, while keeping raw facts for ad-hoc questions. New data lands in an in-memory write store merged into the column files (LSM-style, as Vertica does).

### explain
Explain how "derived data" appeared in each of Chapters 1, 2, 3 and 4 (one example each).
>>>
Ch 1: Twitter's per-user home-timeline caches, derived from the tweets and follows tables (fan-out on write); also Figure 1-1's cache and search index derived from the primary database. Ch 2: denormalized copies (e.g. embedding a region name instead of an ID) are derived from the authoritative record. Ch 3: indexes (hash maps, SSTable sparse indexes, B-tree secondary indexes, covering indexes), materialized views and data cubes are all derived from primary data. Ch 4: an archival snapshot or warehouse dump re-encoded in the latest schema (e.g. Parquet) is derived from the source database; so is any data produced by a consumer that transforms messages.

### mcq
During a rolling upgrade, version 2 of a service starts writing a new field to a shared database. Which failure is the book specifically warning about?
- [ ] Version 2 can't read old records
- [x] Version 1 reads a record, re-encodes it from its own model objects, and silently drops the new field when writing back
- [ ] The database rejects unknown fields
- [ ] Both versions crash
>>>
Figure 4-7. The encoding format may preserve unknown fields; the application layer must not throw them away.

### scenario
Your on-call colleague says: "We had a fault but no failure last night." Then: "We had a failure, but no faults." Explain whether each statement makes sense and give an example of each.
>>>
"A fault but no failure" makes perfect sense — that's fault tolerance working: e.g. a disk died, but the data was replicated and the service carried on. "A failure but no faults" is strictly odd: a failure (the system stopped providing service) normally has some cause — a fault in hardware, software or humans. But the fault may not be noticed as one: e.g. a correct-looking config change (human fault) or a load spike exposing a capacity limit no component was "broken". So the second statement usually means "we haven't found the fault yet".

### short
Name the two compatibility directions and say which one is usually harder and why.
>>>
Backward compatibility (new code reads old data) and forward compatibility (old code reads new data). Forward compatibility is harder, because the old code was written before the new format existed and must somehow ignore (or preserve) additions it doesn't understand (p. 108).

### mcq
Why do column stores sort whole rows rather than each column independently?
- [ ] Sorting columns independently is too slow
- [x] Rows are reassembled by position across column files, so all columns must share one row order
- [ ] SQL requires a primary key
- [ ] Only the first column is stored on disk
>>>
Chapter 3, p. 96: the k-th value of every column belongs to the same row.
:::

:::connect After the exam
List the three topics you found hardest. For each, open its lesson from the course map and redo just the quiz. Then rest — Part II starts with replication, and it builds on everything you've done: logs, encodings, rolling upgrades, and the "a timeout tells you nothing" lesson from Week 1's exercise.
:::
