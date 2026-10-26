---
title: Project 1, Day 3 — Group Commit and Background Compaction
kind: project
minutes: 110
objectives:
- Explain why fsync is expensive and how group commit amortises it
- Implement durable batched writes
- Implement compaction that runs concurrently with reads and writes, with a short critical section
- Predict and then measure the effect of compaction on median vs tail latency
reading:
- Re-read merging in the background, and compaction vs tail latency | 71-72
- Comparing B-trees to LSM-trees (compaction interference) | 81-82
complete:
- M3 and M4 tests pass
- DESIGN.md sections 3 and 5 are written
- You answered the quiz
---

:::problem Durable or fast — pick one?
In Week 3's benchmark, writes with `fsync` after each one ran at about 1,000 per second; without it, about 100,000. Without fsync, an acknowledged write can be lost in a power failure. With it, your store is 100× slower. And compaction, which keeps disk usage under control, was a stop-the-world operation: while it ran, nothing else could.
:::

:::intuition One fsync for many writes; one short pause for a long job
**Group commit.** The expensive part of a durable write is waiting for the device to confirm stable storage — and that cost is roughly the same whether you flush 50 bytes or 50 KB. So collect many writes, append them all, then call `fsync` **once**: every write in the batch becomes durable together. Real databases do this automatically, gathering writes from many concurrent transactions into one log flush.

**Background compaction.** Look at what compaction touches:

- **reading** closed segments — immutable, so no lock needed, and this is the slow part;
- **writing** the merged file — a new file nobody else uses yet, so no lock needed;
- **swapping** — removing old files, renaming the new one, updating the keydir — shared state, so this part needs the lock, but it's fast.

So: snapshot what to copy (under the lock, briefly) → copy without the lock → swap under the lock. One catch: a key may be **overwritten while compaction is copying**. The merged file holds its old value, so during the swap only update keydir entries that *still* point into the segments being compacted.
:::

:::details Why the tail suffers even when nothing is "blocked"
Even with a short critical section, compaction competes with foreground requests for **disk bandwidth**, **CPU**, and (in Python) the **global interpreter lock**. Most requests don't notice; some arrive at an unlucky moment and wait. That's precisely the book's warning (p. 82): the impact of compaction on throughput and *average* response time is usually small, but at **higher percentiles** response times of log-structured engines can be quite high, while B-trees can be more predictable.

Real LSM engines limit this by compacting **incrementally** and by **rate-limiting** compaction I/O — trading slower space reclamation for smoother latency. If compaction falls permanently behind the write rate, though, segments pile up, reads slow down and disk fills: you need monitoring for that (the final edition of the book discusses this explicitly).
:::

:::practice 17-project1-kv | Milestones M3 and M4
Implement `write_batch`, then `compact(background=True)`. The M4 test writes 500 keys *while* compaction runs and then checks every value, before and after a restart.
:::

:::quiz
### mcq
Why does group commit improve durable-write throughput so dramatically?
- [ ] It skips fsync
- [x] The cost of an fsync is mostly a fixed wait for the device, so one fsync can make a whole batch of appended writes durable for roughly the price of one
- [ ] It compresses the writes
- [ ] It writes to memory instead of disk
>>>
Amortisation: N writes, one wait. The writes are still durable when the batch call returns.

### predict
During background compaction, which latency statistic of reads changes most?
- [ ] The median, a lot; the p99, not at all
- [x] The p99 rises noticeably; the median changes little
- [ ] Neither changes
- [ ] Both drop
>>>
Most reads don't collide with compaction's heavy moments; the unlucky few do. That's the "higher percentiles" effect the book describes for LSM engines (p. 82). Check your own `bench.py` numbers.

### mcq
A key is overwritten while background compaction is copying the closed segments. What must the swap step do to avoid losing the newer value?
- [ ] Nothing; compaction always has the newest value
- [ ] Abort the compaction
- [x] Only update keydir entries that still point into the compacted segments, leaving the newer location of the overwritten key untouched
- [ ] Copy the active segment too
>>>
The merged file contains the value as of the snapshot. Entries that moved to the active segment in the meantime are newer and must win.

### scenario
A `write_batch` of 100 writes is in progress when the machine loses power after 60 records reached the disk but before fsync returned. What state does recovery produce, and what guarantee does your store (not) give?
>>>
Recovery scans the active segment and keeps every record with a valid CRC — probably the first ~60 (any torn record and everything after it are discarded). Since `write_batch` never returned, the caller wasn't told the batch succeeded, so no acknowledged write was lost. But the batch is **not atomic**: a prefix of it may survive. Making a group of writes all-or-nothing is the "atomicity" of transactions (Chapter 7) — e.g. a commit record at the end of the batch, and recovery ignoring batches without one.
:::

:::connect Where this goes next
"All or nothing" for a batch of writes is the A in ACID (Chapter 7). And "copy without the lock, swap with it, don't clobber newer writes" is a small taste of concurrency control — the subject of Chapter 7's isolation levels.
:::
