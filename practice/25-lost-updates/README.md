---
title: Lost updates with real threads — and three fixes
chapter: 7
topic: Read-modify-write races, atomic operations, explicit locks, compare-and-set
minutes: 35
---

## Objective

Make Figure 7-1 happen on your own machine: eight threads with separate database connections
increment one counter in SQLite. Then prevent lost updates in the three ways the book describes
(pp. 234–236): an atomic write operation, explicit locking, and compare-and-set.

## Setup

Python 3.10+. Open `practice/25-lost-updates/counter.py`. Each run takes a few seconds.

## Predict first

1. 8 threads × 200 naive increments should give 1600. What final value do you expect?
2. Which fix will be fastest, and which will need retries?

## Your task

1. **Task 1** `increment_atomic`: `UPDATE ... SET value = value + 1`.
2. **Task 2** `increment_locked`: `BEGIN IMMEDIATE`, read, write, `COMMIT` (SQLite's way of taking the lock up front, like `SELECT ... FOR UPDATE`).
3. **Task 3** `increment_cas`: conditional `UPDATE ... WHERE value = old`, retry if `rowcount == 0`; return the number of retries.

## Run it

```
python practice/25-lost-updates/counter.py
```

## Observe

- Read-modify-write: most increments are lost — each thread writes back a value computed from a stale read.
- Atomic update: correct and the simplest; the database performs the read-modify-write under its own lock.
- Explicit lock: correct, but every increment holds the lock while the application "thinks".
- Compare-and-set: correct without holding a lock across the read, at the price of retries under contention (optimistic, like SSI next week).

## Questions

1. Why doesn't read committed isolation prevent this lost update? (Hint: is it a dirty write?)
2. When can't you use an atomic operation? Give the book's example.
3. The book warns that compare-and-set may not be safe in some databases. Why?
4. Why do lock- and CAS-based techniques not work in multi-leader or leaderless replicated databases, and what is used instead?

<details><summary>Discussion</summary>

1. Each write happens after the other transaction has committed, so nothing uncommitted is overwritten — no dirty write. It's still wrong because the second write was based on a value read before the first write (p. 227).
2. When the logic can't be expressed as a database operation — e.g. editing a wiki page, or checking game rules before moving a piece (Example 7-1), where explicit locking is used instead (pp. 234–235).
3. If the database lets the `WHERE value = old` condition read from an old snapshot, the condition can be true even though another write is happening concurrently (p. 236).
4. They assume a single up-to-date copy of the data. With concurrent writes on several replicas, systems instead create siblings and merge them, or use commutative operations (e.g. Riak counters/CRDTs); LWW, the common default, loses updates (p. 237).
</details>
