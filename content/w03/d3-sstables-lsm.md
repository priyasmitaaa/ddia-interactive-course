---
title: SSTables and LSM-Trees
kind: lesson
minutes: 90
chapter: 3
objectives:
- Explain what an SSTable is and its three advantages over hash-indexed log segments
- Describe the LSM-tree write path (WAL + memtable + flush) and read path (memtable, then SSTables newest-first)
- Explain how merging works like mergesort and why the newest value wins
- Explain the role of Bloom filters and why LSM-trees support range queries and high write throughput
reading:
- SSTables and LSM-trees | 74-77
complete:
- You can draw the write path and read path of an LSM-tree from memory
- You used the simulator to compare missing-key lookups with and without Bloom filters
- You answered the quiz
---

:::problem Keep the fast writes, lose the limits
Yesterday's store has fast appends, but two hard limits: every key must fit in RAM, and range queries ("all keys from `kitty00000` to `kitty99999`") require looking up keys one by one. We'd like to keep the sequential, append-only writes, the immutable segments and the background merging — and still handle huge numbers of keys and ranges. One small change does it: **sort each segment by key**.
:::

:::intuition Sorted String Tables
A **Sorted String Table (SSTable)** is a segment file whose key–value pairs are **sorted by key**, with each key appearing once per merged segment. Three big advantages (pp. 74–75):

1. **Merging is simple and efficient, even for files bigger than memory** — exactly like the merge step of mergesort (Figure 3-4). Read the input files side by side, copy the lowest key to the output, repeat. If the same key appears in several inputs, keep the value from the most recent segment (each segment covers a period of time, so one is always newer).
2. **The in-memory index can be sparse.** Looking for `handiwork`? You know the offsets of `handbag` and `handsome`, and since the file is sorted, `handiwork` must be between them: jump to `handbag` and scan forward (Figure 3-5). One indexed key every few kilobytes is enough, because scanning a few KB is fast.
3. **Blocks can be compressed.** Since reads scan a range anyway, group records into blocks and compress each block; the sparse index points at block starts. Disk bandwidth is usually a worse bottleneck than CPU.

Think of a dictionary: the words at the top of each page (the sparse index) tell you which page to open; then you scan the page.
:::

:::details The LSM-tree
But writes arrive in any order — how do we produce sorted files? Maintaining sorted data *on disk* is possible (that's tomorrow's B-tree), but maintaining it *in memory* is easy with a balanced tree (red-black, AVL). So (p. 76):

1. **Write:** insert into an in-memory balanced tree, the **memtable**.
2. **Flush:** when the memtable exceeds a threshold (typically a few MB), write it out as a new SSTable — efficient, because it's already sorted. The new file becomes the most recent segment; the memtable is emptied.
3. **Read:** look in the memtable, then the most recent SSTable, then the next older, and so on.
4. **Compact:** in the background, merge SSTables and discard overwritten or deleted values.

One problem: a crash loses the memtable's writes. So also **append every write to a separate log on disk** (unsorted — its only purpose is to rebuild the memtable after a crash). When the memtable is flushed, that log can be discarded.

This is essentially **LevelDB** and **RocksDB** (embeddable key-value engines; LevelDB can replace Bitcask in Riak), and similar engines are used in **Cassandra** and **HBase**, inspired by Google's **Bigtable** paper (which introduced the terms *SSTable* and *memtable*). The structure was originally described by Patrick O'Neil et al. as the **Log-Structured Merge-Tree (LSM-Tree)**, building on log-structured file systems. **Lucene** (behind Elasticsearch and Solr) stores its term dictionary — word → list of document IDs (the *postings list*) — in SSTable-like sorted files merged in the background.

### Performance details
- **Missing keys are slow**: to be sure a key doesn't exist, you check the memtable and *every* SSTable back to the oldest, possibly reading disk for each. LevelDB adds **Bloom filters**: a memory-efficient structure that approximates set membership. It can say "definitely not in this SSTable" (no false negatives), saving disk reads; occasionally it says "maybe" for a key that isn't there (a false positive), costing one unnecessary read.
- **Range queries** work well because data is sorted.
- **Very high write throughput**, because disk writes are sequential — even when the dataset is much bigger than memory.
:::

