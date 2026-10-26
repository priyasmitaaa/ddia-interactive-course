---
title: Project 1, Day 1 — Hint Files and Fast Restarts
kind: project
minutes: 100
objectives:
- Restate Part I's three layers (data model, storage, encoding) and where your store sits
- Implement hint files so restarts load an index snapshot instead of scanning data
- Reason about crash safety of the hint files themselves
reading:
- Re-read crash recovery and partially written records (hash indexes) | 72-73
complete:
- M0 and M1 tests pass
- You wrote your predictions in DESIGN.md
- You answered the quiz
---

:::note This week
Part I is done. Before Part II takes your data onto many machines, this week makes sure the single-machine foundations are solid — by building, not re-reading. Plan:

| Day | Work |
|---|---|
| 1 | Project kickoff · M1 hint files |
| 2 | M2 a new record format that still reads old data |
| 3 | M3 group commit · M4 background compaction |
| 4 | Benchmark against SQLite · design document |
| 5 | Part I exam |
| 6 | Review |

The project lives in `practice/17-project1-kv/`. The starter is a complete working store in the exercise-08 format; each milestone evolves it.
:::

:::problem Restarts that get slower every day
Your Bitcask store from Week 3 rebuilds its keydir on startup by reading **every segment from start to end** (p. 72). With 500 GB of segments, a restart after a crash or a routine deploy takes many minutes, during which the store is down. Downtime during restarts hurts availability (Chapter 1) and discourages frequent deploys (Chapter 4's rolling upgrades). Bitcask's fix: store a **snapshot of each segment's hash map on disk** — a *hint file* — that loads much faster.
:::

:::intuition A bookmark for every closed segment
A closed segment is immutable. So the part of the keydir that points into it can be computed **once**, when the segment closes, and saved beside it: `000007.data` gets `000007.hint`. On restart:

- for each **closed** segment with a hint file → load the hint (small, no value bytes to read);
- for the **active** segment (still being written, no hint yet) → scan it as before.

Two subtleties make this real engineering rather than a one-liner:

1. **Deletes.** If segment 7 contains a tombstone for key `k` whose old value is in segment 3, then after loading segment 3's hint, segment 7's hint must *remove* `k`. So hints record deleted keys too.
2. **Crash while writing a hint.** If you crash halfway through writing `000007.hint`, a half-written hint must never be loaded as if it were complete. Standard trick: write to `000007.hint.tmp`, then `os.replace()` it into place — an atomic rename on the same filesystem. Either the old state (no hint → scan) or the complete hint exists.

Hints are **derived data**, like an index: if one is missing or suspicious, you can always fall back to scanning the segment — the segment is the source of truth.
:::

:::practice 17-project1-kv | Milestone M1
Read the whole of `kvstore2.py` first (15 minutes) — it's the store you know, slightly reorganised. Fill in `DESIGN.md` section 1 (predictions). Then implement M1 and make the M1 tests pass. Watch `db.stats` — it counts segments scanned and hints loaded.
:::

:::quiz
### mcq
Why is it safe to compute a segment's hint file once, when the segment is closed?
- [ ] Because hint files are encrypted
- [x] Because closed segments are immutable: the entries pointing into them never change location
- [ ] Because the keydir never changes
- [ ] It isn't safe; hints must be rewritten on every write
>>>
Immutability of closed segments is what makes hints (and compaction in the background) simple. Newer writes go to later segments and simply override older entries on load.

### predict
Segment 3 holds `k = "old"`. Segment 7 holds a tombstone for `k`. Your hint for segment 7 only lists live keys. After a restart using hints, what does `get(k)` return?
- [ ] None, correctly
- [x] "old" — the delete was lost because segment 7's hint didn't record it
- [ ] An error
- [ ] The tombstone marker
>>>
Loading segment 3's hint puts `k` in the keydir; nothing removes it. That's why hints must also record deletions (and apply them in segment order).

### mcq
Why write the hint to a temporary file and then `os.replace()` it?
- [ ] It's faster
- [ ] To compress it
- [x] So that a crash during writing never leaves a partially written hint that looks complete — the rename is atomic
- [ ] Because JSON can't be written in place
>>>
Atomic rename is the standard way to make "write a whole file" crash-safe. A half-written temp file is simply ignored.

### explain
Hints are described as "derived data". What does that mean here, and what does it allow you to do if something goes wrong?
>>>
The hint is computed entirely from the segment it describes, which remains the source of truth. So hints can be deleted and regenerated at any time; if a hint is missing, corrupt or doesn't match its segment, the store can ignore it and fall back to scanning the segment. Losing derived data costs time (a slower restart), not data — the same relationship as between a database and its indexes, caches, or materialized views.
:::

:::connect Where this goes next
Snapshots-plus-log is a pattern you'll meet constantly: database checkpoints plus the WAL, a follower's initial snapshot plus the replication log (Chapter 5, "setting up new followers"), and stream processors' state checkpoints (Chapter 11). Tomorrow: change the record format without breaking any data already on disk.
:::
