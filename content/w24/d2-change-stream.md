---
title: Milestone 6 — The Change Stream and a Derived Index
kind: project
minutes: 90
objectives:
- Consume every partition leader's log as a change stream with per-partition offsets
- Maintain a derived secondary index (value → keys) idempotently
- Explain the committed-vs-uncommitted problem for change-stream consumers
reading:
- Re-read consumer offsets | 435-436
- Re-read change data capture; log compaction | 439-442
complete:
- All M6_ChangeStream tests pass, and demo.py runs end to end
- You wrote the change-stream section of DESIGN.md
- You answered the quiz
---

:::problem MiniKV is a system of record. What derives from it?
Chapter 11's lesson: the replication log is a stream of every change. Milestone 6 exposes it. A `ChangeConsumer` reads each partition leader's log and maintains a **derived index** ("which keys currently have value v?"), the same pattern as CDC feeding a search index (Figure 11-5).
:::

:::intuition Offsets, idempotence, and only committed entries
- **Per-partition offset**: the consumer remembers, per partition, the last sequence number it applied, which is exactly a consumer offset (Chapter 11). Ordering is guaranteed within a partition, and none is needed across partitions, because each key lives in exactly one partition.
- **Idempotent apply**: skip entries with `seq <= offset`. If offsets are lost and everything is redelivered, applying again yields the same index. Applying a change means removing the key from its old value's set and adding it to the new one, and tombstones remove it.
- **The committed-entry problem.** The consumer reads the **leader's** log. If it reads an entry that is later **discarded** during failover, like M4's zombie or lost async writes, the index shows a value that no longer exists. MiniKV's simple consumer has this flaw, and the tests avoid triggering it. Production systems expose only **committed** entries to consumers (Raft's commit index, Kafka's high watermark), or handle log truncation by rewinding.

**DESIGN.md, change-stream section**: the consumer's guarantees (eventually reflects all applied writes, idempotent under redelivery, per-key order); its lag; the committed-entry limitation and how you'd fix it; how a new consumer would bootstrap (snapshot plus position, or a compacted log, Chapter 11).
:::

:::practice 45-capstone-minikv | M6 — change stream, then run demo.py
Implement `ChangeConsumer.poll`. Run `test_minikv.py M6_ChangeStream`, then the whole suite, then `python practice/45-capstone-minikv/demo.py`.
:::

:::quiz
### mcq
Why is it enough for the consumer to preserve order within each partition, but not across partitions?
- [ ] Partitions never change
- [x] Every key lives in exactly one partition, so all changes to a key are ordered within that partition; changes to different keys don't depend on each other for this index
- [ ] Because of semi-sync
- [ ] It isn't enough
>>>
That's per-partition total order (Chapter 11). Cross-key invariants would need more.

### predict
The consumer loses its offsets and re-reads every log from the start. What does the derived index look like afterwards?
- [ ] Every key appears twice
- [x] Exactly the same as before: applying a change is idempotent (remove from the old value, add to the new), so replaying yields the same state
- [ ] Empty
- [ ] Corrupted
>>>
Idempotent derivation is what makes replay safe (Chapter 11).

### mcq
What goes wrong if the consumer reads an entry that the leader later loses in a failover?
- [ ] Nothing
- [x] The derived index contains a value the cluster no longer has, because derived data was built from an uncommitted write
- [ ] The consumer crashes
- [ ] The new leader resends it
>>>
Expose only committed entries (a majority or high-watermark), or rewind on truncation.

### explain
How would you add a second derived system, for example "count of keys per value", without touching MiniKV's write path?
>>>
Start a second, independent consumer with its own offsets. It reads the same partition logs from the beginning, or from a consistent snapshot plus position if logs are truncated, and maintains its own derived state, here counts per value: decrement the old value's count and increment the new one, idempotently by sequence number. The write path is unchanged because derived systems are just additional followers of the change stream (Figure 11-5), the fan-out property of log-based messaging (Chapter 11). Being derived, the new view can be rebuilt any time, and run alongside the old one before switching readers over.
:::

:::connect Tomorrow
Testing MiniKV the way the book suggests: properties, fault injection and recorded histories.
:::
