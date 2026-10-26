---
title: Event sourcing — seat reservations from an immutable log
chapter: 11
topic: Event sourcing, commands vs events, deriving state, projections/CQRS, optimistic concurrency
minutes: 50
---

## Objective

Build a small event-sourced application, following pp. 442–447. The **system of record** is an
append-only log of immutable events. Current state is **derived** by replaying events with a
deterministic function. A user request is a **command** that may be rejected. Only a validated command
becomes an **event**, a fact that is never changed or deleted. A cancellation is a new event. Several
**read views** come from the same log, including one you add later and build from the full history
(CQRS, p. 446). Validation is made safe under concurrency with **optimistic concurrency** on the
show's stream.

## Setup

Python 3.10+, standard library only. Files: `practice/42-event-sourcing/reservations.py`
(TODOs 1–4) and `test_reservations.py`. The **Event sourcing** visualization this week shows a
shopping cart built the same way.

## Predict first

1. A customer reserves A1 and then cancels. How many events are in the log, and what does the seat map show?
2. Two box offices read the show's state at the same time and both see seat A3 free. How do you prevent
   both reservations from becoming events?
3. Could you log-compact this event log, keeping only the latest event per seat, and still answer
   "how many cancellations did each show have"?

## Your task

1. **TODO 1** `decide`: validate a command and produce events, or raise `Rejected`.
2. **TODO 2** `evolve`: the fold that derives state from events.
3. **TODO 3** `EventStore.append`: optimistic concurrency with `expected_version`.
4. **TODO 4** `cancellations_per_show`: a brand-new projection over the whole history.

## Run it

```
python practice/42-event-sourcing/test_reservations.py
python practice/42-event-sourcing/reservations.py
```

## Observe

- The log only grows. Ann's history still shows her cancelled reservation, information a
  "current state only" table would have thrown away (p. 446).
- A rejected command leaves no trace. Validation happens **before** something becomes an event, because
  consumers may not reject events (p. 444).
- In the concurrent case, the second box office's append fails with a version conflict. It reloads,
  decides again, and is rejected, so the seat isn't double-booked. Validating against state you've read is only
  safe if the append fails when that state has changed. This is compare-and-set from Chapters 7 and 9, applied to a stream.
- The cancellations view didn't exist when the events were written, yet it's correct from day one,
  because it's derived from the full history. That's the "add a new view next to the old ones" advantage (p. 446).

## Questions

1. Why can't CDC-style compaction ("keep the latest event per key") be used here (p. 443)?
2. What's the difference between an event and a command, and why must validation be synchronous (pp. 443–444)?
3. A projection is updated asynchronously from the log. What anomaly can users see, and what are the
   options (p. 447)?
4. A customer exercises a legal right to have their personal data deleted. What does the book say about
   deleting from an immutable log (pp. 447–448)?

<details><summary>Discussion</summary>

1. Events here describe intent ("reserved", "cancelled"), not the full new state of a record. Later
   events don't supersede earlier ones, and you need the whole sequence. Some views, like cancellation counts or
   customer history, depend on events that a "latest per key" compaction would discard (p. 443). Event-sourced
   systems use snapshots of derived state for speed instead, while keeping all raw events.
2. A command is a request that may still fail, for example because the seat is taken. Once validated and accepted,
   it becomes an immutable fact. Downstream consumers can't reject it, since it may already have been seen by others,
   so validation must happen before the event is written. The alternative is to split it into a tentative event and a
   separate confirmation event, so validation can be asynchronous (pp. 443–444).
3. Read-your-writes violations: the user reserves a seat, then the seat map doesn't show it yet. Options are to
   update the view synchronously with the append (same storage or a distributed transaction), or to use the total order
   broadcast techniques from Chapter 9 (p. 447). Designing an event as a self-contained description of a user action
   also means each action needs only a single atomic append.
4. Appending a "deleted" event isn't enough. You need to rewrite history, as Datomic's *excision* or Fossil's *shunning*
   do. True deletion is hard, because copies live in storage engines, SSDs and backups. It's more "making it harder to retrieve"
   than "impossible" (pp. 447–448). Designing for this up front, for example by keeping personal data separate from the event log, helps.
</details>
