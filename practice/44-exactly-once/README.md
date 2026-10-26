---
title: Lab — an exactly-once stream processor
chapter: 11
topic: At-least-once vs idempotent vs transactional processing, offsets, side effects, idempotency keys
minutes: 100
---

## Objective

A stream processor reads payment events from a log, keeps account balances in SQLite, and emails
when a payment is large. It **crashes at arbitrary moments** and restarts from its stored offset. First
watch the naive approach double-count. Then implement the two techniques from pp. 461–462:
**idempotent writes**, which store the offset of the last applied event with the value and skip replays, and
**atomic commit of state and offset**, where the balance and the consumer position commit in one transaction. Finally,
make the email an **idempotent side effect** with a deduplication key.

## Setup

Python 3.10+, standard library only. Files: `practice/44-exactly-once/processor.py` (TODOs 1–3) and
`test_processor.py`. The crash injector stops a processor after N events, right after its write and before
its offset commit, which is the worst moment. The **Exactly-once** visualization this week replays the same
four strategies step by step.

## Predict first

1. With at-least-once and offsets committed every 7 events, roughly how many events are re-applied per crash?
2. The idempotent version still commits offsets to a separate file every 7 events. Why are its balances right anyway?
3. In the transactional version, where does the processor read its start offset from after a crash?
4. Can deduplicating emails by event offset ever lose an email? Can it send one twice?

## Your task

1. **TODO 1** `run_idempotent` → T1.
2. **TODO 2** `run_transactional` → T2.
3. **TODO 3** `notify` → T3.

## Run it

```
python practice/44-exactly-once/test_processor.py
python practice/44-exactly-once/processor.py
```

## Observe

- **At-least-once** ends up thousands too high. Every crash replays the events since the last offset commit,
  and adding to a balance isn't idempotent (p. 461).
- **Idempotent** is exact although events are replayed. Each account row remembers the last offset applied
  to it, so a replay is recognized and skipped. That works because a log replays the **same events in the same
  order**, processing is deterministic, and only one processor writes each row. Those are the book's three assumptions,
  and on failover you also need fencing (p. 462).
- **Transactional** is exact, with no separate offset file. The offset lives in the same database as the state,
  so "applied the event" and "moved the offset" can't get out of sync. This is the atomic commit from p. 461 in its
  cheapest form: both writes go to one store.
- **Emails**: exactly one per large payment, even with crashes. But look at the order in `notify`. Recording the key
  before sending means a crash between the two **loses** the email (at most once). Sending first means a crash
  **repeats** it (at least once). True exactly-once for an external system needs that system to accept your
  idempotency key, or to take part in an atomic commit (pp. 460–461).

## Questions

1. Why can't a stream processor use the batch approach of "make output visible only when the task finishes" (p. 460)?
2. Microbatching and checkpointing give exactly-once *inside* the framework. Why does that stop at the first external write (pp. 460–461)?
3. Which of the idempotence assumptions would break if two processors handled the same partition after a failover?
4. How would you extend the transactional design if state and output lived in two different databases?

<details><summary>Discussion</summary>

1. A stream never ends, so a task never "finishes". Output has to become visible continuously, which needs
   finer-grained recovery: microbatches, checkpoints, transactions or idempotent writes (p. 460).
2. The framework can discard the uncommitted output of a failed batch only if that output is still under its
   control. A database write, a message to an external broker or an email has already happened, and a restart repeats it (pp. 460–461).
3. "No other node may concurrently update the same value." A zombie processor that's still running could apply writes,
   possibly with different offsets, interleaved with the new owner's. Fence it with an epoch or token (pp. 462, 293–295).
4. Either a distributed transaction across both (heavy, Chapter 9), or keep the input offset with the output in the
   output database, and make the state store's updates idempotent by offset as well, so each side can recover on its own.
   Systems like Google Cloud Dataflow make this efficient by writing the commit as a single object in a fault-tolerant store (p. 461).
</details>
