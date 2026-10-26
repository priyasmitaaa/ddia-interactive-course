---
title: Lab — build MVCC snapshot isolation, then make it serializable (SSI)
chapter: 7
topic: Multi-version concurrency control, visibility rules, lost-update detection, SSI
minutes: 110
---

## Objective

Implement the database internals behind Chapter 7's isolation levels: multi-version storage with
`created_by` / `deleted_by` (Figure 7-7), the four visibility rules (p. 232), first-committer-wins
lost-update detection (p. 236), and then serializable snapshot isolation — aborting a read-write
transaction whose premise was invalidated by a concurrent commit (Figures 7-10, 7-11).

## Setup

Python 3.10+. Files: `practice/26-mvcc-ssi/mvcc.py` (TODOs 1–4) and `test_mvcc.py` (T1–T5).
The Transactions visualization in the lessons (`TxnSim`) runs the same ideas step by step.

## Predict first

1. Transaction 12 reads while transaction 13 (started just after it) commits a transfer. What does 12 see?
2. Under plain snapshot isolation, do the two doctors in Figure 7-8 both go off call?
3. Under SSI, which of the two doctor transactions aborts, and at which point?

## Your task

1. **TODO 1** `_sees_tx`, `_visible` → T1–T3.
2. **TODO 2** `write` → T1–T3.
3. **TODO 3** first-committer-wins in `commit` → T4.
4. **TODO 4** SSI validation in `commit` → T5.

## Run it

```
python practice/26-mvcc-ssi/test_mvcc.py
```

## Observe

- Readers never block writers and writers never block readers — there are no locks in this code at all.
- Snapshot isolation fixes dirty reads, read skew and (with first-committer-wins) lost updates — but write skew passes (T5's first test documents the anomaly).
- SSI catches write skew and phantom double-bookings by checking, at commit time, whether data the transaction read has been changed by a concurrent transaction that committed first. The aborted transaction is retried and then behaves correctly.

## Questions

1. Why are updates implemented as "delete + create" instead of overwriting in place?
2. Why does SSI wait until commit to abort, instead of aborting at the stale read?
3. Your SSI aborts more transactions than PostgreSQL's would. Why, and what's the trade-off of precision?
4. Which garbage-collection problem have you ignored, and when can an old version be deleted?

<details><summary>Discussion</summary>

1. Old versions must stay readable for transactions whose snapshots still need them; creating new versions lets every transaction see its own consistent snapshot with little overhead (pp. 231–232).
2. The transaction might be read-only, in which case it never needs to abort; at read time the database doesn't know whether it will write later (p. 254).
3. This version aborts whenever a concurrent committed write touches anything read; real SSI tracks dependencies more precisely and can sometimes prove an execution is still serializable. More precise tracking means fewer unnecessary aborts but more bookkeeping (p. 256).
4. Versions deleted by committed transactions accumulate forever. A version can be removed once no active transaction could still see it — i.e. its deleting transaction committed before the oldest active transaction started (PostgreSQL's vacuum, p. 231).
</details>
