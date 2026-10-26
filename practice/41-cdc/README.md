---
title: Dual writes vs change data capture, log compaction and bootstrapping
chapter: 11
topic: Keeping derived systems in sync, trigger-based CDC, log compaction, initial snapshots
minutes: 50
---

## Objective

Keep a full-text search index in sync with a database, two ways. **Dual writes**, where the application
writes to both, silently diverge under concurrency (Figure 11-4) or partial failure (p. 438).
**Change data capture** makes the database the only leader and the index a follower of its change log
(Figure 11-5). Implement CDC with SQLite **triggers** that append to a changelog table inside the same
transaction (trigger-based CDC, p. 440). Then use **log compaction** to rebuild a fresh index without the
full history (p. 441), and **bootstrap** a new index from a consistent snapshot plus a log position after
the log has been truncated (pp. 440–441).

## Setup

Python 3.10+, standard library only (sqlite3 is built in). Files: `practice/41-cdc/cdc.py`
(TODOs 1–4) and `test_cdc.py`. The **Dual writes vs CDC** visualization this week shows the same race
and the same compaction.

## Predict first

1. In Part A, which value does the index end up with, and does anyone get an error?
2. If a transaction that inserted a product is rolled back, should the change appear in the changelog?
3. After compaction, how many entries can the changelog have at most, compared with the number of
   products in the table?

## Your task

1. **TODO 1** `install_cdc_triggers` → T1.
2. **TODO 2** `CdcConsumer.poll` → T2.
3. **TODO 3** `compact` → T3.
4. **TODO 4** `bootstrap_new_index` → T4.

## Run it

```
python practice/41-cdc/test_cdc.py
python practice/41-cdc/cdc.py
```

## Observe

- Dual writes: the database says "blue", the index says "red", and no error was raised anywhere. After a
  failed second write the product is simply missing from search.
- With CDC, the index matches the database after every poll, whatever the workload. The changelog
  row is written in the **same transaction** as the change, so rolled-back writes never appear and
  committed ones always do, in commit order.
- Compaction shrinks hundreds of changes to at most one entry per live product. Its size depends on
  the current contents, not on the history (p. 441).
- The new index needs a snapshot **and** the log position at that moment, read in one transaction.
  Otherwise a change committed between "copy the table" and "note the position" would be lost or applied twice.

## Questions

1. Why is CDC usually asynchronous, and what problem from Chapter 5 does that bring back (p. 440)?
2. The book calls trigger-based CDC "fragile" with "significant performance overheads" (p. 440). What
   do production CDC tools do instead?
3. Why does the snapshot need to "correspond to a known position or offset in the change log" (p. 441)?
4. Your changelog only records the new values. What would you need to add to support a consumer that maintains
   "total value of all products" incrementally?

<details><summary>Discussion</summary>

1. The system of record doesn't wait for consumers before committing, so a slow consumer can't slow
   down the database. But the index lags, and all the replication-lag problems apply, for example a user
   who doesn't see their own update in search yet (pp. 440, 156).
2. They parse the database's replication log or write-ahead log: Debezium and Maxwell read the MySQL
   binlog, Bottled Water decodes the PostgreSQL WAL, Mongoriver reads the MongoDB oplog, and
   GoldenGate does it for Oracle (p. 440). That captures changes in commit order without extra write
   work in each transaction. Schema changes remain a challenge.
3. So you know exactly which changes are already reflected in the snapshot and which must be applied
   afterwards. Without that position you either skip changes or apply some twice (p. 441).
4. The old value too (a "before image"), or the consumer must keep its own copy of each product's last
   value. To update a running total on an update or delete, you need to subtract the previous value. Many
   CDC formats include both before and after images for this reason.
</details>
