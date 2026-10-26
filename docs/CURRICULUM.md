# Curriculum

Generated from `content/` by `tools/gen_curriculum.py`. 24 weeks × 6 days, about 1–2 hours a day;
day 6 of every week is a lighter review or checkpoint. Page numbers are the printed pages of the
Sixth Early Release PDF (PDF page = printed page + 22).

**Total:** 208 hours of scheduled study time, 45 hands-on exercises and labs.


## Week 1 — Reliable, Scalable and Maintainable Applications

*Part I · Foundations of Data Systems*

What “data-intensive” means, and the three goals that every later chapter serves: reliability (keep working when things break), scalability (cope with growth, described with real numbers), and maintainability (keep the system easy to run and change).

| Day | Lesson | Type | Minutes | Reading (printed pages) | Exercise |
|---|---|---|---|---|---|
| 1 | Welcome — What Is a Data-Intensive Application? |  | 80 | 1-4 | — |
| 2 | Reliability — Faults Are Not Failures |  | 85 | 4-8 | 01-fault-injection |
| 3 | Scalability — Describing Load (the Twitter Example) |  | 90 | 8-11 | 02-timeline-fanout |
| 4 | Describing Performance — Percentiles and Tail Latency |  | 95 | 11-14, 14-15 | 03-percentiles |
| 5 | Coping with Load, and Maintainability |  | 80 | 15-16, 16-20, 20-21 | — |
| 6 | Review — Chapter 1 Checkpoint | Review | 60 | 20-21 | — |

## Week 2 — Data Models and Query Languages

*Part I · Foundations of Data Systems*

How you model data shapes everything above it. Relational vs document vs graph; why many-to-many relationships are the dividing line; schema-on-read vs schema-on-write; and why declarative query languages beat imperative ones.

| Day | Lesson | Type | Minutes | Reading (printed pages) | Exercise |
|---|---|---|---|---|---|
| 1 | Relational vs Document — the Résumé Example |  | 90 | 25-26, 26-27, 28-31 | 04-document-vs-relational |
| 2 | Many-to-One, Many-to-Many — and Why History Repeats |  | 90 | 31-35, 35-38 | 04-document-vs-relational |
| 3 | Relational vs Document Today — Schemas and Locality |  | 85 | 38-40, 40-42 | 05-schema-on-read |
| 4 | Query Languages — Declarative, Imperative, and MapReduce |  | 85 | 42-43, 43-45, 45-48 | 06-declarative-vs-mapreduce |
| 5 | Graph-Like Data Models — Cypher, SPARQL, Datalog |  | 110 | 48-51, 51-55, 55-59, 59-62, 62-63 | 07-graph-queries |
| 6 | Review — Chapter 2 Checkpoint | Review | 60 | 62-63 | — |

## Week 3 — Storage Engines for Transactions — Logs, Hash Indexes, LSM-Trees, B-Trees

*Part I · Foundations of Data Systems*

One layer down: how does a database store your data and find it again? You'll build a log-structured key-value store yourself, then compare the two great families of storage engines — log-structured (LSM-trees) and update-in-place (B-trees).

| Day | Lesson | Type | Minutes | Reading (printed pages) | Exercise |
|---|---|---|---|---|---|
| 1 | The Simplest Database, and Hash Indexes |  | 90 | 67-68, 68-70, 70-74 | — |
| 2 | Lab — Build Your Own Log-Structured Key-Value Store | Lab | 110 | 72-73 | 08-bitcask |
| 3 | SSTables and LSM-Trees |  | 90 | 74-77 | — |
| 4 | B-Trees — Pages, Splits and the Write-Ahead Log |  | 90 | 77-80, 80-81, 81 | — |
| 5 | B-Trees vs LSM-Trees, Secondary Indexes, and In-Memory Databases |  | 100 | 81-82, 82-85, 85-87 | 09-sqlite-indexes |
| 6 | Review — Storage Engines Checkpoint | Review | 60 | 100-101 | — |

