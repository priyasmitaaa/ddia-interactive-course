---
title: Indexes in a real database (SQLite query plans)
chapter: 3
topic: Secondary, concatenated and covering indexes; range queries; write cost
minutes: 40
---

## Objective

Use a real B-tree-based database (SQLite) to see the book's index claims in query plans and
timings: indexes turn scans into searches, a concatenated index works like a phone book, a
covering index answers a query without touching the table, B-trees make range queries cheap,
and every index makes writes more expensive.

## Setup

Python 3.10+ (SQLite is built in). Open `practice/09-sqlite-indexes/indexes.py`. It builds a
300,000-row `users` table in memory. Each experiment prints the time and the output of
`EXPLAIN QUERY PLAN`:

- `SCAN users` = read every row.
- `SEARCH users USING INDEX x` = descend the B-tree index, then fetch the matching rows.
- `USING COVERING INDEX x` = the index alone contains everything needed.

## Predict first

1. With an index on `(last_name, first_name)`, which of these can use the index efficiently: by last name; by last + first; by first name only?
2. How much faster will the email lookup be with an index: 2×, 100×, or 1000×+?
3. How much slower will inserts be with 5 secondary indexes than with none?

## Your task

Replace each `TODO` string with the right `CREATE INDEX` statement:

1. `CREATE_EMAIL_INDEX` — index on `email`.
2. `CREATE_NAME_INDEX` — concatenated index on `(last_name, first_name)`.
3. `CREATE_COVERING_INDEX` — an index that covers `SELECT city ... WHERE last_name = ...`.
4. `CREATE_DATE_INDEX` — index on `signup_date`.

Run after each one and read the plans.

## Run it

```
python practice/09-sqlite-indexes/indexes.py
```

## Observe

- A point lookup goes from tens of milliseconds (full scan) to microseconds (B-tree search).
- The concatenated index is used for `last_name` and `last_name + first_name`, but `first_name` alone becomes a full scan (of the index) — the phone-book effect.
- Before the covering index, SQLite searches the index and then visits the table for `city`; afterwards it never touches the table.
- Range queries over a sorted index are cheap.
- Inserts get slower with each index you add (the size of the effect depends on the data and machine).

## Questions

1. Why does `WHERE first_name = 'Hana'` not benefit from the `(last_name, first_name)` index?
2. What is the difference between a clustered index, a covering index and a heap file with secondary indexes (p. 83)?
3. Why don't databases simply index every column by default?
4. You notice "SCAN users USING COVERING INDEX idx_name" for the first-name query. Why would SQLite scan the *index* rather than the table?

<details><summary>Discussion</summary>

1. The index is sorted by last name first; entries with first name "Hana" are scattered across every last name, so there's no contiguous range to search.
2. Clustered: the row data is stored inside the index itself (e.g. InnoDB's primary key). Covering (index with included columns): the index stores some extra columns, enough to answer certain queries alone. Heap file: rows live in one place in no particular order; indexes store only references to heap locations.
3. Every index must be updated on every write, costs storage, and many would never be used. You choose indexes from your knowledge of the query patterns (p. 69).
4. The index is smaller than the table (it holds only last_name, first_name and the row id), so scanning it reads less data and still contains `first_name` and `id` — everything this query needs.
</details>
