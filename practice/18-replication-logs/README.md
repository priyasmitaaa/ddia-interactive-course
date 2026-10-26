---
title: Statement-based vs logical (row-based) replication
chapter: 5
topic: Replication logs, non-determinism, change data capture
minutes: 35
---

## Objective

Replicate the same workload from a "leader" SQLite database to a "follower" in two ways and see
why statement-based replication breaks (non-deterministic functions, statements that depend on
existing data) while a logical, row-based log keeps replicas identical (pp. 152–154).

## Setup

Python 3.10+. Open `practice/18-replication-logs/replog.py`. The workload uses SQLite's `random()`
and an `UPDATE` whose effect depends on the data already in the table.

## Predict first

1. With statement-based replication, how often will the follower end up different from the leader?
2. Which of the five statements cause the divergence — only the `random()` inserts, or others too?
3. What must a row-based log record for a delete, if the table had no primary key?

## Your task

1. **Task 1:** `capture_changes(before, after)` — turn the before/after table contents into `insert`/`update`/`delete` records.
2. **Task 2:** `apply_changes(db, changes)` — apply them on the follower.

(Real databases don't diff whole tables, of course — the storage engine emits these records as it changes rows. Diffing is just the simplest way to get the same log here.)

## Run it

```
python practice/18-replication-logs/replog.py
```

## Observe

- Statement-based: the follower diverges in essentially every run — the "random" prizes differ, so the `UPDATE` picks a different winner and the `DELETE` removes different rows. One non-deterministic function poisons everything downstream.
- Row-based: 0 divergences. The log records *results*, not *instructions*.
- The row-based log is easy for other programs to read — this is **change data capture** (Chapter 11).

## Questions

1. How could a statement-based system work around `random()` and `NOW()`? Why does the book say other methods are generally preferred anyway?
2. Why does WAL shipping usually prevent running different database versions on leader and follower, while a logical log doesn't?
3. A row-based log for one big `UPDATE products SET price = price * 1.1` is much larger than the statement. When might that matter?
4. Why might you still want trigger-based replication?

<details><summary>Discussion</summary>

1. The leader can replace non-deterministic calls with the concrete values it computed before logging the statement — but there are many edge cases (auto-increment, triggers, stored procedures, ordering of concurrent transactions), so statement-based replication is fragile (pp. 152–153). MySQL switches to row-based logging when a statement is non-deterministic; VoltDB requires deterministic transactions.
2. A WAL describes bytes in disk blocks of a particular storage format; a new version with a different format can't apply it. A logical log describes rows, independent of the storage engine, so it can be kept compatible across versions — enabling zero-downtime upgrades by upgrading followers first, then failing over (p. 153).
3. Bulk updates touching millions of rows produce huge logs, using network bandwidth and slowing followers (increasing replication lag).
4. To replicate only a subset of data, to replicate between different kinds of database, or to run custom conflict-resolution logic (p. 154) — at the cost of higher overhead and more bugs.
</details>