## Week 4 — Storage for Analytics — Warehouses, Column Stores, and an LSM Lab

*Part I · Foundations of Data Systems*

OLTP looks up a few rows by key; analytics scans millions of rows but only a few columns. That difference leads to data warehouses, star schemas, column-oriented storage with compression, and precomputed aggregates. The week ends with building your own LSM-tree.

| Day | Lesson | Type | Minutes | Reading (printed pages) | Exercise |
|---|---|---|---|---|---|
| 1 | Transaction Processing or Analytics? |  | 75 | 87-88, 88-90 | — |
| 2 | Stars and Snowflakes — Schemas for Analytics |  | 85 | 90-93 | 10-star-schema |
| 3 | Column-Oriented Storage and Compression |  | 95 | 93-94, 94-96, 96 | 11-column-store |
| 4 | Sort Order, Writing to Column Stores, and Data Cubes |  | 80 | 96-97, 98, 98-100, 100-101 | 11-column-store |
| 5 | Lab — Build Your Own LSM-Tree | Lab | 115 | 74-77 | 12-lsm-tree |
| 6 | Review — Chapter 3 Checkpoint | Checkpoint | 70 | 100-101 | — |

## Week 5 — Encoding and Evolution

*Part I · Foundations of Data Systems*

Old and new code, and old and new data, must coexist. How data is turned into bytes — JSON, Protocol Buffers, Thrift, Avro — decides whether you can upgrade one server at a time. Then: data flowing through databases, services (REST/RPC) and message brokers.

| Day | Lesson | Type | Minutes | Reading (printed pages) | Exercise |
|---|---|---|---|---|---|
| 1 | Why Encoding Matters — Compatibility, JSON and Binary JSON |  | 85 | 107-108, 108-110, 110-113 | 13-encoding-pitfalls |
| 2 | Thrift and Protocol Buffers — Field Tags and Schema Evolution |  | 95 | 113-116, 116-117, 117 | 14-protobuf-by-hand |
| 3 | Avro — Writer's Schema, Reader's Schema, and the Merits of Schemas |  | 95 | 118-120, 120-122, 122-123, 123-124 | 15-avro-resolution |
| 4 | Data Flow Through Databases and Services (REST and RPC) |  | 95 | 124-127, 127-130, 129-132 | 16-rolling-upgrade |
| 5 | Message Passing, Actors — and Part I in One Picture |  | 80 | 132-134, 134-135, 135-136 | — |
| 6 | Review — Chapter 4 Checkpoint | Checkpoint | 65 | 135-136 | — |

## Week 6 — Part I Consolidation — Project 1 and the Part I Exam

*Part I · Foundations of Data Systems*

No new chapter this week. You evolve your log-structured store through four milestones that each apply an idea from Chapters 1, 3 and 4, measure it against SQLite, write a short design document, and take a cumulative Part I exam.

| Day | Lesson | Type | Minutes | Reading (printed pages) | Exercise |
|---|---|---|---|---|---|
| 1 | Project 1, Day 1 — Hint Files and Fast Restarts | Project | 100 | 72-73 | 17-project1-kv |
| 2 | Project 1, Day 2 — Changing the Format Without Breaking Old Data | Project | 100 | 125-127 | 17-project1-kv |
| 3 | Project 1, Day 3 — Group Commit and Background Compaction | Project | 110 | 71-72, 81-82 | 17-project1-kv |
| 4 | Project 1, Day 4 — Measure Against SQLite and Write the Design Doc | Project | 90 | 11-14, 81-82 | 17-project1-kv |
| 5 | Part I Exam — Foundations of Data Systems | Checkpoint | 90 | — | — |
| 6 | Review — Catch Up and Prepare for Part II | Review | 60 | 141-142 | — |

## Week 7 — Replication I — Leaders, Followers and Replication Lag

*Part II · Distributed Data*

Part II begins: data on many machines. This week covers single-leader replication — synchronous vs asynchronous followers, adding followers, surviving node failures and the dangers of failover, how replication logs are implemented, and the strange anomalies replication lag causes for users.

