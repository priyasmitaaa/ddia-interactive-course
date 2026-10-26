---
title: The Simplest Database, and Hash Indexes
kind: lesson
minutes: 90
chapter: 3
objectives:
- Explain why an append-only log makes writes fast and reads slow
- Define an index as derived data, and state the fundamental read/write trade-off of indexes
- Describe a hash-indexed log (Bitcask): keydir, segments, compaction, merging
- List the practical issues (format, tombstones, crash recovery, torn writes, concurrency) and the limits of hash indexes
reading:
- Chapter 3 opening | 67-68
- Data Structures that Power Your Database | 68-70
- Hash indexes | 70-74
complete:
- You can explain why db_get is O(n) and how a hash index fixes it
- You can explain compaction with the cat-video example
- You answered the quiz
---

:::problem Two functions and a file
Here is a complete key-value database, in two lines of Bash (p. 68):

```bash
db_set () { echo "$1,$2" >> database }
db_get () { grep "^$1," database | sed -e "s/^$1,//" | tail -n 1 }
```

`db_set 42 '{"name":"San Francisco"}'` appends a line. `db_get 42` finds the *last* line for key 42. Updates never overwrite anything: old versions stay in the file, and the newest one wins.

This database has surprisingly good **write** performance — appending to a file is about the cheapest thing a disk can do. But **reads** are terrible: `db_get` scans the whole file every time. Double the data, double the lookup time: O(n). With a billion records, unusable. How do real databases find things fast without giving up fast writes?
:::

