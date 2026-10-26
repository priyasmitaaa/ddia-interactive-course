---
title: Final Exam — Chapters 1–11
kind: assessment
minutes: 120
objectives:
- Demonstrate integrated mastery of the whole book
- Reason about unfamiliar systems with the book's concepts
- Design systems with explicit, justified trade-offs
reading:
complete:
- You answered every question without notes in about 100 minutes
- You graded yourself against the model answers
- You listed your three weakest topics and scheduled re-reading
---

:::note How to take this exam
Closed book, about 100 minutes, answers written first. The questions go roughly in chapter order, then integrate. Grade strictly: partially correct counts as wrong for review purposes, so the spaced-repetition system brings it back. After grading, re-read the summaries of the chapters behind your three weakest answers.
:::

:::quiz Final exam
### mcq
A service's median latency is 40 ms, but users complain about slowness. Which measurement best captures their experience?
- [ ] The mean
- [x] High percentiles (p99, p999), especially for requests that fan out to many backends, where the slowest call dominates
- [ ] The median
- [ ] CPU utilization
>>>
Tail latency amplification (Chapter 1): one slow backend call makes the whole request slow.

### mcq
When is a document model a poor fit compared with a relational model?
- [ ] For one-to-many trees loaded all at once
- [x] When data has many many-to-one and many-to-many relationships that need joins
- [ ] For schema flexibility
- [ ] For locality of reads
>>>
Documents suit trees with locality. Highly interconnected data favors relational or graph models (Chapter 2).

### tradeoff
LSM-tree vs B-tree for a write-heavy workload with mostly recent-key reads?
- [x] LSM-trees usually give higher write throughput (sequential writes, lower write amplification, better compression), at the cost of compaction interference and reads that may check several structures; B-trees give more predictable reads and in-place keys
- [ ] B-trees are always faster
- [ ] LSM-trees can't do range queries
- [ ] They're identical
>>>
Chapter 3's comparison of the two storage engine families.

### scenario
A team adds a required field to an Avro schema and deploys new consumers before new producers. Old messages still flow. What happens, and what's the rule they broke?
>>>
New readers decode old messages written with the old writer schema. Schema resolution needs a value for the new field, and since the field is required with no default, old records can't be read, so decoding fails (Chapter 4). The rule is that for backward compatibility (new code reading old data), any field you add must have a default value. Rolling upgrades need both backward and forward compatibility, because old and new code coexist during deployment.

### mcq
With asynchronous single-leader replication, which anomaly can a user see right after updating their profile?
- [ ] Write skew
- [x] Not seeing their own update, if the read goes to a lagging follower (read-your-writes violation)
- [ ] A dirty write
- [ ] Split brain
>>>
That's Chapter 5's replication lag. Fix it with read-your-writes techniques (read from the leader, or track timestamps).

### mcq
Why might hash partitioning still produce a hot partition?
- [ ] Hashing is random
- [x] A single very hot key (a celebrity) always maps to the same partition, whatever the hash
- [ ] Hashing destroys ordering
- [ ] Too many partitions
>>>
Skewed workloads need application-level splitting, such as a random suffix on hot keys (Chapter 6).

### scenario
Two concurrent transactions each check "at least one doctor on call" and then each take one doctor off call. Under snapshot isolation, both commit. Name the anomaly and give two fixes.
>>>
Write skew (Chapter 7, Figure 7-8). Fixes: run at serializable isolation (2PL with predicate or index-range locks, SSI, or actual serial execution), or explicitly lock the rows the decision depends on with `SELECT ... FOR UPDATE` over the on-call doctors for that shift, so the second transaction waits and re-evaluates. A materialized conflict row per shift is a last resort.

### mcq
A lock holder pauses for 30 s (GC), its lease expires, and another client acquires the lock. What prevents the paused client's late write from corrupting data?
- [ ] Synchronized clocks
- [x] A fencing token from the lock service that increases on every grant, checked by the storage service, which rejects writes with an older token
- [ ] A longer lease
- [ ] TCP
>>>
That's Chapter 8, Figures 8-4 and 8-5.