| Day | Lesson | Type | Minutes | Reading (printed pages) | Exercise |
|---|---|---|---|---|---|
| 1 | Distributing Data, and Leader-Based Replication |  | 85 | 141-143, 145-147, 147-149 | — |
| 2 | New Followers, Node Outages, and the Perils of Failover |  | 85 | 149-150, 150-152 | — |
| 3 | Implementing Replication Logs |  | 80 | 152-155 | 18-replication-logs |
| 4 | Problems with Replication Lag |  | 95 | 155-156, 156-158, 158-159, 159-161 | — |
| 5 | Lab — Build Leader-Based Replication | Lab | 110 | 147-149, 150-152 | 19-leader-follower |
| 6 | Review — Single-Leader Replication | Review | 60 | 186-187 | — |

## Week 8 — Replication II — Multiple Leaders, No Leader, and Concurrent Writes

*Part II · Distributed Data*

What if more than one node accepts writes? Multi-leader replication (for multiple datacenters, offline clients and collaborative editing) and leaderless, Dynamo-style replication with quorums. Both allow concurrent writes, so you'll learn to detect them (happens-before, version vectors) and resolve them without losing data.

| Day | Lesson | Type | Minutes | Reading (printed pages) | Exercise |
|---|---|---|---|---|---|
| 1 | Multi-Leader Replication and Write Conflicts |  | 95 | 161-164, 164-167, 167-168 | — |
| 2 | Multi-Leader Topologies and Causality |  | 70 | 168-171 | — |
| 3 | Leaderless Replication and Quorums |  | 90 | 171, 171-173, 173-175 | — |
| 4 | Limits of Quorums, Sloppy Quorums and Hinted Handoff |  | 90 | 175-177, 177-178 | 20-quorum-staleness |
| 5 | Detecting Concurrent Writes — Happens-Before and Version Vectors |  | 110 | 178-180, 180-181, 181-185, 185-187 | 21-version-vectors |
| 6 | Review — Chapter 5 Checkpoint | Checkpoint | 70 | 186-187 | — |

## Week 9 — Partitioning (Sharding)

*Part II · Distributed Data*

When data or load outgrows one machine, split it. Partitioning by key range vs by hash, hot spots and how to relieve them, how secondary indexes interact with partitions, how to rebalance when nodes come and go, and how a request finds the right node.

| Day | Lesson | Type | Minutes | Reading (printed pages) | Exercise |
|---|---|---|---|---|---|
| 1 | Partitioning Key-Value Data — Ranges, Hashes and Hot Spots |  | 95 | 191-193, 193-195, 195-196, 196-197 | — |
| 2 | Partitioning and Secondary Indexes |  | 80 | 197-198, 198-199, 200 | — |
| 3 | Rebalancing Partitions |  | 95 | 201-204, 204-205 | 22-rebalancing |
| 4 | Request Routing and Parallel Queries |  | 75 | 205-207, 207-209 | — |
| 5 | Lab — Build a Partitioned Key-Value Store | Lab | 105 | 201-203, 205-207 | 23-partitioned-kv |
| 6 | Review — Chapter 6 Checkpoint | Checkpoint | 65 | 208-209 | — |

## Week 10 — Transactions I — ACID, Atomicity and Weak Isolation

*Part II · Distributed Data*

Transactions are an abstraction that lets an application pretend whole classes of failures and concurrency problems don't exist. This week: what ACID really means, why multi-object transactions matter, and the weak isolation levels that most databases use by default — read committed and snapshot isolation — plus the lost-update problem.

