---
title: Project 1 — KV store v2 (hint files, format evolution, group commit, background compaction)
chapter: 
topic: Part I project — Chapters 1, 3 and 4 in one codebase
minutes: 360
---

## Objective

Evolve a working log-structured key-value store the way real storage engines evolve — without
ever breaking data that's already on disk. Four milestones, each tied to the book:

| Milestone | What | Book |
|---|---|---|
| M1 hint files | save each closed segment's keydir so restarts don't scan all data | Ch 3, p. 72–73 (Bitcask crash recovery) |
| M2 format v2 | add a timestamp to every record; still read old v1 segments | Ch 4 (backward compatibility, "data outlives code", writer's schema in a file header) |
| M3 group commit | make a batch of writes durable with one fsync | Ch 3 durability cost; Ch 1 throughput |
| M4 background compaction | merge segments while reads and writes continue; measure the tail-latency impact | Ch 3, p. 82; Ch 1 percentiles |

Plus a benchmark against SQLite (a B-tree) and a one-page design document.
Spread over Week 6, Days 1–4 (about 1½ hours each).

## Setup

Python 3.10+. Files in `practice/17-project1-kv/`:

- `kvstore2.py` — a complete v1 store (M0 already passes) with `M1`…`M4` TODOs. If you prefer, port your own exercise-08 code into this shape first.
- `test_project1.py` — tests grouped M0–M4.
- `bench.py` — throughput and p50/p99/p99.9 for your store and for SQLite.
- `DESIGN.md` — the template for your design document.

## Predict first

Write these down in `DESIGN.md` before you start:

1. How much faster will restart be with hint files for a store with 100 segments?
2. When v2 code opens a store written entirely by v1 code, what must it do differently, and what must it *never* do?
3. Durable writes: 100 writes with one fsync each vs 100 writes with one fsync total — ratio?
4. Will background compaction change the **median** read latency, the **p99**, both, or neither?

## Your task

1. **Day 1 — M1:** `_write_hint`, `_load_hint`, and the two call sites marked M1. Don't forget deletes.
2. **Day 2 — M2:** `encode_v2`, v1/v2 detection in `scan_segment`, the segment header in `_open_active`, and the "never append to a v1 file" rule in `__init__`. Update offsets to `V2_HEADER.size`.
3. **Day 3 — M3 and M4:** `write_batch`, then `compact(background=True)` with a short critical section.
4. **Day 4 — measure and write up:** run `bench.py`, fill in `DESIGN.md`.

## Run it

```
python practice/17-project1-kv/test_project1.py
python practice/17-project1-kv/bench.py
```

`--solution` on either command runs the reference implementation for comparison.

## Observe

- Restart statistics: with hints, only the active segment is scanned.
- The v1→v2 upgrade works with no migration step — old segments stay v1 until compaction rewrites them into v2 (compare: Avro object container files carry their writer's schema in the header).
- Batched durable writes reach tens of thousands per second; fsync-per-write about a thousand.
- During background compaction, the median read latency barely changes while p99 rises several-fold — the book's warning about LSM compaction and tail latency, in your own numbers.
- Your store's point reads are in the same league as SQLite's B-tree; writes without fsync are faster because they're pure appends.

## Questions

Answer these in `DESIGN.md`:

1. Which crash scenarios can lose acknowledged writes in your store (with `sync=False`, with `write_batch`)?
2. Why is it safe to read closed segments without the lock during compaction, and why must the final swap hold it?
3. What would it take to support range queries? Which Chapter 3 structure would you switch to?
4. How would you roll out a hypothetical v3 format to a fleet of servers sharing files, given what you know about forward compatibility?

<details><summary>Discussion</summary>

1. With `sync=False`, writes acknowledged but still in the OS page cache are lost on power failure (not on a process crash). With `write_batch`, anything acknowledged is fsynced, but a crash mid-batch leaves a torn tail — recovery keeps a prefix of the batch, so batches are not atomic (Chapter 7 is about making them atomic).
2. Closed segments are immutable, so concurrent readers see consistent bytes. The swap changes shared state (file list, keydir, open readers) that every operation uses; doing it under the lock keeps others from seeing a half-swapped state, and the keydir check prevents overwriting newer locations.
3. Keys must be sorted: SSTables with a sparse index and merging (LSM-tree), or a B-tree. A hash keydir can't serve ranges.
4. Ship readers that understand v3 everywhere first (while still writing v2), and only after every node can read v3 start writing it — otherwise old readers meet data from the future. Keep the format version in the segment header so each file is self-describing.
</details>
