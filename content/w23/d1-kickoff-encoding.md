---
title: Capstone Kickoff and Milestone 1 — Encoding Records
kind: project
minutes: 100
objectives:
- Understand MiniKV's architecture and how each module maps to a chapter
- Implement varints and framed, checksummed records
- Read old (v1) records with new (v2) code, and detect torn writes
reading:
- Re-read Thrift and Protocol Buffers (varints, field tags) | 113-117
- Re-read Avro (reader and writer schemas) | 118-122
complete:
- You read the whole capstone README and ran the test suite (everything fails, as expected)
- The M1_Encoding tests pass
- You answered the quiz
---

:::problem Two weeks, one system
You've built a dozen pieces of a database in this course. The capstone puts them together. **MiniKV** stores keys and values durably on disk, replicates each partition to three nodes, survives leader failure without split brain, spreads data over partitions, and publishes a change stream to a derived index. It's small (about 500 lines in the reference solution), but every part follows the book: nothing is mocked, and every failure mode you test is one the book describes.
:::

:::intuition The architecture
<div class="figure">
<svg class="dg" viewBox="0 0 660 220" role="img" aria-label="MiniKV architecture: cluster of partitions, each a replica set of nodes with LSM stores, plus a change consumer">
  <rect class="box" x="10" y="10" width="640" height="200" rx="10"/>
  <text x="24" y="32" font-weight="700">cluster.py — Cluster: key → crc32 % 8 → partition → group (M5)</text>
  <rect class="boxa" x="24" y="46" width="300" height="140" rx="8"/>
  <text x="36" y="66" font-weight="700">replication.py — ReplicaSet (one per partition)</text>
  <text x="36" y="84" class="sub">leader (epoch e) → log [seq, epoch, key, value] (M3)</text>
  <text x="36" y="100" class="sub">followers pull & apply; elect(), fencing, recover() (M4)</text>
  <rect class="boxb" x="36" y="112" width="84" height="62" rx="6"/><text x="78" y="132" text-anchor="middle">n1</text><text x="78" y="150" text-anchor="middle" class="sub">LSMStore</text>
  <rect class="boxb" x="128" y="112" width="84" height="62" rx="6"/><text x="170" y="132" text-anchor="middle">n2</text><text x="170" y="150" text-anchor="middle" class="sub">LSMStore</text>
  <rect class="boxb" x="220" y="112" width="84" height="62" rx="6"/><text x="262" y="132" text-anchor="middle">n3</text><text x="262" y="150" text-anchor="middle" class="sub">LSMStore</text>
  <rect class="boxe" x="350" y="46" width="290" height="62" rx="8"/>
  <text x="362" y="66" font-weight="700">storage.py — LSMStore (M2)</text>
  <text x="362" y="84" class="sub">WAL → memtable → SSTables (sparse index) → compaction</text>
  <text x="362" y="100" class="sub">encoding.py — framed records, CRC32, v1/v2 (M1)</text>
  <rect class="boxc" x="350" y="122" width="290" height="64" rx="8"/>
  <text x="362" y="142" font-weight="700">ChangeConsumer (M6)</text>
  <text x="362" y="160" class="sub">reads each leader's log as a change stream;</text>
  <text x="362" y="176" class="sub">derived index value → keys, idempotent by seq</text>
</svg>
</div>

**Today, Milestone 1: the record format.** Every record written to the WAL or an SSTable is framed as `[crc32][length varint][payload]`. The payload starts with a **version byte**. Version 2 adds a flags byte (tombstone, has-timestamp) and an optional timestamp. Version 1, the "old files", has neither, and **a v2 reader must still read v1 records**. That's the backward compatibility from Chapter 4, which requires new code to read old data. The **varint** is the same LEB128 encoding Protocol Buffers uses, so `encode_varint(300)` must produce `AC 02`, exactly as in Figure 4-4's field encoding.

**Why the checksum and length?** A crash can leave a half-written record at the end of the WAL. On recovery you must find where the good data ends, and you must never interpret garbage as a record. The length tells you where the record should end, and the checksum tells you whether it's intact (Chapter 3's "crash recovery" and "partially written records" for log-structured storage).
:::

:::practice 45-capstone-minikv | MiniKV — start with M1_Encoding
Read the README first. Then implement the four functions in `encoding.py` and run `python practice/45-capstone-minikv/test_minikv.py M1_Encoding`.
:::

:::quiz
### mcq
Why does the record frame include both a length and a CRC32 checksum?
- [ ] For compression
- [x] The length says where the record ends, and the checksum detects a torn or corrupted record, so recovery can stop at the last good record instead of reading garbage
- [ ] To sort records
- [ ] Because Protocol Buffers requires it
>>>
Log-structured storage must handle partially written records after a crash (Chapter 3).

### predict
A v2 reader encounters a v1 record (version byte 1). What must it do?
- [ ] Reject it
- [x] Decode it using the v1 layout (no flags, no timestamp), returning a record with no timestamp
- [ ] Treat it as a tombstone
- [ ] Re-encode the file first
>>>
New code reading old data is backward compatibility, which rolling upgrades and old files require (Chapter 4).

### mcq
What does `decode_stream` return for a buffer whose last record is cut off halfway?
- [ ] An exception
- [x] All complete, valid records before it, plus the byte offset where the valid data ends (so the WAL can be truncated there)
- [ ] Nothing
- [ ] The partial record with a null value
>>>
A torn final record was never acknowledged, so dropping it is safe.

### explain
Why is a version byte in every record useful even though MiniKV controls both the writer and the reader?
>>>
Data outlives code. Files written by an old version of MiniKV stay on disk after you upgrade, and during a rolling upgrade old and new nodes coexist and exchange records (Chapter 4). A version byte lets new code recognize and correctly decode old records (backward compatibility). If you design carefully, for example by putting new optional fields at the end behind flags, old code can at least detect records it can't understand instead of misreading them. Without it, changing the format would need a stop-the-world migration of every file.
:::

:::connect Tomorrow
Milestone 2: the LSM-tree storage engine that uses these records for its WAL and SSTables.
:::
