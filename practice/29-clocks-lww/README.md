---
title: Clocks — what your machine offers, and how last-write-wins loses data
chapter: 8
topic: Time-of-day vs monotonic clocks, clock skew, LWW, logical clocks
minutes: 40
---

## Objective

First, inspect the real clocks on your own computer: which can jump (time-of-day) and which
can't (monotonic), and their resolution (pp. 279–280). Then reproduce the danger from Figure 8-3 at
scale: three replicas resolve conflicts with last-write-wins using their own slightly skewed clocks.
Every increment is causally after the previous one, yet many disappear without any error
(p. 284). Finally, swap in a logical counter and watch the loss go to zero.

## Setup

Python 3.10+, standard library only. Open `practice/29-clocks-lww/clocks.py`. Part A only reads
your clocks; it changes nothing.

## Predict first

1. Increments arrive every 2 ms. With clocks skewed by up to 1 ms, will LWW lose any? With 5 ms?
2. Old Windows systems' time-of-day clocks moved in 10 ms steps (p. 280). With *perfectly*
   synchronized clocks but 10 ms resolution, will LWW lose increments?
3. How many increments will Lamport-style counters lose?

## Your task

1. **TODO 1** `lww_merge` — keep the version with the larger timestamp.
2. **TODO 2** `PhysicalClockReplica.timestamp_for_write` — real time + this node's offset, rounded
   down to the clock's resolution; ties broken by node id.
3. **TODO 3** `LamportReplica` — a counter that increments on each write and jumps forward to the
   largest timestamp it has seen.

## Run it

```
python practice/29-clocks-lww/clocks.py
```

## Observe

- Part A: `time.time()` is *adjustable* (NTP may step it); `time.monotonic()` is not.
- With skew smaller than the gap between writes, nothing is lost. Once skew exceeds it, a replica
  whose clock is behind can't overwrite a value written by a replica whose clock is ahead "until the
  clock skew between the nodes has elapsed" (p. 284) — its writes are silently dropped.
- With 10 ms resolution, many writes in the same step get the same time and the tie-breaker (node
  id) decides arbitrarily — losing writes even with zero skew. That's the third bullet on p. 284.
- The logical counter loses nothing: because each replica has seen the previous write, its counter
  is always past it. It measures *order*, not time of day.

## Questions

1. Why is the loss "silent"? Which part of the system would have to notice, and why doesn't it?
2. Lamport counters fixed this workload. Would they also make LWW correct for two clients that
   increment *concurrently* on different replicas? What would?
3. Why is it not enough to run NTP very carefully, according to the book?
4. The application could generate timestamps on the client instead. Does that help?

<details><summary>Discussion</summary>

1. Each replica dutifully applies LWW: the losing write is simply older by timestamp. Each client
   got a successful acknowledgment. Nobody compares the timestamp order with the causal order —
   the database doesn't know that the second write was based on reading the first (p. 284).
2. No. With two concurrent increments, both read the same value and both write value + 1; whichever
   has the larger timestamp wins and the other increment is lost — LWW discards concurrent writes by
   design (p. 179). Detecting concurrency needs version vectors (siblings to merge), or a commutative
   datatype like a counter CRDT (Chapter 5, Exercise 21).
3. NTP's accuracy is limited by network round-trip time plus quartz drift; for correct ordering the
   clock would have to be much more accurate than the network delay it's measuring (p. 284) — and
   NTP itself can fail silently (firewalled, misconfigured servers, leap seconds; pp. 281–282).
4. No — it doesn't change the fundamental problems (p. 284), and client clocks (phones, laptops) are
   even less trustworthy; users may even set them wrong deliberately (p. 282).
</details>
