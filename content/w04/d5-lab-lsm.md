---
title: Lab — Build Your Own LSM-Tree
kind: lab
minutes: 115
chapter: 3
objectives:
- Implement a Bloom filter and explain its false-positive behaviour
- Write SSTables with a sparse index and read them with one block read
- Implement the LSM write path (WAL, memtable, flush) and read path (newest-first)
- Implement range scans and compaction as k-way merges
reading:
- Re-read SSTables and LSM-trees | 74-77
complete:
- At least tests T1–T3 pass (T4 scan/compact is a stretch)
- You can explain each file in the data directory
- You answered the quiz
---

:::note Today is a building day
You built a hash-indexed log in Week 3; today you build its sorted cousin. About 90 minutes of coding. The file formats, record encoding and loading code are given so you can focus on the ideas: Bloom filters, sparse indexes, the write path, the read path, and merging. Same rule as before: stuck for 20 minutes → peek at `practice/_solutions/12-lsm-tree/lsm.py`, close it, write your own.
:::

:::intuition A Bloom filter in one minute
A **Bloom filter** is an array of *m* bits plus *k* hash functions. To **add** a key, set the *k* bit positions it hashes to. To **query**, check those *k* positions: if any is 0, the key was **definitely never added**; if all are 1, it was **probably** added (other keys may have set those bits — a false positive).

With *n* keys, the false-positive rate is roughly (1 − e<sup>−kn/m</sup>)<sup>k</sup>. For the defaults in the lab — *m* = 8192 bits, *k* = 4, and 500 keys — that's about (1 − e<sup>−0.244</sup>)⁴ ≈ 0.2%: one wasted disk read in 500 lookups of missing keys, for a 1 KB filter. That's why LevelDB keeps one per SSTable in memory (p. 77).

The test `test_few_false_positives` checks you're in that range.
:::

:::practice 12-lsm-tree | Build it
TODOs 1–7 in order: Bloom filter → SSTable write/get → LSM write/flush/get → scan → compact.
:::

:::details Map the code to the book
| Your code | Book (pp. 74–77) |
|---|---|
| `wal.log` | "a separate log on disk to which every write is immediately appended … only purpose is to restore the memtable after a crash" |
| `self.memtable` (sorted at flush) | the in-memory balanced tree; you sort when flushing instead, which is equivalent for this purpose |
| `SSTable.write` | flush the memtable as a sorted segment file |
| `index_keys` / `index_offsets` | the sparse in-memory index (Figure 3-5) |
| `BloomFilter` | LevelDB's Bloom filters for missing keys |
| `get`: memtable, then newest SSTable first | "first try … the memtable, then the most recent on-disk segment, then the next-older segment" |
| `compact`: k-way merge, newest wins | Figure 3-4, mergesort-style merging |
| `scan` | efficient range queries because data is sorted |

One simplification: real engines compress each block between sparse-index entries; you read the block uncompressed. Adding `zlib.compress` per block is a nice extension.
:::

:::quiz
### predict
Your memtable limit is 1000 and you `put` 2,500 keys, then the process is killed. What is on disk, and what does the next startup do?
- [ ] Nothing is on disk; all 2,500 writes are lost
- [x] Two SSTables (1,000 keys each) plus a WAL with the last 500 writes; startup loads the SSTables' indexes and replays the WAL into the memtable
- [ ] One SSTable with 2,500 keys
- [ ] Only the WAL with all 2,500 writes
>>>
Each time the memtable fills it is flushed and the WAL restarted. The 500 writes since the last flush exist only in the WAL, which recovery replays.

### mcq
Why can `compact` drop tombstones in your implementation?
- [ ] Tombstones are never needed
- [x] Because it merges *all* SSTables, there's no older table left that might still contain a value the tombstone needs to hide
- [ ] Because the Bloom filter remembers deletions
- [ ] Because the WAL keeps them
>>>
If you compacted only some tables, a dropped tombstone could "resurrect" an older value in a table that wasn't part of the merge. Real engines therefore drop tombstones only when merging into the oldest level.

### mcq
In `scan`, why tag each item with a source rank before merging?
- [ ] To sort values numerically
- [x] So that for equal keys the newest source comes first, letting you keep the newest version and skip older ones
- [ ] Because `heapq.merge` requires integers
- [ ] To count disk reads
>>>
`heapq.merge` orders by (key, rank); rank 0 = memtable = newest. The first occurrence of a key is the version to use (or a tombstone to skip).

### explain
Compare your two stores — the Bitcask from Week 3 and today's LSM-tree — on memory use, range queries, and read cost.
>>>
**Memory:** Bitcask needs every key in an in-memory hash map; the LSM-tree needs only a sparse index (one key per block) and Bloom filters per SSTable, so it scales to far more keys. **Range queries:** Bitcask can't do them efficiently (keys are unordered); the LSM-tree can, by merging sorted sources. **Read cost:** Bitcask is always exactly one hash lookup and one seek; the LSM-tree checks the memtable and possibly several SSTables (Bloom filters avoid most reads for missing keys), so reads can be more expensive until compaction reduces the number of tables.
:::

:::connect Where this goes next
You now have working versions of both log-structured designs. In Week 6's project you'll extend one with checksums, benchmarks and percentiles; in the capstone it becomes a replicated, partitioned store. Next week: Chapter 4 — what happens when the data you store (or send) must be readable by code written yesterday *and* code written tomorrow.
:::