:::visual LSMTreeSim | Write path, read path, Bloom filters
**Try this:**
1. Press **+5 random writes** a few times. The memtable (capacity 4 here) keeps keys sorted; each time it fills, it's flushed as a sorted SSTable and the WAL is cleared.
2. GET a key that's in an old SSTable: newer tables are checked first. The orange-bordered keys are the sparse index; the scan starts from the nearest indexed key at or before yours.
3. GET a key that doesn't exist (e.g. `zebra`) with Bloom filters **off**, then **on**. Compare "Disk reads by GETs".
4. PUT then **Crash & recover** before the memtable fills: the WAL rebuilds it.
5. **Compact**: all SSTables become one, newest value per key, tombstones gone.
:::

:::extra Beyond your PDF: compaction strategies
The final edition of the book (and the engines themselves) distinguish two common strategies for *which* SSTables to merge and when. **Size-tiered** compaction (HBase; Cassandra's default) merges newer, smaller SSTables into older, larger ones. **Leveled** compaction (LevelDB, RocksDB; an option in Cassandra) splits the key range into smaller SSTables arranged in levels, so compaction proceeds more incrementally and uses less disk space. The trade-offs are between write amplification, read amplification (how many SSTables a read touches) and space amplification. RocksDB's wiki has a good introduction if you want to go deeper.
:::

:::quiz
### mcq
What does the **sparse** index in an SSTable rely on?
- [ ] The values being compressed
- [x] The keys in the file being sorted, so a key must lie between two indexed neighbours
- [ ] All keys fitting in memory
- [ ] The Bloom filter
>>>
Because the file is sorted, knowing the offsets of `handbag` and `handsome` tells you `handiwork` must be between them: jump to `handbag` and scan. Without sorting, you'd need every key in the index, as in Bitcask.

### predict
Three SSTables contain key `k` with values A (oldest), B, and C (newest); the memtable doesn't have `k`. A read for `k` returns:
- [ ] A, because it was written first
- [ ] All three values
- [x] C, because SSTables are checked newest-first and the first match wins
- [ ] Nothing, because the key is duplicated
>>>
Later writes take precedence. The read path checks the memtable, then SSTables from newest to oldest, and stops at the first match. Compaction would eventually keep only C.

### mcq
What is the write-ahead log (WAL) in an LSM-tree for?
- [ ] To keep the memtable sorted
- [ ] To speed up range queries
- [x] To rebuild the memtable after a crash; it can be discarded once the memtable is flushed to an SSTable
- [ ] To store the Bloom filters
>>>
The memtable is in memory, so a crash would lose recent writes. Every write is also appended to the WAL. After a flush those writes are in an SSTable, so the WAL is no longer needed (pp. 76–77).

### mcq
A Bloom filter for an SSTable answers "is key K in this SSTable?" Which answer can it **never** give wrongly?
- [ ] "Maybe yes"
- [x] "Definitely not" — it has no false negatives
- [ ] Both answers are always exact
- [ ] Neither; it's only a guess
>>>
If any of the key's bit positions is unset, the key was never added: definitely absent, so the disk read is skipped. If all are set, the key is *probably* there (could be a false positive from other keys' bits).

### mcq
Why do LSM-trees achieve high write throughput?
- [ ] They don't write to disk at all
- [x] All disk writes are sequential (WAL appends, SSTable flushes, merges), even when writes arrive in random key order
- [ ] They skip the write-ahead log
- [ ] They only accept writes in sorted order
>>>
Random-order writes are absorbed by the in-memory memtable and hit disk only as sequential appends and bulk writes — the core idea of the log-structured school (p. 77, Summary p. 100).

### explain
Explain how merging SSTables works and why it can handle files larger than memory.
>>>
It's the merge step of mergesort: open all input SSTables and read them side by side, one record at a time. At each step look at the current first key of each file, write the lowest one to the output, and advance that file. If several files have the same key, keep the value from the most recent segment and skip the others (and drop it entirely if it's a tombstone and you're merging everything). Because you only hold the current record of each file in memory, the files can be far larger than RAM, and the output is also sorted.
:::

:::connect Where this goes next
You'll build this LSM-tree yourself in next week's lab (Day 5). Tomorrow: the B-tree, the other great family, which keeps data sorted *on disk* by updating fixed-size pages in place. Watch for the contrast: LSM = append and merge later; B-tree = find the page and overwrite it now.
:::