### tradeoff
A global registry needs unique usernames, decided immediately. Which mechanism is required, and what does it cost?
- [x] Linearizable compare-and-set, equivalent to consensus or total order broadcast; it costs latency on every claim and unavailability on the minority side of a network partition
- [ ] Lamport timestamps, at no cost
- [ ] LWW with NTP
- [ ] Eventual consistency with read repair
>>>
Chapter 9: Lamport timestamps decide only after the fact, and consensus is needed to decide now.

### scenario
A nightly MapReduce job joins 4 TB of clickstream with a 30 MB country-code table and writes results into a production MySQL database from its reducers. List two problems and a better design.
>>>
(1) Reduce-side join over 4 TB is wasteful when the small table fits in memory: use a broadcast hash join in the mappers, with no shuffle of 4 TB (Chapter 10). (2) Writing to production MySQL from tasks overloads the database and breaks the all-or-nothing output guarantee: retries and speculative execution cause partial or duplicate writes. Instead, write the output as files in the job's output directory, bulk-load them into a read-only serving store or a new table, and switch atomically, keeping the old version for rollback (Chapter 10, human fault tolerance).

### mcq
A consumer group's consumer crashes after processing messages 500–599 but having committed only offset 550. What happens on rebalance?
- [ ] Messages 550–599 are lost
- [x] The new owner resumes at 550, so 550–599 are processed again; effects must be idempotent or committed atomically with the offset
- [ ] The broker deduplicates them
- [ ] All 500–599 are reprocessed
>>>
That's Chapter 11's consumer offsets and exactly-once semantics.

### explain
Explain the difference between event time and processing time, and why it matters for a dashboard after a deployment.
>>>
Event time is when the event actually occurred, the timestamp in the event. Processing time is when the stream processor handles it, by the processor's clock. If the dashboard windows by processing time, a deployment that pauses the processor and then processes the backlog shows a dip followed by an artificial spike, although the real rate was steady (Figure 11-7). Windowing by event time shows the truth and makes reprocessing deterministic, but raises the question of when a window is complete. That's handled with watermarks, lateness allowances, and dropping or correcting stragglers (Chapter 11).

### design
Design the data architecture for a ride-sharing app's "trip receipts" feature across 2 regions: trips are written by the trip service; receipts must appear in the rider's history, a search index for support staff, and monthly finance reports; a receipt must never be lost or duplicated in finance. Cover the system of record, how derived systems are fed, consistency choices, and failure handling.
>>>
**System of record**: the trip service's database. Partition trips by trip ID with single-leader replication per partition, and replicate synchronously or semi-synchronously within the home region so committed trips survive failover. Elect leaders through consensus with fencing epochs (Chapters 5, 6, 9). **Event stream**: capture trip changes with CDC into a partitioned log, keyed by trip ID for per-trip order, preferably via an outbox or the WAL rather than dual writes (Chapter 11). **Derived systems**: (a) rider history, a materialized view keyed by rider and updated idempotently by trip ID and offset, accepting seconds of lag; read from the trip DB right after a trip ends for read-your-writes. (b) A support search index built from the CDC topic, rebuildable from a log-compacted topic. (c) Finance, a batch or streaming job that computes monthly totals by **event time** with watermarks, writes immutable output files, and swaps them atomically, so it can be rerun if logic changes (Chapters 10, 11). **Never lost or duplicated**: finance consumes with exactly-once effects, either storing input offsets in the same transaction as its aggregates or deduplicating by trip ID (Chapter 11). End-to-end, the trip service uses client-generated trip IDs with a uniqueness constraint so retried requests don't create duplicate trips (end-to-end argument). **Regions**: each trip's home region owns writes. The other region serves stale reads of history during a partition, and finance runs on the combined log after convergence (Chapter 9's CAP trade-off).
:::

:::connect After the exam
Grade, then schedule re-reading for your three weakest areas. Next: two capstone weeks building MiniKV, combining your own storage engine, encoding, replication, failover, partitioning and change stream into one working system.
:::