| Day | Lesson | Type | Minutes | Reading (printed pages) | Exercise |
|---|---|---|---|---|---|
| 1 | The Slippery Concept of a Transaction — What ACID Really Means |  | 85 | 213-214, 214-216, 216-218, 218-219 | — |
| 2 | Single-Object and Multi-Object Operations; Handling Aborts |  | 85 | 219-221, 221-223, 223-224 | 24-atomicity |
| 3 | Weak Isolation I — Read Committed |  | 85 | 224-225, 225-227, 227-228 | — |
| 4 | Snapshot Isolation and MVCC |  | 95 | 228-230, 230-232, 232-233 | — |
| 5 | Preventing Lost Updates |  | 95 | 233-235, 235-236, 237 | 25-lost-updates |
| 6 | Review — ACID and Weak Isolation | Review | 60 | 257-258 | — |

## Week 11 — Transactions II — Write Skew, Phantoms and Serializability

*Part II · Distributed Data*

The subtlest race conditions: write skew and phantoms, which slip past snapshot isolation. Then the three ways databases provide true serializability — actual serial execution, two-phase locking, and serializable snapshot isolation — and you build MVCC + SSI yourself.

| Day | Lesson | Type | Minutes | Reading (printed pages) | Exercise |
|---|---|---|---|---|---|
| 1 | Write Skew and Phantoms |  | 95 | 237-240, 240-241, 241-242 | — |
| 2 | Serializability I — Actual Serial Execution |  | 85 | 242-243, 243-246, 246-248 | 27-serial-execution |
| 3 | Serializability II — Two-Phase Locking |  | 90 | 248-249, 249-250, 250-252 | — |
| 4 | Serializability III — Serializable Snapshot Isolation (SSI) |  | 95 | 252-253, 253-255, 255-257, 257-259 | — |
| 5 | Lab — Build MVCC and Serializable Snapshot Isolation | Lab | 110 | 230-232, 254-256 | 26-mvcc-ssi |
| 6 | Review — Chapter 7 Checkpoint | Checkpoint | 70 | 257-259 | — |

## Week 12 — The Trouble with Distributed Systems I — Networks, Clocks and Pauses

*Part II · Distributed Data*

Chapter 8 turns pessimism up to the maximum. This week covers the three things a node can't trust. The first is the network: messages get lost or delayed, and a missing reply tells you nothing. The second is its clock: clocks drift, jump and disagree. The third is its own execution, which can be paused at any moment without the node noticing. You'll measure the timeout trade-off, watch last-write-wins drop writes because of a 3 ms skew, and see a paused lease holder corrupt data.

| Day | Lesson | Type | Minutes | Reading (printed pages) | Exercise |
|---|---|---|---|---|---|
| 1 | Faults, Partial Failures and Unreliable Networks |  | 80 | 265-266, 266-267, 267-269, 269-271, 271-272 | — |
| 2 | Detecting Faults, Timeouts and Unbounded Delays |  | 95 | 272-273, 273-274, 274-276, 276-277, 277-278 | 28-failure-detectors |
| 3 | Unreliable Clocks — Monotonic vs Time-of-Day, Drift and NTP |  | 85 | 278-279, 279-281, 281-282 | 29-clocks-lww |
| 4 | Relying on Synchronized Clocks — LWW, Confidence Intervals and Spanner |  | 95 | 282-283, 283-284, 284-285, 285-286 | 29-clocks-lww |
| 5 | Process Pauses, Leases and Real-Time Guarantees |  | 90 | 287-289, 289-290, 290-291 | — |
| 6 | Review — Networks, Clocks and Pauses | Review | 60 | 302-302 | — |

## Week 13 — The Trouble with Distributed Systems II — Knowledge, Truth and Lies

*Part II · Distributed Data*

If no node can trust its own perception, how does a distributed system decide anything? This week covers majorities and quorums, why "I hold the lock" is only a belief, and fencing tokens, the simple trick that makes stale lock holders harmless. Then Byzantine faults and when they matter. Finally, system models plus safety and liveness, the vocabulary Chapter 9's algorithms are built on. In the lab you build a lease service with fencing and a safety-property checker.