:::intuition Logs and indexes
The `database` file is a **log**: an append-only sequence of records. (In this book "log" doesn't mean human-readable application logs — just append-only data, possibly binary.) Many real databases are built around a log internally, plus handling for concurrency, disk space, errors and partial writes.

To read efficiently, we add an **index**: extra metadata kept on the side, a signpost to where data lives. Crucially, an index is **derived** from the primary data — you can add or drop indexes without changing the data, only query speed.

That gives the most important trade-off of this chapter (p. 69):

> Well-chosen indexes speed up reads, but **every index slows down writes**, because it must be updated on every write.

That's why databases don't index everything automatically; you choose indexes based on your query patterns. (On Day 5 this week you'll measure this trade-off in SQLite.)

### The simplest index: a hash map
Keep an **in-memory hash map** from each key to the **byte offset** of its latest value in the log file (Figure 3-1). On write: append to the file, then update the map. On read: look up the offset, seek, read. One disk seek per read — and if that part of the file is in the OS cache, none at all.

This is essentially **Bitcask**, Riak's default storage engine. It requires all **keys** to fit in RAM; values can be far larger than memory. It shines when there are many writes per key and not too many distinct keys — like counting plays of each cat video (key = URL, value = play count).
:::

:::visual HashIndexSim | A log with a hash index
**Try this:**
1. SET a few keys, then GET one: watch the lookup go hash map → byte offset → one read.
2. Press **+6 play-count updates** a few times. Segments fill up (5 records each here) and close; a new one becomes active. Notice how many **obsolete** records pile up.
3. GET a key that lives in an old segment: maps are checked newest-first.
4. **Compact & merge**: closed segments become one small segment with only the latest values.
5. DELETE a key (a tombstone is appended), then compact: the key vanishes for good.
6. **Crash**, then **Restart**: the maps are rebuilt by scanning every segment. That's why restarts get slow as data grows.
:::

:::details Making it work in practice
**Running out of disk.** We only ever append — so break the log into **segments** of a certain size: when a segment is full, close it and write to a new one. Then run **compaction** on closed segments: throw away duplicate keys, keeping only each key's most recent value (Figure 3-2). Since compaction makes segments much smaller, you can **merge** several segments at the same time (Figure 3-3).

Closed segments are never modified. Merging writes a **new** file in a background thread while reads and writes continue against the old files; when it's done, reads switch to the merged segment and the old files are deleted. Each segment has its own hash map; a read checks the newest segment's map first, then older ones. Merging keeps the number of segments small.

**Details that matter** (pp. 72–73):

- **File format** — CSV is a poor choice. A binary format that first encodes a string's length in bytes, then the raw bytes, needs no escaping.
- **Deleting** — append a special **tombstone** record. During merging, the tombstone tells the process to discard previous values of that key.
- **Crash recovery** — hash maps are in memory and lost on restart. You can rebuild them by reading every segment start to end, but that's slow for big files; Bitcask stores a **snapshot of each segment's hash map** on disk to load quickly.
- **Partially written records** — a crash can happen halfway through an append. Bitcask files include **checksums** so corrupted parts are detected and ignored.
- **Concurrency** — writes are strictly sequential, so a common choice is a **single writer thread**. Segments are append-only or immutable, so many threads can read them concurrently.

**Why not just overwrite in place?** Append-only turns out to be good (p. 73):

1. Appending and merging are **sequential writes**, much faster than random writes — on spinning disks *and* on SSDs.
2. **Concurrency and crash recovery are much simpler** with append-only/immutable files: no risk of a crash leaving a value half old, half new.
3. Merging old segments avoids **fragmentation** over time.

**Limits of the hash index:**

1. The hash table **must fit in memory**. On-disk hash maps perform poorly: lots of random I/O, expensive to grow, fiddly collision handling.
2. **Range queries are inefficient**: you can't easily fetch all keys between `kitty00000` and `kitty99999` — you'd look up each key individually.

Tomorrow you build this engine. On Wednesday, a structure without those two limits.
:::

:::quiz
### predict
Using the Bash `db_set`, you update key 42 one thousand times. What does the database file contain, and what does `db_get 42` cost?
- [ ] One line for key 42; `db_get` is instant
- [x] A thousand lines for key 42 (all old versions are kept); `db_get` still scans the whole file
- [ ] The file is empty because updates cancel out
- [ ] An error, because keys must be unique
>>>
Appends never overwrite, so every version stays in the log, and `tail -n 1` picks the last. Without an index, every read scans everything — O(n). Compaction would remove the old versions; an index would remove the scan.

### mcq
Which statement about indexes is correct, according to the book?
- [ ] Indexes speed up both reads and writes
- [ ] An index changes the contents of the database
- [x] An index is derived from the primary data; it speeds up certain reads but adds overhead to every write
- [ ] Databases index every column automatically because indexes are free
>>>
An index is additional derived structure. Adding or removing it affects performance, not contents. Each write must also update each index, so you choose indexes based on query patterns (p. 69).

### mcq
For which workload is a Bitcask-style hash-indexed log best suited?
- [x] Many updates to a moderate number of keys that fit in RAM, e.g. play counts per video URL
- [ ] Billions of distinct keys that don't fit in memory
- [ ] Range queries like "all orders between two dates"
- [ ] Analytic scans over all records
>>>
All keys must fit in the in-memory hash map, and range queries are inefficient. A high write rate per key with a bounded key set is the sweet spot (p. 71).

### mcq
How does a log-structured store delete a key?
- [ ] It overwrites the key's record with zeros
- [ ] It removes the key's bytes from the middle of the segment file
- [x] It appends a tombstone record; merging later discards earlier values for that key
- [ ] Keys can never be deleted in an append-only log
>>>
Segments aren't modified after they're written, so deletion is just another appended record. Compaction honours it by dropping older values.

### explain
Give the three reasons the book offers for why an append-only design is good, even though it looks wasteful.
>>>
(1) Appends and segment merging are **sequential writes**, which are much faster than random writes on both hard disks and SSDs. (2) **Concurrency and crash recovery are simpler** when files are append-only or immutable — e.g. no risk of a crash leaving a value half-overwritten. (3) Merging old segments avoids **fragmentation** of data files over time.

### scenario
Your Bitcask-like store holds 500 GB in 2,000 segment files. After a power cut, the server takes 25 minutes to start. Explain why, and two things that would make restarts faster.
>>>
On startup the in-memory hash maps are gone, and the naive recovery reads every segment from beginning to end to rebuild them — 500 GB of reading. Faster: (1) store a snapshot of each closed segment's hash map on disk (Bitcask's "hint files") and load those instead of scanning data; (2) compact/merge more aggressively so there's less obsolete data to scan; only the active segment's tail (since the last snapshot) needs scanning. Also, checksums let recovery stop safely at a torn final record instead of failing.
:::

:::connect Where this goes next
The log is one of the most important ideas in the whole book. Today it's a storage engine. In Chapter 5 the same idea becomes a **replication log** shipped to followers; in Chapter 9, a **totally ordered log** is equivalent to consensus; in Chapter 11, a **partitioned log** (Kafka) is a message broker and the backbone of stream processing. Keep the picture "append-only sequence of records + derived indexes" in your head.
:::
