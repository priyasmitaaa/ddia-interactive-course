---
title: Lab — build a Bitcask-style key-value store
chapter: 3
topic: Append-only logs, hash indexes, tombstones, crash recovery, compaction
minutes: 100
---

## Objective

Build the storage engine described on pp. 70–74 of the book: an append-only log of key–value
records on disk, indexed by an in-memory hash map ("keydir"), with tombstones for deletes,
checksums to survive crashes mid-write, segment files, and compaction. This is essentially
**Bitcask**, Riak's default storage engine — and the foundation of your Week 6 project.

## Setup

Python 3.10+, standard library only. Files in `practice/08-bitcask/`:

- `kvstore.py` — the store, with `TODO`s numbered in the suggested order.
- `test_kvstore.py` — 11 tests, grouped T1–T5 in the same order as the TODOs.
- `bench.py` — throughput and p50/p99 latency of your store.

## Predict first

1. After 100 updates of the same key, how many records for that key are on disk? What does `get` cost?
2. If the process crashes halfway through writing a record, what will the file look like, and how will the next startup know?
3. How much slower will writes be with `--sync` (fsync after every write)? 2×? 10×? 100×?

## Your task

Work through the TODOs, running the tests after each step:

1. **TODO 1** `encode_record` → tests T1 pass.
2. **TODO 2** `_append`, `put`, `get` → T2 passes.
3. **TODO 3** `delete` with a tombstone → T3.
4. **TODO 4** `_load_segment`: rebuild the keydir on startup; detect torn and corrupt records with the length and CRC; truncate the torn tail → T4.
5. **TODO 5** roll over to a new segment when the active one exceeds `max_segment_bytes` → first T5 test.
6. **TODO 6 (stretch)** `compact` → last T5 test.

## Run it

```
python practice/08-bitcask/test_kvstore.py
python practice/08-bitcask/bench.py
python practice/08-bitcask/bench.py --sync
```

(Add `--solution` to either command to see the reference implementation's behaviour.)

## Observe

- Writes are just appends: very fast. Reads are one hash lookup plus one seek.
- `--sync` makes writes roughly **100× slower** on a typical laptop SSD: durability has a real cost, which is why databases batch fsyncs ("group commit").
- Compaction shrinks the files dramatically when there are many updates per key (the cat-video workload).
- Restart time grows with the amount of data, because the keydir is rebuilt by scanning every segment.

## Questions

1. Why is an append-only design good for crash safety? What could go wrong if you overwrote values in place?
2. What are the two big limitations of a hash index (p. 73)? Show each one with a concrete query.
3. Your keydir must fit in RAM. Estimate the RAM needed for 100 million keys of 20 bytes each.
4. How would you make restarts fast without scanning every segment? (The book mentions Bitcask's trick.)
5. Why is it OK to compact closed segments in a background thread while reads continue?

<details><summary>Discussion</summary>

1. A crash during an append leaves at most one torn record at the end, which the CRC/length check detects and discards; everything before it is intact. Overwriting in place could leave a value that is half old and half new, with no way to tell.
2. (a) All keys must fit in memory — e.g. a store of billions of small keys won't fit. (b) Range queries are inefficient — "all keys between kitty00000 and kitty99999" requires looking up each of the 100,000 keys individually.
3. Roughly 100M × (20 bytes key + ~12 bytes location + hash-table and Python object overhead). In a compact C implementation maybe 4–6 GB; in Python objects much more. This is the "keys must fit in RAM" constraint made concrete.
4. Write a snapshot of each closed segment's hash map to disk ("hint file") so startup loads it instead of scanning the data (p. 73).
5. Segments are immutable once closed, so readers see consistent data in the old files; the merged file is written separately and swapped in atomically; then the old files are deleted (p. 71).
</details>