| Day | Lesson | Type | Minutes | Reading (printed pages) | Exercise |
|---|---|---|---|---|---|
| 1 | Truth Is Defined by the Majority — Leaders, Locks and Fencing Tokens |  | 90 | 291-292, 292-293, 293-294, 294-295 | — |
| 2 | Byzantine Faults and Weak Forms of Lying |  | 70 | 295-297, 297-298 | — |
| 3 | System Models, Safety and Liveness |  | 85 | 298-299, 299-300, 300-301, 301-302, 302-303 | — |
| 4 | Lab — Leases, GC Pauses and Fencing Tokens | Lab | 100 | 293-295, 299-300 | 30-fencing-lab |
| 5 | Case Study — Anatomy of a Split-Brain Incident |  | 75 | 293-295, 302-303 | — |
| 6 | Review — Chapter 8 Checkpoint | Checkpoint | 70 | 302-303 | — |

## Week 14 — Consistency and Consensus I — Linearizability

*Part II · Distributed Data*

Chapter 9 moves from problems to solutions: general-purpose abstractions that let applications ignore some distributed-systems faults. This week covers the strongest common one, linearizability: make a replicated system behave as if there were a single copy of the data. You'll judge histories with a checker, see why strict quorums aren't enough, work out what CAP actually says, and build your own checker to catch a stale read.

| Day | Lesson | Type | Minutes | Reading (printed pages) | Exercise |
|---|---|---|---|---|---|
| 1 | Consistency Guarantees and Linearizability |  | 90 | 311-312, 312-313, 314-315, 315-319 | — |
| 2 | Linearizability vs Serializability, and When You Need It |  | 85 | 319-320, 320-321, 321-322, 322-323 | — |
| 3 | Implementing Linearizable Systems — Replication and Quorums |  | 85 | 323-324, 324-325 | — |
| 4 | The Cost of Linearizability — CAP and Network Delays |  | 85 | 326-327, 327-328, 328-329 | — |
| 5 | Lab — Build a Linearizability Checker | Lab | 100 | 315-319, 323-324 | 31-linearizability-checker |
| 6 | Review — Linearizability | Review | 60 | 363-363 | — |

## Week 15 — Consistency and Consensus II — Ordering, Causality and Total Order Broadcast

*Part II · Distributed Data*

Ordering has been a recurring theme in this book: replication logs, serializability, timestamps. This week digs into why. Causality gives a partial order of events, and linearizability gives a total one. Lamport timestamps order events consistently with causality, but they aren't enough to enforce uniqueness. Total order broadcast is, and it turns out to be equivalent to linearizable compare-and-set and to consensus.

| Day | Lesson | Type | Minutes | Reading (printed pages) | Exercise |
|---|---|---|---|---|---|
| 1 | Ordering and Causality |  | 85 | 329-330, 330-331, 331-332, 332-333 | — |
| 2 | Tracking Causality, Sequence Numbers and Lamport Timestamps |  | 95 | 333-334, 334-335, 335-336, 336-337 | 32-logical-clocks |
| 3 | Timestamp Ordering Is Not Sufficient — Total Order Broadcast |  | 90 | 337-338, 338-339, 339-340 | — |
| 4 | Linearizable Storage and Total Order Broadcast — Two Sides of One Coin |  | 95 | 340-342, 342-342 | 33-total-order-log |
| 5 | Case Study — Choosing Ordering Guarantees for a Social App |  | 75 | 330-333, 338-342 | — |
| 6 | Review — Ordering, Causality and Total Order Broadcast | Review | 60 | 363-364 | — |

## Week 16 — Consistency and Consensus III — Atomic Commit and Consensus

*Part II · Distributed Data*

Finally, consensus: getting nodes to agree, irrevocably. The week starts with atomic commit and two-phase commit: its system of promises, why it blocks when the coordinator fails, and why XA transactions have a mixed reputation. Then come fault-tolerant consensus algorithms (Paxos, Raft, Zab, Viewstamped Replication), built on epochs and quorums, and ZooKeeper, the service that lets applications outsource consensus.

