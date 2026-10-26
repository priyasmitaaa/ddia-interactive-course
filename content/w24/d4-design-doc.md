---
title: Measuring MiniKV and Writing DESIGN.md
kind: project
minutes: 100
objectives:
- Benchmark MiniKV's write and read latency with percentiles under different settings
- Write a complete design document with guarantees, failure modes, trade-offs and limitations
- Compare MiniKV honestly with a production system
reading:
- Re-read describing performance; percentiles | 11-17
complete:
- You produced a latency table (p50, p99, p999) for at least three configurations
- DESIGN.md is complete
- You answered the quiz
---

:::problem Numbers and words
A system isn't finished until you can say **what it guarantees**, **what it costs**, and **what it doesn't do**. Today you produce both halves: honest measurements and an honest document.
:::

:::intuition Benchmark with percentiles, then write it down
**Benchmark** (`bench.py`, about 40 lines, your own):
- Time 5,000 `put`s and 5,000 `get`s per configuration with `time.perf_counter()` per operation. Report **p50, p99 and p999**, not the mean (Chapter 1).
- Configurations: async vs semi-sync writes; memtable limit 16 vs 256; reads before and after `compact()`.
- Expect: `fsync` dominates write latency (look at your disk). Semi-sync roughly doubles the per-write work. Small memtables cause frequent flushes, which show up as **tail** latency spikes. Reads slow down as SSTables accumulate, and compaction restores them.
- Write down your machine (disk type, OS). Results on a laptop SSD and on a network disk differ wildly.

**DESIGN.md**, which should fit on 2–4 pages:
1. **Purpose and scope**: a teaching key-value store with a single process and a simulated network.
2. **Data model and API**: get, put, delete, and a change stream.
3. **Architecture**: the diagram from Week 23 Day 1, with each module and its chapter.
4. **Guarantees**: durability per mode, ordering, fencing, and what reads see (be precise, using the course's vocabulary).
5. **Failure modes**: a table of failures (node crash, crash mid-write, leader isolation, minority partition, majority loss, disk corruption) against MiniKV's behavior and which property holds.
6. **Trade-offs chosen**: async by default, a fixed partition count, full compaction, and an election stand-in instead of consensus, each with the alternative you rejected and why.
7. **Measurements**: your latency table, with an interpretation.
8. **Limitations and future work**: real networking, consensus (Raft), committed-only change streams, range partitioning, Bloom filters, incremental compaction, transactions.
:::

:::extra Compare with a real system
Pick one production store, for example etcd, Cassandra or CockroachDB. Using its documentation, fill in a column next to MiniKV's for each row of your failure-mode table. Where they differ, which chapter explains why? This is the five-question checklist from Week 17, applied. Documentation changes over time, so cite the version you read.
:::

:::practice 45-capstone-minikv | Benchmark and DESIGN.md
Write `bench.py` and `DESIGN.md` in `practice/45-capstone-minikv/`. Exercise 03's percentile code is reusable.
:::

:::quiz
### mcq
Why report p99 and p999 rather than the mean latency?
- [ ] They're easier to compute
- [x] The mean hides the slow tail that users actually notice (and that dominates fan-out requests); occasional flush or compaction stalls show up only in high percentiles
- [ ] Means are always wrong
- [ ] Because of clock skew
>>>
That's Chapter 1's "describing performance".

### predict
You shrink the memtable from 256 to 16 entries. What happens to write latency percentiles?
- [ ] Nothing
- [x] The median barely moves, but the tail grows: every 16th write triggers a flush (writing and fsyncing an SSTable), which shows up as p99/p999 spikes
- [ ] All writes get faster
- [ ] Writes fail
>>>
Background work done in the foreground shows up in the tail (Chapters 1 and 3).

### explain
Write the "Guarantees" paragraph of your DESIGN.md for reads.
>>>
A precise answer: "Reads from the current leader return the latest value written through that leader, as long as no failover is in progress. During a partition, a deposed leader that doesn't know it's deposed may serve stale reads, so MiniKV reads are not linearizable (Chapter 9). Reads from followers may be stale by up to the replication lag, with no read-your-writes guarantee unless the client reads from the leader. Within a partition, a follower's state always corresponds to a prefix of the leader's log, so it is never a state the leader didn't have (consistent prefix). There's no cross-partition snapshot, so reading two keys in different partitions can observe them at different points in time."
:::

:::connect Tomorrow
The capstone self-assessment: present MiniKV to yourself, or to a friend, and defend every design decision.
:::
