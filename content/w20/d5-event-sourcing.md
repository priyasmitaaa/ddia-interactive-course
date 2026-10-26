---
title: Event Sourcing, Immutability and Deriving State
kind: lesson
minutes: 100
chapter: 11
objectives:
- Distinguish event sourcing from change data capture by level of abstraction
- Explain deriving current state from an event log, and why log compaction differs
- Distinguish commands from events, and where validation must happen
- Explain state as the integral of a stream ("the truth is the log") and the advantages of immutable events
- Explain CQRS, read-optimized views, the concurrency-control trade-offs, and the difficulty of deletion
reading:
- Event sourcing | 442-442
- Deriving current state from the event log | 442-443
- Commands and events | 443-444
- State, streams and immutability | 444-445
- Advantages of immutable events | 445-446
- Deriving several views from the same event log | 446-447
- Concurrency control | 447-447
- Immutability and deletion | 447-448
complete:
- In the event-sourcing visualization, you time-travelled through the log and broke naive compaction
- Exercise 42 (event-sourced reservations) is done
- You answered the quiz
---

:::problem Store what happened, not just where you ended up
Event sourcing comes from the **Domain-Driven Design** community. Like CDC, it stores **all changes to application state as a log of change events**. The difference is the **level of abstraction** (p. 442):
- In **CDC**, the application uses the database **mutably**, updating and deleting at will. The change log is extracted **at a low level** (for example from the replication log), which guarantees the order matches the actual writes and avoids Figure 11-4's race. The application needn't know CDC is happening.
- In **event sourcing**, the application logic is **explicitly built on immutable events** written to an event log. The event store is append-only, updates and deletes are discouraged or prohibited, and events are designed to **mirror things that happened at the application level**.

It's similar to the chronicle data model, and an event log resembles a star schema's fact table. Specialized databases exist (**Event Store**), but a conventional database or a log-based broker works too.
:::

:::intuition The truth is the log
**Deriving current state** (pp. 442–443). An event log alone isn't what users want. They expect to see the **current state**, such as the current contents of their cart, not the list of every change. So applications transform the log into **application state suitable for reading**. The transformation can be arbitrary logic, but it **should be deterministic**, so you can rerun it and get the same state.

**Compaction is different.** A CDC event usually contains the **entire new version** of a record, so the latest event per key determines its value and older ones can be discarded. Event-sourcing events express **user intent** ("added one more mug"), not the mechanics of the state update. Later events don't override earlier ones, so you **need the full history**, and compaction isn't possible in the same way. Applications store **snapshots** of derived state to avoid replaying everything, but that's only a performance optimization. The intention is to keep **all raw events forever** and reprocess whenever needed, which is reasonable for all but the very largest applications.

