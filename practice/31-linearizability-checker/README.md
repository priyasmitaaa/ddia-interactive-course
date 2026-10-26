---
title: Lab — a linearizability checker, and catching a stale read
chapter: 9
topic: Linearizability, real-time ordering, testing distributed systems with recorded histories
minutes: 100
---

## Objective

Turn the definition of linearizability (pp. 314–319) into code. Write a checker that decides
whether a history of register operations (read, write, compare-and-set) can be put in a sequential
order that respects real time. Then use it the way practitioners do: record real histories from a
replicated store under concurrency and let the checker judge. It should show that reading from
asynchronously updated followers isn't linearizable, while reading from the leader is
(pp. 323–324).

## Setup

Python 3.10+, standard library only. Files: `practice/31-linearizability-checker/linearizability.py`
(TODOs 1–2) and `test_linearizability.py` (T1–T5). The **Linearizability** visualization in this
week's lessons runs the same algorithm, so use it to check your intuition on a single history.

## Predict first

1. In Figure 9-2, A's middle read returns 1. B's second read starts after it finishes. Which values
   may B's second read return?
2. A failed `cas(x, 0, 3)` returns an error. Does the checker have to verify anything about it?
3. A reader polls a follower that lags by up to 20 ms, while a writer writes 1, 2, 3, … every 5 ms.
   Will the recorded history be linearizable?

## Your task

1. **TODO 1** `step` → T1. This is the register's "sequential specification".
2. **TODO 2** `linearize` → T2–T4. Depth-first search over the operations that may legally come
   next, with memoization.
3. Run T5. It records real threaded histories (in about a second) and checks them window by window.

## Run it

```
python practice/31-linearizability-checker/test_linearizability.py
python practice/31-linearizability-checker/linearizability.py
```

## Observe

- Figure 9-4 is not linearizable as drawn, because B's final read returns 2 after A has already read 4.
  Change it to 4 and you get a valid order, which your checker prints. It processes D's write before A's,
  even though A sent its request later (p. 318).
- Failed operations constrain the history too. Pretend D's `cas(0, 3)` succeeded and no valid order exists.
- Recorded histories: **every** follower-read window fails, and no leader-read window does. Nothing
  "went wrong" in the store. Asynchronous replication simply isn't linearizable.
- The search is exponential in the worst case. Windowing keeps it fast, at the price of possibly missing
  violations that span windows. Real tools (Knossos, Porcupine) use cleverer pruning, but the same idea.

## Questions

1. Why is "find any valid order" enough? Why don't we need the *actual* order the database used?
2. Your checker accepts a read that returns a value before the write's `ok` reached the writer.
   Why is that allowed (p. 319)?
3. Serializable snapshot isolation is serializable but not linearizable (p. 320). Sketch a two-client
   history that shows this.
4. Reading from the leader passed. Name two ways a single-leader system can *still* violate
   linearizability in production (p. 323).

<details><summary>Discussion</summary>

1. Linearizability is defined from the client's view: the system must *behave as if* there were a
   single copy with atomic operations. If some order consistent with real time and register semantics
   explains every result, no client can tell the difference. If none exists, some client observed an
   impossible behavior.
2. The write took effect at some point inside its interval. The response to the writer may simply be
   delayed in the network after that point (p. 319). Only the interval matters.
3. Client A commits a write x = 1 at time 10. Client B's transaction started at time 5 (so its snapshot
   predates the write) and reads x = 0 at time 20, after A's commit has completed. Serializable: run B
   before A. Not linearizable: B's read started after A's write completed, yet returned the old value.
   Snapshots deliberately exclude writes newer than the snapshot (p. 320).
4. A "delusional" ex-leader that still thinks it's the leader (after a pause or partition) keeps
   serving reads and writes. Asynchronous failover can lose acknowledged writes, so a later read on the
   new leader returns an older value. Using snapshot isolation or concurrency bugs also break it (p. 323).
</details>
