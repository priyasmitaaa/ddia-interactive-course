---
title: Capstone — MiniKV, a replicated, partitioned key-value store
chapter: 11
topic: Integrates Chapters 3–11 - encoding, LSM storage, replication, failover with fencing, partitioning, change streams
minutes: 600
---

## Objective

Build **MiniKV**, a small but honest distributed key-value store, from the ideas of the whole course, in six
milestones over two weeks:

| Milestone | File | Book | What you build |
|---|---|---|---|
| M1 Encoding | `encoding.py` | Ch 3, 4 | Varints, framed records with CRC32 checksums, a v2 format that still reads v1 data, torn-write detection |
| M2 Storage | `storage.py` | Ch 3 | An LSM-tree: WAL with crash recovery, memtable, SSTables with a sparse index, flush, compaction |
| M3 Replication | `replication.py` | Ch 5 | Leader-based replication with a sequence-numbered log; async and semi-sync writes; lagging follower reads |
| M4 Failover | `replication.py` | Ch 5, 8, 9 | Majority-gated elections with epochs; fencing a zombie leader; discarding divergent writes; lost async writes |
| M5 Partitioning | `cluster.py` | Ch 6 | Fixed hash partitions, routing, rebalancing by moving whole partitions |
| M6 Change stream | `cluster.py` | Ch 11 | CDC from each partition's log into a derived secondary index, idempotent by sequence number |

It runs in one process, with nodes as objects and a simulated network, so every failure scenario is
reproducible in a unit test. The architecture is the real one, though: every concept maps to a chapter and to an
exercise you already did, including 08 and 12 (storage engines), 14 and 15 (encoding), 19 (leader/follower),
22 and 23 (partitioning), 30 and 35 (fencing and elections), and 40 and 41 (logs and CDC).

## Setup

Python 3.10+, standard library only. Files in `practice/45-capstone-minikv/`: the four modules (with `TODO`s),
`test_minikv.py` (one test class per milestone), and `demo.py`, an end-to-end story to run when you're done.
A complete reference implementation is in `practice/_solutions/45-capstone-minikv/`. Use it only after a real attempt.
Run one milestone's tests at a time, for example:

```
python practice/45-capstone-minikv/test_minikv.py M1_Encoding
```

## Predict first

1. M2: your process crashes in the middle of appending a WAL record. On restart, what must the store do with that
   half-record, and why is that safe?
2. M4: the leader acknowledges a write with async replication and dies before any follower has it. A follower is
   elected. Where is the write now?
3. M4: an isolated old leader accepts a write and then reconnects. Which node rejects its log entry, and based on what?
4. M5: you go from 2 to 3 groups. Roughly what fraction of keys move with fixed partitions, and with `hash(key) mod N`?
5. M6: the derived index consumer loses its offsets and replays everything. What must be true of its apply step?

## Your task

Work through the milestones in order (the Week 23–24 lessons pace them):
1. **M1** `encoding.py`: `encode_varint`, `decode_varint`, `decode_payload`, `decode_stream` → `M1_Encoding`.
2. **M2** `storage.py`: `SSTable.get`, `_recover`, `put`, `get`, `flush`, `compact` → `M2_Storage`.
3. **M3** `replication.py`: `Node.apply`, `ReplicaSet.write` → `M3_Replication`.
4. **M4** `replication.py`: `elect`, `recover` → `M4_Failover`.
5. **M5** `cluster.py`: `put`, `get`, `add_group` → `M5_Partitioning`.
6. **M6** `cluster.py`: `ChangeConsumer.poll` → `M6_ChangeStream`.
7. Run `demo.py`, then write `DESIGN.md` (see the Week 24 lessons): your guarantees, failure modes and trade-offs.

## Run it

```
python practice/45-capstone-minikv/test_minikv.py
python practice/45-capstone-minikv/demo.py
```

## Observe

- **M1/M2**: kill-and-restart is safe because a write is acknowledged only after its WAL record is fsynced, and a
  torn final record fails its checksum and is truncated. It was never acknowledged, so nothing is lost.
- **M2**: the sparse index reads one block per SSTable lookup, and compaction collapses many files into one, dropping
  overwritten values and tombstones.
- **M3**: a follower read right after a write returns `None`. That's replication lag, not a bug. Semi-sync guarantees
  at least one follower has the write before the client hears "ok".
- **M4**: after an async failover the acknowledged write is gone (Chapter 5's warning, live). The zombie leader's
  entry is rejected with `StaleEpoch`, because fencing compares the **sender's** epoch, so the new leader may still ship
  old-epoch entries to a lagging follower. When the zombie recovers, its divergent entry is discarded and it rebuilds.
- **A "failed" write may still happen.** If a semi-sync write raises because no follower is reachable, the leader
  has *already* applied it, and it may replicate later. That's the same "a write reported as failed is not rolled
  back" behavior as the book's quorum writes (Chapter 5). The reference fuzzer (`_solutions/.../test_fuzz.py`) found
  this, and its model treats such writes as "maybe present". Clients should treat a failed write as *unknown* and retry
  idempotently.
- **M5**: adding a group moves only whole partitions, so only their keys move. `hash mod N` would move most keys.
- **M6**: the derived index survives redelivery because applying is idempotent by sequence number. The demo shows it
  staying consistent through failover and rebalancing.

## Questions

1. Which of MiniKV's guarantees are safety properties and which are liveness properties (Chapter 8)?
2. Is a read from MiniKV linearizable? Under which conditions? What would you change to make leader reads
   linearizable during a failover (Chapters 8 and 9)?
3. `elect()` is a stand-in for consensus. What could go wrong if two different processes ran elections concurrently,
   and what would a real implementation use (Chapter 9)?
4. M6 reads the leader's log. Suppose the consumer had already applied an entry that was later discarded during
   failover, like the zombie's write. What would the derived index show, and how would you prevent it?
5. Write one paragraph for your DESIGN.md: "MiniKV chooses ___ over ___ because ___".

<details><summary>Discussion</summary>

1. Safety: a fenced (stale-epoch) entry is never applied; replicas apply entries in sequence order without gaps; at most
   one node per epoch is the elected leader; the derived index never double-applies an entry. Liveness: an election
   eventually succeeds *if* a majority is reachable; followers eventually catch up; the consumer eventually reflects all
   committed writes. Safety holds even when no majority is available. Liveness doesn't (pp. 300–301).
2. Not in general. Follower reads are stale, and even leader reads can be stale if a zombie leader serves them after a new
   epoch started (p. 323). To fix it, have the leader confirm it still holds the current epoch with a majority before
   answering (a quorum read or "read index"), or use leases with a bounded clock-drift assumption (Chapters 8 and 9).
3. Two elections could each pick a leader for "epoch + 1", giving two leaders in the same epoch (split brain). A real
   implementation uses a consensus protocol in which each node votes at most once per epoch and a majority is required
   (Raft, Lab 35), or delegates the election to a coordination service such as ZooKeeper or etcd that issues
   monotonically increasing epochs, usable as fencing tokens (Chapter 9).
4. The index would contain a value that no longer exists in the cluster. That's a "phantom" derived from an uncommitted
   write. Prevent it by exposing only **committed** entries to change-stream consumers (entries replicated to a majority,
   or acknowledged under semi-sync), as consensus systems do with a commit index, or by having consumers handle
   log truncation by rewinding to the common prefix and rebuilding.
5. Example: "MiniKV chooses availability of writes on the majority side and asynchronous replication by default over
   zero data loss, because it targets low write latency; clients that cannot lose writes use semi-sync, accepting a
   follower round trip per write."
</details>