| Day | Lesson | Type | Minutes | Reading (printed pages) | Exercise |
|---|---|---|---|---|---|
| 1 | Consensus, the FLP Result and Atomic Commit |  | 80 | 343-344, 344-344, 344-346 | — |
| 2 | Two-Phase Commit — Promises, Coordinator Failure and 3PC |  | 95 | 346-347, 347-348, 348-349, 350-350 | — |
| 3 | Distributed Transactions in Practice — XA, In-Doubt Locks and Their Limits |  | 85 | 350-351, 351-351, 352-352, 352-353, 354-354 | — |
| 4 | Fault-Tolerant Consensus — Properties, Epochs and Quorums |  | 100 | 355-356, 356-357, 357-358, 358-359 | — |
| 5 | Limits of Consensus, and Coordination Services like ZooKeeper |  | 90 | 359-360, 360-361, 361-362, 362-363, 363-365 | — |
| 6 | Review — Chapter 9 Checkpoint | Checkpoint | 70 | 363-365 | — |

## Week 17 — Part II Consolidation — Labs, Design and the Part II Exam

*Part II · Distributed Data*

A week to make Part II stick. You build two-phase commit with crash recovery and fuzz-test a leader election protocol. You design a multi-region system using everything from replication to consensus, and learn to read distributed-systems papers and Jepsen reports. Then the Part II exam, covering Chapters 5–9.

| Day | Lesson | Type | Minutes | Reading (printed pages) | Exercise |
|---|---|---|---|---|---|
| 1 | Lab — Two-Phase Commit with Crash Recovery | Lab | 110 | 347-349, 352-353 | 34-two-phase-commit |
| 2 | Lab — Leader Election with Terms and Quorums | Lab | 100 | 358-359, 355-356 | 35-leader-election |
| 3 | Case Study — Designing a Multi-Region Order System with Part II |  | 100 | 363-365 | — |
| 4 | Reading Distributed-Systems Papers and Jepsen Reports | Beyond the PDF | 75 | 365-365 | — |
| 5 | Part II Exam — Distributed Data (Chapters 5–9) | Checkpoint | 110 | 363-365 | — |
| 6 | Review — Part II Wrap-Up | Review | 60 | 365-365 | — |

## Week 18 — Derived Data and Batch Processing I — Unix, MapReduce and Joins

*Part III · Derived Data*

Part III turns from a single database to systems built from many. This week covers systems of record vs derived data, and batch processing: the Unix philosophy, MapReduce on a distributed filesystem, and the join and grouping algorithms that make batch jobs useful. You'll write an external merge sort, then build a small MapReduce engine with retries and a sort-merge join.

| Day | Lesson | Type | Minutes | Reading (printed pages) | Exercise |
|---|---|---|---|---|---|
| 1 | Derived Data, Batch Processing and the Unix Log Pipeline |  | 85 | 375-376, 377-379, 379-381, 381-382 | — |
| 2 | The Unix Philosophy — Composition, Uniform Interfaces and Experimentation |  | 80 | 382-383, 383-384, 384-385, 385-385 | 36-external-sort |
| 3 | MapReduce and Distributed Filesystems |  | 95 | 385-386, 387-388, 388-390, 390-391 | — |
| 4 | Reduce-Side Joins, Grouping and Skew |  | 95 | 391-392, 392-393, 393-394, 394-395, 395-396 | — |
| 5 | Lab — Build a Tiny MapReduce Engine | Lab | 110 | 388-390, 393-394 | 37-mapreduce |
| 6 | Review — Unix, MapReduce and Joins | Review | 60 | 416-417 | — |

## Week 19 — Batch Processing II — Map-Side Joins, Outputs and Beyond MapReduce

*Part III · Derived Data*

This week finishes Chapter 10. It covers faster map-side joins, what batch jobs actually produce (search indexes, read-only key-value stores) and the philosophy of immutable inputs and replaceable outputs. Then MapReduce vs MPP databases, and why MapReduce was designed for constant preemption. After that, dataflow engines such as Spark, Flink and Tez, the need for deterministic operators, and Pregel for graphs.

