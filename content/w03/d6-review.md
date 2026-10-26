---
title: Review — Storage Engines Checkpoint
kind: review
minutes: 60
chapter: 3
objectives:
- Retrieve how log-structured and B-tree engines work, from memory
- Reason about engine choice for new workloads
- Finish this week's lab if it isn't done
reading:
- Re-read the OLTP half of the Chapter 3 Summary | 100-101
complete:
- You did today's spaced review
- You drew both engines from memory
- Bitcask tests T1–T4 pass
---

:::review Today's spaced review
Questions from Weeks 1–3, scheduled for today.
:::

:::task Draw both engines from memory
Without looking, draw on one page:

1. **LSM-tree**: the write path (WAL, memtable, flush to SSTable) and the read path (memtable → SSTables newest-first, sparse index, Bloom filter), plus compaction.
2. **B-tree**: a root, an interior level and leaves; draw what happens when a leaf splits; add the WAL.

Then compare with the lessons (W3 D3, D4). Add both drawings to your "data models" sheet from last week: you're building a map of the book.
:::

:::quiz Storage engines checkpoint
### tradeoff
You must store 5 billion keys (small keys, ~1 KB values) with mostly point lookups and a steady write rate. Why is a Bitcask-style hash index a poor fit, and what would you choose?
- [ ] It's a perfect fit, since point lookups need only one seek
- [x] The keydir must hold all 5 billion keys in RAM, which is impractical; an LSM-tree (sparse index) or a B-tree handles keys that don't fit in memory
- [ ] Hash indexes can't store 1 KB values
- [ ] You'd need a column store
>>>
Bitcask's defining constraint is that all keys fit in memory (p. 70). Sorted structures need only a sparse index (LSM) or a few levels of pages (B-tree), mostly on disk.

### scenario
A team running a B-tree database finds that after a crash, one table's index points to a page that isn't referenced by its parent. What most likely went wrong, and what mechanism should have prevented it?
>>>
A multi-page operation — most likely a page split, which writes two child pages and their parent — was interrupted by the crash after only some pages were written, leaving an orphan page. The **write-ahead log** should prevent it: every modification is appended to the WAL before being applied to the pages, so recovery can redo (or complete) the operation and restore a consistent tree (p. 80). Either the WAL was disabled, not flushed to stable storage (e.g. fsync turned off or a lying disk cache), or had a bug.

### mcq
Which pair is correctly matched?
- [ ] Bitcask — B-tree
- [ ] LevelDB — update-in-place
- [x] Cassandra/HBase — LSM-tree storage inspired by Bigtable
- [ ] LMDB — append-only log segments with hash maps
>>>
Cassandra and HBase use Bigtable-inspired LSM storage (SSTables, memtables). Bitcask is a hash-indexed log; LevelDB is an LSM-tree; LMDB is a copy-on-write B-tree (p. 81).

### explain
Explain in your own words why "every index slows down writes" — and how that idea reappeared in Week 1 (Twitter) and Week 2 (normalization).
>>>
An index is derived data that must be kept in sync with the primary data, so every write must also update every index — more work at write time to make certain reads fast. Twitter's fan-out-on-write timeline caches are the same trade: extra writes to precomputed per-user timelines so reads are cheap. Denormalization in Week 2 is the same again: duplicating data makes reads fast but makes every update touch more places (and risks inconsistency). Read/write trade-offs via derived data are a recurring theme of the book.

### mcq
Lookups of keys that don't exist are a known weak spot of LSM-trees. Why, and what fixes it?
- [ ] They require a full table scan; fixed by B-trees
- [x] Every SSTable must be checked back to the oldest before concluding absence; Bloom filters let most SSTables be skipped
- [ ] The WAL must be replayed; fixed by fsync
- [ ] The memtable is too small; fixed by a larger memtable
>>>
Without help, absence can only be confirmed after checking the memtable and all segments. A Bloom filter answers "definitely not here" for most segments without a disk read (p. 77).

### short
Name the two "schools of thought" for OLTP storage engines and one product of each.
>>>
The **log-structured** school — only append to files and delete obsolete files, never update in place (Bitcask, LevelDB/RocksDB, Cassandra, HBase, Lucene). The **update-in-place** school — treat the disk as fixed-size pages that are overwritten (B-trees: PostgreSQL, MySQL InnoDB, Oracle, SQL Server, SQLite, LMDB) (p. 100).
:::
