---
title: Actual serial execution with stored procedures
chapter: 7
topic: Single-threaded transaction processing, interactive vs stored-procedure transactions
minutes: 30
---

## Objective

Measure why single-threaded databases (VoltDB, Redis, Datomic) need stored procedures (p. 245,
Figure 7-9): interactive transactions spend most of their time waiting for network round trips,
so running them one at a time is hopeless — but submitting the whole transaction as a procedure
to a single-threaded executor is fast *and* serializable by construction.

## Setup

Python 3.10+. Open `practice/27-serial-execution/serial.py`. Network round trips are simulated
with short sleeps (on Windows, sleeps are coarser than requested — compare the ratios, not the absolute numbers).

## Predict first

Rank A (interactive, serial), B (interactive, concurrent with per-shift locks) and C (stored procedures on one thread) by throughput. How big are the gaps?

## Your task

Implement `SerialExecutor`: one daemon thread taking `(procedure, args, future)` from a queue and running procedures one at a time; `submit()` returns a `Future`.

## Run it

```
python practice/27-serial-execution/serial.py
```

## Observe

- A is tiny: the "database" sits idle during every round trip while holding everything.
- B is much faster, because transactions on different shifts overlap — that's why traditional databases need concurrency control.
- C beats both: one round trip per transaction, and the single thread never waits on the network. No locks, no anomalies.

## Questions

1. What three conditions does the book give for serial execution to be viable?
2. Why must VoltDB's stored procedures be deterministic?
3. If transactions span partitions, how does throughput behave (VoltDB's numbers)?
4. What are the traditional complaints about stored procedures, and how do modern systems address them?

<details><summary>Discussion</summary>

1. Every transaction must be small and fast (one slow transaction stalls everything); the active dataset must fit in memory; write throughput must fit on one CPU core — or data must be partitioned so transactions rarely cross partitions (p. 247).
2. VoltDB replicates by executing the same procedure on each replica, so every replica must produce the same result; e.g. the current time must come from a deterministic API (p. 246).
3. Cross-partition transactions need coordination in lock-step across partitions: VoltDB reported about 1,000 cross-partition writes/s — orders of magnitude below single-partition throughput, and adding machines doesn't help (p. 247).
4. Vendor-specific archaic languages (PL/SQL, T-SQL), hard to debug/version/test/monitor, and a bad procedure can hurt a shared database. Modern systems use general-purpose languages: Java/Groovy (VoltDB), Java/Clojure (Datomic), Lua (Redis) (p. 246).
</details>
