---
title: Lab — Build Your Own Log-Structured Key-Value Store
kind: lab
minutes: 110
chapter: 3
objectives:
- Implement an append-only binary record format with checksums
- Implement an in-memory hash index (keydir) with one-seek reads
- Implement crash recovery that survives torn writes
- Implement segment rolling and compaction, and measure the cost of fsync
reading:
- Re-read the implementation details of hash indexes | 72-73
complete:
- At least tests T1–T4 pass (T5 compaction is a stretch goal)
- You ran bench.py with and without --sync and wrote down the numbers
- You answered the quiz
---

:::note Today is a building day
There's very little new theory today — you'll turn yesterday's pages 70–74 into roughly 100 lines of working Python. Budget about 90 minutes for the code. If you get stuck on one TODO for more than 20 minutes, peek at the matching function in `practice/_solutions/08-bitcask/kvstore.py`, then close it and write your own version.

Keep this code: in Week 6 you'll extend it into your first project, and in the capstone (Weeks 23–24) a version of it becomes the storage layer of a replicated database.
:::

:::intuition The record format, byte by byte
Each record on disk looks like this:

<div class="figure">
<svg class="dg" viewBox="0 0 660 110" role="img" aria-label="Record layout: crc, key length, value length, key, value">
  <rect class="boxd" x="10" y="20" width="110" height="40"/><text x="65" y="45" text-anchor="middle">crc32 (4 B)</text>
  <rect class="boxa" x="120" y="20" width="120" height="40"/><text x="180" y="45" text-anchor="middle">key_len (4 B)</text>
  <rect class="boxa" x="240" y="20" width="120" height="40"/><text x="300" y="45" text-anchor="middle">value_len (4 B)</text>
  <rect class="boxb" x="360" y="20" width="110" height="40"/><text x="415" y="45" text-anchor="middle">key</text>
  <rect class="boxc" x="470" y="20" width="180" height="40"/><text x="560" y="45" text-anchor="middle">value</text>
  <path class="ln" d="M120 75 H650"/><text x="385" y="95" text-anchor="middle" class="sub">the CRC is computed over all of this</text>
</svg>
</div>

- **Lengths first** means no escaping is needed — the book's point about CSV (p. 72).
- **value_len = 0xFFFFFFFF** marks a tombstone.
- **The CRC** detects both a torn write (the record runs past end-of-file, or the bytes are incomplete) and corruption. On startup you replay records until the first bad one and truncate the rest.

The keydir maps `key → (segment, value offset, value length)`, so `get` is: dictionary lookup, `seek`, `read`.
:::

:::practice 08-bitcask | Build it
Work through TODOs 1 → 6 in order. Run the tests after each one. When T1–T4 pass, run the benchmark with and without `--sync`.
:::

:::details What the benchmark is telling you
Typical laptop results (yours will differ):

| | throughput | p50 | p99 |
|---|---|---|---|
| writes, no fsync | ~100k/s | ~10 µs | ~30 µs |
| writes, fsync each | ~1k/s | ~1 ms | ~1.5 ms+ |
| reads | ~200k/s | ~4 µs | ~10 µs |

Without `fsync`, a "write" only reaches the operating system's page cache — a power cut could still lose it. With `fsync` after every write, each one waits for the device to confirm durable storage: roughly **100× slower**. Real databases reduce this cost by batching many writes into one fsync (**group commit**). Durability, you'll see in Chapter 7, is always a trade-off with speed.

Notice also the shape of the latency distribution: the p99.9 of writes is much higher than the p50 — occasional stalls (segment roll-over, OS flushes, Python's garbage collector). The Chapter 1 lesson about tails applies to your own code.
:::

:::quiz
### predict
Your store crashes while writing the last record, leaving only its first 10 bytes in the file. On restart, what should `_load_segment` do?
- [ ] Refuse to start, because the file is corrupt
- [ ] Treat the 10 bytes as a valid record with an empty value
- [x] Detect that the record is incomplete (or fails its CRC), ignore it, and truncate the file at the end of the last good record
- [ ] Delete the whole segment
>>>
Only the final record can be torn in an append-only file. Everything before it is intact. Truncating the torn tail lets new appends start at a clean record boundary.

### mcq
Why does the CRC cover the lengths as well as the key and value?
- [ ] To make the file smaller
- [x] So that a corrupted length field is also detected; otherwise a bad length could make the reader skip or misread data
- [ ] Because CRCs only work on integers
- [ ] It doesn't need to; that's only for performance
>>>
If a length were corrupted and unchecked, the reader could interpret garbage as a valid record, or lose track of record boundaries. Checksumming the whole record body catches it.

### mcq
With `--sync`, writes become about 100× slower. What is the main reason?
- [ ] Python is slow at writing files
- [ ] The CRC computation is expensive
- [x] Each write waits for the storage device to confirm the data is durably stored, instead of returning once it's in the OS page cache
- [ ] The file becomes fragmented
>>>
`fsync` forces data to stable storage and waits for it. Without it, data sits in volatile OS buffers. Group commit (one fsync for many writes) is the standard compromise.

### short
Name two things that would break if you allowed several threads to append to the active segment at the same time without coordination.
>>>
(1) Records from different threads could interleave byte-by-byte, corrupting both. (2) The offsets recorded in the keydir could be wrong, because another thread wrote between computing the offset and writing. (Also: the order of updates to the same key might differ between the file and the keydir.) That's why Bitcask uses a single writer thread (p. 73).

### explain
In your own words: what is in memory and what is on disk in your store, and what does each part cost if lost?
>>>
On disk: the segment files — the actual data, append-only and durable (assuming fsync). In memory: the keydir hash map pointing to the latest value for each key, plus open file handles. Losing memory (a crash) loses no data, only the index, which can be rebuilt by scanning the segments — costing restart time proportional to the data size. Losing disk loses data, which is why Chapter 5 copies it to other machines.
:::

:::connect Where this goes next
Tomorrow's LSM-tree keeps today's good parts (append-only writes, immutable segments, background merging) but sorts each segment by key. That one change removes both of today's limitations: keys no longer need to fit in memory, and range queries become efficient.
:::