| Day | Lesson | Type | Minutes | Reading (printed pages) | Exercise |
|---|---|---|---|---|---|
| 1 | Map-Side Joins — Broadcast, Partitioned and Merge |  | 75 | 396-397, 397-397, 398-398 | — |
| 2 | The Output of Batch Workflows — Indexes, Key-Value Stores and Human Fault Tolerance |  | 80 | 398-399, 399-400, 400-401, 401-402 | — |
| 3 | MapReduce vs Distributed Databases — Storage, Processing Models and Faults |  | 85 | 402-403, 403-404, 404-405, 405-406 | — |
| 4 | Beyond MapReduce — Materialization and Dataflow Engines |  | 95 | 406-407, 407-408, 408-410, 410-411, 411-411 | 38-deterministic-operators |
| 5 | Graphs and Pregel, High-Level APIs, and the Chapter 10 Summary |  | 110 | 411-412, 412-414, 414-415, 415-416, 416-416, 416-418 | 39-pregel |
| 6 | Review — Chapter 10 Checkpoint | Checkpoint | 70 | 416-418 | — |

## Week 20 — Stream Processing I — Brokers, Logs and Databases as Streams

*Part III · Derived Data*

Batch processing assumed bounded input, and streams never end. This week covers how event streams are transmitted: direct messaging, traditional message brokers with acknowledgments and redelivery, and log-based brokers with partitions and offsets. Then the deep connection between databases and streams: change data capture, log compaction, event sourcing, and the idea that state is just the integral of a stream of changes. You'll build a log broker, CDC into a search index, and an event-sourced reservation system.

| Day | Lesson | Type | Minutes | Reading (printed pages) | Exercise |
|---|---|---|---|---|---|
| 1 | Transmitting Event Streams — Events, Messaging Systems and Brokers |  | 85 | 425-426, 426-427, 427-428, 428-429, 429-430 | — |
| 2 | Multiple Consumers, Acknowledgments and Redelivery |  | 70 | 430-431, 431-432 | — |
| 3 | Partitioned Logs — Kafka-Style Message Brokers |  | 95 | 432-433, 433-434, 434-435, 435-435, 435-436, 436-436 | 40-log-broker |
| 4 | Databases and Streams — Keeping Systems in Sync with Change Data Capture |  | 95 | 436-437, 437-439, 439-440, 440-441, 441-442 | 41-cdc |
| 5 | Event Sourcing, Immutability and Deriving State |  | 100 | 442-442, 442-443, 443-444, 444-445, 445-446, 446-447, 447-447, 447-448 | 42-event-sourcing |
| 6 | Review — Brokers, Logs and Databases as Streams | Review | 60 | 462-463 | — |

## Week 21 — Stream Processing II — Processing, Time, Windows, Joins and Exactly-Once

*Part III · Derived Data*

What you do with a stream once you have it. This week covers the uses of stream processing (complex event processing, analytics, materialized views and search on streams), then why time is so hard: event time vs processing time, stragglers, and whose clock to trust. Then the four window types and three kinds of stream join, and finally how stream processors achieve exactly-once results despite crashes. You'll build windowed aggregations and joins, then an exactly-once processor.

| Day | Lesson | Type | Minutes | Reading (printed pages) | Exercise |
|---|---|---|---|---|---|
| 1 | Processing Streams — CEP, Analytics, Materialized Views and Search |  | 80 | 448-449, 449-450, 450-451, 451-452, 452-452 | — |
| 2 | Reasoning About Time — Event Time, Processing Time and Stragglers |  | 90 | 452-453, 453-454, 454-455, 455-456 | — |
| 3 | Windows and Stream Joins |  | 100 | 456-456, 457-457, 457-458, 458-459, 459-460 | 43-windows-joins |
| 4 | Fault Tolerance in Stream Processing — Exactly-Once Semantics |  | 95 | 460-460, 460-461, 461-461, 461-462, 462-462, 462-464 | — |
| 5 | Lab — An Exactly-Once Stream Processor | Lab | 100 | 461-462, 462-462 | 44-exactly-once |
| 6 | Review — Chapter 11 Checkpoint | Checkpoint | 70 | 462-464 | — |