**Commands and events** (pp. 443–444). A user request first arrives as a **command**, which may still fail (an integrity condition might be violated). The application validates it. If it's accepted, it becomes an **event**, durable and immutable: a **fact**. If a user reserves a seat, the application checks that the seat is free, then records "seat 14C reserved for customer X". Even if the reservation is later cancelled, it remains true that they held it, and the cancellation is a separate event. **A consumer may not reject an event.** By the time it sees the event, it's already part of the log and may have been seen by others, so **validation must happen synchronously, before** the command becomes an event. Alternatively, split it into a **tentative reservation** event and a later **confirmation** event, which allows asynchronous validation (Chapter 9's log-based uniqueness).

**State, streams and immutability** (pp. 444–445). Batch processing benefited from immutable inputs, and the same principle powers CDC and event sourcing. State changes, which is why databases support updates and deletes. But **state is the result of the events that mutated it**: available seats come from the reservations processed, a balance from credits and debits, a response-time graph from individual requests. **Mutable state and an append-only log of immutable events are two sides of the same coin.** Mathematically, **state is the integral of the event stream over time, and the change stream is the derivative of state** (Figure 11-6, an analogy with limits). If the changelog is stored durably, state becomes **reproducible**. Treat the log as the system of record and all mutable state as derived. As Pat Helland puts it: "**The truth is the log. The database is a cache of a subset of the log.**"
:::

:::visual EventSourcingViz | A cart built from events
**Try this:**
1. Add and remove items. View 1 (current cart) and View 2 (considered, then removed) are both derived from the same log.
2. Click an older event to **replay up to it**: time travel for free.
3. Try to add a second lamp (only 1 in stock): the **command is rejected** and never becomes an event.
4. Add the same book twice, then look at "if you compacted 'last event per item'": the cart is now wrong.
:::

:::details Advantages, views, concurrency and deletion (pp. 445–448)
**Advantages of immutable events** (pp. 445–446). Accountants have used immutability for centuries. Transactions go into an append-only **ledger**, and accounts (P&L, balance sheet) are derived by adding them up. Mistakes are never erased. A **compensating** transaction is added, such as a refund, and the incorrect entry stays for **auditing**. If wrong figures were published, the next period includes a correction. Beyond finance, if buggy code writes bad data, recovery is much easier with an append-only log than with destructive overwrites (Chapter 10's human fault tolerance). Immutable events also **capture more information**: a customer added an item and then removed it. For fulfilment that's a no-op, but analytics might care that they considered it.

**Several views from the same log, and CQRS** (pp. 446–447). Separating mutable state from the immutable log lets you derive **several read-oriented representations**, just as a stream can have many consumers. To present data a new way, build a **new read-optimized view from the log** and run it **alongside** the existing systems, rather than doing a complicated schema migration. Shut down the old one when it's no longer needed. Storing data is easy if you don't worry about how it'll be queried, since most of the complexity of schemas, indexes and storage engines comes from supporting access patterns. **Separating the form in which data is written from the form in which it's read** is **command query responsibility segregation (CQRS)**. The traditional approach rests on "the fallacy that data must be written in the same form as it will be queried". Normalization debates become largely irrelevant: it's reasonable to **denormalize** read views, because the translation from the log keeps them up to date. **Twitter's home timelines** (Chapter 1) are exactly such a denormalized, fan-out-maintained read view.

**Concurrency control** (p. 447). The biggest downside of event sourcing and CDC is that consumers are usually **asynchronous**. A user writes an event, reads a derived view, and doesn't see their write: **read-your-writes** again. Options: update the read view **synchronously** with the append, which needs a transaction over both (so the same storage system, or a distributed transaction), or use the **total order broadcast** approach from Chapter 9. On the upside, event sourcing **simplifies** some concurrency control. Much of the need for multi-object transactions comes from one user action changing data in several places. Design an event as a **self-contained description of a user action**, and the action becomes a **single atomic append**. If the log and the state are **partitioned the same way**, a single-threaded consumer per partition needs **no concurrency control for writes**: "the log removes the non-determinism of concurrency by defining a serial order of events in a partition" (like actual serial execution, Chapter 7). Events touching several partitions need more work, which comes later.

**Immutability and deletion** (pp. 447–448). Many non-event-sourced systems rely on immutability too: **Datomic** queries historical snapshots, and **git**, **Mercurial** and **Fossil** preserve version history. Storage is cheap enough to keep all events for most systems. But sometimes data must **really** be deleted: privacy regulations may require deleting personal information after an account closes, or an accidental leak must be contained. Appending a "deleted" event isn't enough. You need to **rewrite history**, which Datomic calls **excision** and Fossil **shunning**. True deletion is surprisingly hard, because copies live in storage engines, filesystems and SSDs that write to new locations, and in deliberately immutable backups. "Deletion is more a matter of 'making it harder to retrieve the data' than 'making it impossible'".
:::

:::practice 42-event-sourcing | Seat reservations from an immutable log
Commands vs events, deterministic replay, optimistic concurrency on a stream, and a projection added after the fact.
:::

:::quiz
### mcq
What's the key difference between CDC and event sourcing?
- [ ] CDC uses Kafka, event sourcing doesn't
- [x] CDC extracts low-level changes from a database the application uses mutably; event sourcing builds the application explicitly on immutable, application-level events
- [ ] Event sourcing is synchronous
- [ ] CDC events are immutable, event-sourcing events aren't
>>>
They differ in level of abstraction (p. 442).

### mcq
Why can't an event-sourced log be compacted like a CDC log?
- [ ] Event stores don't support compaction
- [x] Events express user intent rather than the complete new state of a record, so later events don't supersede earlier ones and the full history is needed to reconstruct state
- [ ] Events are too large
- [ ] Compaction would break ordering
>>>
Use snapshots of derived state for performance instead (p. 443).

### predict
A consumer of the "SeatReserved" event stream discovers that a seat was reserved twice. Can it reject the second event?
- [ ] Yes, consumers validate events
- [x] No: by then it's an immutable fact already in the log and possibly seen by others; validation must happen before a command becomes an event (or use tentative-then-confirm events)
- [ ] Yes, by deleting it from the log
- [ ] Only with 2PC
>>>
Events are facts once written. A consumer can't refuse one, so commands must be validated before they become events (pp. 443–444).

### mcq
What does "the truth is the log; the database is a cache of a subset of the log" mean?
- [ ] Databases should be replaced by logs
- [x] The append-only log of changes is the authoritative record, and current state is derived from it (the latest value of each record), so state can be reproduced from the log
- [ ] Logs are faster than databases
- [ ] Caches are always correct
>>>
That's Pat Helland's quote on p. 445.

### tradeoff
What do you gain by separating the write-optimized event log from read-optimized views (CQRS), and what new problem appears?
- [x] Freedom to build many denormalized, query-specific views (even new ones from old history) without schema migrations; but views are updated asynchronously, so users may not read their own writes
- [ ] Simpler code, and no new problems
- [ ] Strong consistency, at the cost of storage
- [ ] Fewer events, and slower reads
>>>
Separating the write form from the read form gives flexible views, but asynchronous view updates bring back read-your-writes problems (pp. 446–447).

### explain
Explain how event sourcing can *reduce* the need for multi-object transactions, using a partitioned log.
>>>
Multi-object transactions are often needed because one user action updates several places, for example a seat-map row, a customer's booking list and an availability counter, all of which must change together. With event sourcing, you design one event, "customer X reserved seat 14C for show S", that describes the whole action. Recording it is a single append to the log, which is easy to make atomic (p. 447). All the places that need updating are derived views that consumers update from that event. If the log and the state are partitioned the same way, say by show, then one single-threaded consumer per partition processes events serially and needs no concurrency control for its writes. The log defines the serial order of events in a partition, much like actual serial execution in Chapter 7 (p. 447). Events that touch several partitions still need extra coordination.
:::

:::connect Where this goes next
Tomorrow's review consolidates brokers, logs, CDC and event sourcing. Next week: what you *do* with streams. Processing them, reasoning about time, windows, joins and fault tolerance.
:::
