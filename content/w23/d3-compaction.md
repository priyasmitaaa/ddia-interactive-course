---
title: Milestone 2, Part 2 — Compaction and Storage Guarantees
kind: project
minutes: 90
objectives:
- Implement full compaction: newest value per key wins, tombstones are dropped, old files are removed atomically
- Explain when tombstones may and may not be dropped
- Write the storage section of your DESIGN.md
reading:
- Re-read SSTables and LSM-trees (merging, compaction) | 74-80
complete:
- All M2_Storage tests pass
- You wrote the storage section of DESIGN.md
- You answered the quiz
---

:::problem Files pile up
Every flush creates another SSTable. Reads check more and more files, and overwritten values and tombstones waste space. Chapter 3's answer is **compaction**: merge SSTables, keeping only the newest value for each key.
:::

:::intuition Merge, keep the newest, drop what's dead
`compact()` merges **all** SSTables into one:
1. Read the SSTables **oldest to newest** into a dictionary, so newer values overwrite older ones.
2. Drop keys whose newest value is a **tombstone**. This is safe *only because this is a full merge*: no older SSTable remains that could resurrect the key. In a partial merge, say of the two newest files only, the tombstone must be kept, because an older file might still contain the key.
3. Write the result as **one new SSTable** (temp file, fsync, rename), swap it in, and **then** delete the old files. A crash before the swap leaves the old files intact. A crash after it leaves extra old files, which a real engine would clean up at startup.

Real engines (LevelDB, RocksDB, Cassandra) compact **incrementally**, using size-tiered or leveled strategies, to bound the I/O of each compaction and avoid long pauses. MiniKV's full merge keeps the idea and skips the scheduling.

**DESIGN.md, storage section.** Start your design document today, with a heading per milestone. For storage, write:
- What's durable when `put` returns, and why: the fsynced WAL.
- What a crash at each point loses: nothing acknowledged.
- Read cost: memtable plus at most one block per SSTable, and why compaction matters.
- Known limitations, for example: whole-file reads in `scan`, a single writer thread, no Bloom filters (you could add one, see Exercise 12).
:::

:::practice 45-capstone-minikv | M2 — compaction
Implement `LSMStore.compact`. Then all of `M2_Storage` should pass. Optional stretch: add a Bloom filter per SSTable (Exercise 12) and measure how many SSTable reads it saves for missing keys.
:::

:::quiz
### mcq
Why may MiniKV drop tombstones during compaction?
- [ ] Tombstones are always useless
- [x] Its compaction merges all SSTables, so no older file remains that could still contain the deleted key; a partial merge would have to keep the tombstone
- [ ] Because the WAL keeps them
- [ ] Because reads ignore tombstones
>>>
Dropping a tombstone too early would make the deleted value reappear from an older file.

### predict
The process crashes after writing the new compacted SSTable but before deleting the old ones. On restart, what does a read return?
- [ ] Possibly stale data
- [x] The correct newest values: the new SSTable has the highest number, so it's searched first, and it contains the newest value of every live key
- [ ] An error
- [ ] Nothing
>>>
The leftover files are only wasted space. A real engine would detect and remove them using a manifest.

### explain
Why do production LSM engines compact incrementally (size-tiered or leveled) instead of merging everything at once?
>>>
A full merge rewrites the entire dataset each time: it reads and writes every byte, so write amplification and I/O spikes grow with database size, and a long compaction competes with foreground reads and writes, hurting tail latency (Chapter 3 notes compaction can interfere with ongoing requests). Incremental strategies merge a few files at a time, either similar-sized ones (size-tiered) or files from one level into the next (leveled), which bounds the work per compaction and keeps the number of files a read must check under control. The cost is a more complex design, and tombstones must be kept until the merge reaches the oldest level that could contain the key.
:::

:::connect Tomorrow
Milestone 3: three copies of every partition, kept in sync by a replication log.
:::
