---
title: Atomicity, aborts and safe retries
chapter: 7
topic: Multi-object transactions, rollback, retries, idempotence
minutes: 35
---

## Objective

Reproduce Figures 7-2 and 7-3 with a real database (SQLite): an email insert plus a denormalized
unread counter, with crashes injected between the two writes. See how atomicity keeps them in
sync, why retrying an aborted transaction is safe — and why retrying is *not* automatically safe
when the crash happens after the commit (p. 223).

## Setup

Python 3.10+. Open `practice/24-atomicity/mailbox.py`. The database file is created in a temporary folder.
The connection uses autocommit, so without `BEGIN` every statement commits on its own.

## Predict first

1. Without a transaction, 10% crash rate, 500 deliveries: will the counter be higher, lower or equal to the number of emails?
2. With a transaction but no retries, how many emails are delivered?
3. If crashes happen *after* the commit and the client retries, what goes wrong?

## Your task

1. **Task 1:** `deliver_atomic` — both writes in one `BEGIN … COMMIT`, `ROLLBACK` on error.
2. **Task 2:** `deliver_idempotent` — a unique message ID makes retries harmless even after a commit whose acknowledgement was lost.

## Run it

```
python practice/24-atomicity/mailbox.py
```

## Observe

- No transaction: emails and counter drift apart — the partial failure is permanent.
- Atomic: always in sync. Aborted deliveries are simply gone, so a retry is safe.
- Atomic but crashing after commit, with retries: in sync, but with duplicate emails — the client couldn't tell "failed" from "succeeded but I didn't hear back".
- Idempotent: exactly 500 emails.

## Questions

1. The book says "abortability" might have been a better name than atomicity. Why?
2. Why doesn't isolation (the I in ACID) help with the problem in Task 2?
3. Name two errors worth retrying and one that isn't (p. 224).
4. What should happen to side effects outside the database (e.g. sending a push notification) when a transaction aborts?

<details><summary>Discussion</summary>

1. ACID atomicity isn't about concurrency (that's isolation); its defining feature is that on a fault, all of a transaction's writes are discarded, so the application can safely retry (p. 216).
2. The duplicate isn't caused by concurrent transactions interfering; it's caused by the client re-sending a transaction that already committed. Deduplication needs an application-level identity for the operation.
3. Worth retrying: deadlocks, isolation violations (serialization failures), temporary network interruptions, failover. Not worth it: permanent errors such as a constraint violation. For overload errors, retry only with backoff and limits.
4. They may happen even though the transaction aborted, so they shouldn't be triggered from inside it (or must be made idempotent / coordinated, e.g. with two-phase commit, Chapter 9) (p. 224).
</details>