## Week 22 — Beyond the PDF — The Future of Data Systems, and the Final Exam

*Supplement · Beyond the early release*

Your PDF is an early release that ends after Chapter 11. The published edition adds a final chapter on where data systems are heading. This week is clearly marked supplementary material. It covers those themes (data integration through derived data, "unbundling" the database, correctness end to end, and ethics), plus a short, hedged tour of developments since 2016. It ends with the cumulative final exam over Chapters 1–11. None of the supplementary lessons cite page numbers, because they go beyond what your PDF contains.

| Day | Lesson | Type | Minutes | Reading (printed pages) | Exercise |
|---|---|---|---|---|---|
| 1 | Data Integration — Combining Tools by Deriving Data | Beyond the PDF | 80 | — | — |
| 2 | Unbundling the Database, and Aiming for Correctness | Beyond the PDF | 85 | — | — |
| 3 | What Changed Since 2016 — A Hedged Tour | Beyond the PDF | 75 | — | — |
| 4 | Doing the Right Thing — Data, People and Responsibility | Beyond the PDF | 60 | — | — |
| 5 | Final Exam — Chapters 1–11 | Checkpoint | 120 | — | — |
| 6 | Review — Consolidating the Whole Book | Review | 60 | — | — |

## Week 23 — Capstone I — MiniKV Storage, Encoding, Replication and Failover

*Capstone*

Two weeks to build MiniKV, a small replicated, partitioned key-value store, from your own understanding of the book. This week covers the single-node core: a binary record format with checksums and schema evolution, an LSM-tree storage engine with crash recovery, leader-based replication, and failover with epochs and fencing. Each day is a milestone with its own tests.

| Day | Lesson | Type | Minutes | Reading (printed pages) | Exercise |
|---|---|---|---|---|---|
| 1 | Capstone Kickoff and Milestone 1 — Encoding Records | Project | 100 | 113-117, 118-122 | 45-capstone-minikv |
| 2 | Milestone 2 — An LSM-Tree with a Write-Ahead Log | Project | 110 | 70-74, 74-80 | 45-capstone-minikv |
| 3 | Milestone 2, Part 2 — Compaction and Storage Guarantees | Project | 90 | 74-80 | 45-capstone-minikv |
| 4 | Milestone 3 — Leader-Based Replication | Project | 100 | 146-149, 152-155 | 45-capstone-minikv |
| 5 | Milestone 4 — Failover, Epochs and Fencing | Project | 110 | 150-152, 293-295, 358-359 | 45-capstone-minikv |
| 6 | Review — Capstone Week 1 Checkpoint | Review | 60 | 186-187 | — |

## Week 24 — Capstone II — Partitioning, Change Streams, Testing and Wrap-Up

*Capstone*

The second capstone week scales MiniKV out and connects it to the rest of a data system. You'll partition the key space and rebalance without moving keys needlessly, then publish each partition's log as a change stream feeding a derived index. Then you'll test MiniKV like a real distributed system, write up its design and guarantees, assess yourself, and plan what to learn next.

| Day | Lesson | Type | Minutes | Reading (printed pages) | Exercise |
|---|---|---|---|---|---|
| 1 | Milestone 5 — Partitioning, Routing and Rebalancing | Project | 100 | 195-197, 201-204, 205-207 | 45-capstone-minikv |
| 2 | Milestone 6 — The Change Stream and a Derived Index | Project | 90 | 435-436, 439-442 | 45-capstone-minikv |
| 3 | Testing MiniKV — Properties, Faults and Histories | Project | 100 | 299-301, 315-319 | 45-capstone-minikv |
| 4 | Measuring MiniKV and Writing DESIGN.md | Project | 100 | 11-17 | 45-capstone-minikv |
| 5 | Capstone Assessment — Defend Your Design | Checkpoint | 100 | — | — |
| 6 | Final Review — Keeping It, and What Next | Review | 60 | — | — |

