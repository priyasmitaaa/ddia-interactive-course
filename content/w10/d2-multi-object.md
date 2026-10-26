---
title: Single-Object and Multi-Object Operations; Handling Aborts
kind: lesson
minutes: 85
chapter: 7
objectives:
- Explain atomicity and isolation in terms of multi-object writes (the email + counter example)
- Explain how databases group statements into a transaction, and the problem with TCP connections
- Explain single-object atomicity, atomic increments and compare-and-set, and why they aren't transactions
- Give three situations that require multi-object transactions
- Explain the pitfalls of retrying aborted transactions
reading:
- Single-object and multi-object operations | 219-221
- Single-object writes; the need for multi-object transactions | 221-223
- Handling errors and aborts | 223-224
complete:
- You ran the atomicity exercise and saw duplicates appear after a crash-after-commit
- You can list the five pitfalls of retrying
- You answered the quiz
---

:::problem Two writes that must stay together
An email app shows a list of unread messages and an unread counter. The `COUNT(*)` is too slow, so the counter is stored separately — denormalization (Figure 7-2). Now delivering an email is **two writes**: insert the message and increment the counter. Another user might look between them and see a new unread email but a counter of 0 (an isolation problem). Or the process might crash between them, leaving the counter permanently wrong (an atomicity problem, Figure 7-3).
:::

:::intuition All or nothing, and nothing in between
Recap (p. 219):

- **Atomicity**: if an error occurs halfway through a sequence of writes, the transaction aborts and earlier writes are discarded — an **all-or-nothing** guarantee.
- **Isolation**: concurrent transactions don't interfere: if one makes several writes, another sees **all or none** of them.

Both assume **multi-object** transactions. How does the database know which statements belong together? In relational databases, typically by the client's **TCP connection**: everything between `BEGIN TRANSACTION` and `COMMIT` on that connection. (Not ideal: if the connection breaks after the client sent `COMMIT` but before the acknowledgement, the client doesn't know whether it committed. A transaction manager can use unique transaction IDs instead.) Many non-relational databases have no such grouping; even a "multi-put" may succeed for some keys and fail for others.
:::

:::details Single objects, and why multi-object matters (pp. 221–223)
**Single-object writes** need atomicity and isolation too: writing a 20 kB JSON document, what if the network fails after 10 kB? What if power fails mid-overwrite (old and new spliced together)? What if another client reads during the write? Storage engines almost universally provide atomicity (via a crash-recovery log) and isolation (a lock per object) **for a single object on one node**. Some offer richer operations: **atomic increment** (no read-modify-write cycle) and **compare-and-set** (write only if unchanged). Useful against lost updates — but **not transactions**; calling them "lightweight transactions" or "ACID" is marketing. A transaction groups multiple operations on multiple objects.

**Do we need multi-object transactions?** Many distributed stores abandoned them (hard across partitions, can hurt availability/performance) — but nothing fundamentally prevents them (Chapter 9). Cases where several objects must be coordinated:
- **Foreign keys / graph edges**: records referring to each other must stay valid.
- **Denormalized data in document databases**: updating several documents together (Figure 7-2).
- **Secondary indexes**: they're separate objects; without isolation a record can appear in one index but not another.

These can be done without transactions, but error handling becomes much harder without atomicity, and concurrency problems arise without isolation.

### Handling errors and aborts (pp. 223–224)
ACID databases prefer to **abandon a transaction entirely** rather than violate atomicity, isolation or durability. Leaderless "best effort" stores work differently: "the database will do as much as it can, and if it runs into an error, it won't undo what it already did" — recovery is the application's job.

Sadly, many developers think only about the happy path; ORMs like Rails' ActiveRecord and Django **don't retry aborted transactions** — the exception bubbles up and the user's input is lost, defeating the purpose of aborts. Retrying isn't perfect though:
1. If the transaction **succeeded but the acknowledgement was lost**, retrying performs it twice — unless you deduplicate at the application level.
2. If the error is due to **overload**, retrying makes it worse — limit retries, use exponential backoff, treat overload errors specially.
3. Only **transient** errors (deadlock, isolation violation, temporary network interruption, failover) are worth retrying; permanent ones (constraint violation) aren't.
4. **Side effects outside the database** (sending an email) may happen even if the transaction aborts; to make several systems commit or abort together, there's two-phase commit (Chapter 9).
5. If the **client process fails while retrying**, the data it was trying to write is lost.
:::

:::practice 24-atomicity | Crash between two writes
Inject crashes into email delivery with and without a transaction, then retry — and discover the crash-after-commit duplicate problem and fix it with idempotence.
:::

:::quiz
### predict
Email delivery inserts a message and then increments the unread counter, without a transaction. The process crashes between the two writes. What remains?
- [ ] Neither write
- [x] The message is stored but the counter was never incremented — permanently out of sync
- [ ] The counter is incremented, the message is missing
- [ ] The database rolls back automatically
>>>
Without atomicity, the first write stays. With a transaction, the database discards it on abort (Figure 7-3).

### mcq
Is a compare-and-set operation a transaction in the usual sense?
- [ ] Yes, it's a lightweight transaction
- [x] No — it's a useful single-object operation, but a transaction groups multiple operations on multiple objects into one unit
- [ ] Yes, if the database is ACID
- [ ] Only in document databases
>>>
p. 222: calling such operations "transactions" or "ACID" is misleading marketing.

### mcq
Which situation does NOT, by itself, need a multi-object transaction?
- [ ] Inserting rows that reference each other by foreign key
- [ ] Updating a denormalized counter along with the records it counts
- [ ] Keeping a secondary index in sync with the data
- [x] Updating several fields inside one self-contained document
>>>
Fields in one document are a single object — single-object atomicity suffices (p. 222). The other three involve several objects.

### mcq
Which error is pointless to retry?
- [ ] A deadlock abort
- [ ] A serialization failure under serializable isolation
- [x] A unique-constraint violation
- [ ] A temporary network interruption during failover
>>>
A permanent error will fail again on retry (p. 224).

### scenario
Your web app sends a "payment received" email inside the same transaction that records the payment. Under load, transactions are sometimes aborted with deadlocks and retried. What bug will customers notice, and how would you fix it?
>>>
Customers may receive several "payment received" emails (one per attempt), or receive an email for a payment whose transaction finally failed, because the email is an external side effect that isn't undone by an abort (p. 224). Fix: move the email out of the transaction — record "email to send" in the database within the transaction (an outbox), and have a separate process send each recorded email exactly once after commit, with an idempotency key; or use a mechanism that commits both atomically (2PC, Chapter 9).

### explain
Why does the book say it's "a shame" that popular ORMs don't retry aborted transactions?
>>>
Because the whole point of aborts is to make safe retries possible: an aborted transaction changed nothing, so simply running it again is a simple, effective way to recover from transient problems like deadlocks or serialization failures. If the framework instead throws the error up to the user, the user's input is lost and they see an error, even though the database designed the abort precisely so the application could try again (p. 223) — ideally with limits, backoff and only for transient errors.
:::

:::connect Where this goes next
Atomicity handles faults. The rest of the chapter is about isolation — concurrency. Tomorrow: the weakest useful isolation level, read committed, and the two anomalies it prevents.
:::
