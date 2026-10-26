---
title: Lab — build a small LSM-tree
chapter: 3
topic: Memtable, WAL, SSTables, sparse index, Bloom filters, merging, range scans
minutes: 110
---

## Objective

Implement the storage engine the book describes on pp. 74–77 — essentially what LevelDB,
RocksDB, Cassandra and HBase do: writes go to a write-ahead log and an in-memory memtable;
a full memtable is flushed as a sorted SSTable file with a sparse index and a Bloom filter;
reads check the memtable then SSTables newest-first; background compaction merge-sorts SSTables.
Unlike your Bitcask store, this one supports **range queries** and doesn't need all keys in RAM.

## Setup

Python 3.10+. Files in `practice/12-lsm-tree/`: `lsm.py` (TODOs 1–7, with file formats and helpers
given) and `test_lsm.py` (tests T1–T4).

## Predict first

1. Why can an SSTable's in-memory index be *sparse* (one key every 16 records), when Bitcask needed every key in memory?
2. Looking up a key that doesn't exist: how many SSTables must be checked without Bloom filters? With them?
3. Why is it only safe to drop tombstones during compaction if you merge *all* SSTables?

## Your task

1. **TODO 1** Bloom filter `add` / `might_contain` → T1.
2. **TODO 2–3** `SSTable.write` and `SSTable.get` → T2.
3. **TODO 4–5** `_write`, `flush`, `get` → T3 (including WAL recovery).
4. **TODO 6–7** `scan` and `compact` → T4.

## Run it

```
python practice/12-lsm-tree/test_lsm.py
python practice/12-lsm-tree/test_lsm.py --solution    # reference
```

## Observe

- Writes never modify existing files: the WAL and SSTables are append-only/immutable.
- Missing-key lookups mostly never touch disk thanks to the Bloom filters (T2 counts reads).
- Range scans are a k-way merge of sorted sources — the same algorithm as compaction.
- After compaction, there is exactly one entry per live key.

## Questions

1. What does the WAL protect against, and why can it be deleted after a flush?
2. Compare your LSM-tree with your Bitcask store: list two things each does better.
3. What happens to read latency when there are 50 un-compacted SSTables? What does compaction cost?
4. Write amplification: how many times is each byte written to disk in your design (WAL, flush, each compaction)?

<details><summary>Discussion</summary>

1. The memtable lives in memory and is lost in a crash; the WAL lets startup rebuild it. Once flushed, those writes are in an SSTable, so the WAL's contents are redundant (p. 76–77).
2. Bitcask: simpler; reads are always exactly one seek; no merging cost on reads. LSM: range scans, keys needn't fit in memory (sparse index), data on disk is sorted and compressible.
3. Each lookup may check up to 50 tables (Bloom filters help for missing keys, not for keys in old tables); range scans merge 50 sources. Compaction costs disk bandwidth and can interfere with foreground requests — the source of LSM tail-latency spikes (p. 82).
4. Once to the WAL, once at flush, and once more every time the data is merged in a compaction. That's write amplification, a concern on SSDs (p. 80 footnote).
</details>
