---
title: The Slippery Concept of a Transaction — What ACID Really Means
kind: lesson
minutes: 85
chapter: 7
objectives:
- Explain what a transaction is and what problems it lets an application ignore
- Explain why "transactions vs scalability" is a false dichotomy
- Define atomicity (abortability), consistency (an application property), isolation (serializability ideal) and durability precisely
- Explain why no single durability technique is perfect
reading:
- Chapter 7 opening | 213-214
- The slippery concept of a transaction; the meaning of ACID | 214-216
- Atomicity, consistency, isolation | 216-218
- Durability; replication and durability | 218-219
complete:
- You can say for each ACID letter whether it's a property of the database or the application
- You can explain "atomicity is not about concurrency"
- You answered the quiz
---

:::problem Everything can go wrong, at any moment
In real data systems (p. 213): the database software or hardware can fail mid-write; the application can crash halfway through a series of operations; the network can cut the application off from the database (or one node from another); several clients can write at once and overwrite each other; a client can read data that's only partially updated; race conditions cause surprising bugs.

Handling all of that correctly in every application is enormous work. For decades, the answer has been the **transaction**: group several reads and writes into a logical unit that either entirely succeeds (**commit**) or fails (**abort**, **rollback**) — and if it fails, the application can **safely retry**. The database provides the **safety guarantees**; the application gets a much simpler programming model.
:::

:::intuition Not a law of nature
Transactions were *created with a purpose* — to simplify the programming model (p. 214). Not every application needs them, and sometimes it's worth weakening or abandoning them for performance or availability.

Most relational databases follow IBM **System R** (1975), the first SQL database; MySQL, PostgreSQL, Oracle and SQL Server transactions are "uncannily similar". In the late 2000s, NoSQL databases brought new data models plus replication and partitioning by default — and **transactions were the main casualty**: abandoned entirely or redefined to mean much weaker guarantees. A belief spread that transactions are the antithesis of scalability; vendors meanwhile marketed transactions as essential for "serious applications with valuable data". The book: **both viewpoints are pure hyperbole** — transactions have advantages and limitations like any design choice.
:::

:::details The four letters (pp. 215–219)
**ACID** (Härder and Reuter, 1983) was meant as precise terminology, but implementations differ so much — especially around isolation — that "ACID compliant" has become **mostly a marketing term**. (Systems that aren't ACID are sometimes called **BASE**: Basically Available, Soft state, Eventual consistency — even vaguer; it seems to mean "not ACID".)

**Atomicity.** Elsewhere in computing (multi-threading) "atomic" means no one can see a half-finished operation. In ACID, atomicity is **not about concurrency** (that's isolation). It's about what happens when a fault occurs after some of a transaction's writes — a crash, a broken network connection, a full disk, a violated constraint: the transaction is **aborted and all its writes are discarded or undone**. Without it, after a failure midway you don't know which changes happened, and retrying risks doing things twice. With it, an aborted transaction changed nothing, so retrying is safe. *Abortability* would have been a better name.

**Consistency.** The most overloaded word in the book: replica consistency/eventual consistency (Chapter 5), linearizability in the CAP theorem (Chapter 9), and here, an **application-specific notion of a "good state"** — invariants that must always hold (e.g. credits and debits balance). If a transaction starts valid and preserves validity, invariants hold. But the **application** defines invariants and writes transactions that preserve them; the database can't stop you writing bad data (except specific constraints like foreign keys and uniqueness). So consistency is a property of the application; A, I and D are properties of the database. The C "doesn't really belong in ACID" (Joe Hellerstein: it was "tossed in to make the acronym work").

**Isolation.** Concurrent transactions touching the same records cause race conditions — like two clients incrementing a counter from 42 and both writing 43 (Figure 7-1). ACID isolation means concurrent transactions can't step on each other's toes. Textbooks formalise it as **serializability**: each transaction can pretend it's the only one running; the result is as if they ran one after another. In practice serializable isolation is rarely used because of its performance cost — Oracle 11g doesn't even implement it: its "serializable" is actually **snapshot isolation**, a weaker guarantee.

**Durability.** Once committed, data won't be forgotten, even after hardware faults or crashes. Single node: written to non-volatile storage, usually with a write-ahead log. Replicated: copied to some number of nodes. The database must wait for these before reporting commit. **Perfect durability doesn't exist** — if every disk and backup is destroyed at once, nothing can save you.

*Sidebar — replication and durability.* Durability once meant archive tape, then disk, now often replication. Nothing is perfect: a dead machine's disk keeps data but makes it inaccessible (replicas stay available); correlated faults (power outage, a bug on a particular input) can kill all replicas at once, losing in-memory data — so disk still matters for in-memory databases; async replication loses recent writes on leader failure; SSDs have been shown to violate guarantees on power loss (even fsync may not work); firmware has bugs; storage-engine/filesystem interactions cause hard-to-find corruption; data on disk can rot undetected, corrupting replicas and backups too; an unpowered SSD can lose data within weeks, depending on temperature. Only **risk-reduction techniques** exist — disk writes, remote replication, backups — use them **together**.
:::

:::visual TxnSim | A race condition without isolation
@props {"scenario":"lost","level":"none"}
This is Figure 7-1: two users increment a counter from 42. Press **Next step** repeatedly and watch both read 42 and both write 43. (Tomorrow and this week you'll see how isolation levels change this; leave the level at "No isolation" for now.)
:::

:::quiz
### mcq
Which ACID property is primarily about what happens when a fault occurs partway through a transaction's writes?
- [x] Atomicity — the transaction is aborted and its writes are undone, so it can be safely retried
- [ ] Isolation
- [ ] Consistency
- [ ] Durability
>>>
ACID atomicity is "abortability"; it has nothing to do with concurrency, which is isolation (p. 216).

### mcq
Why does the book say the C in ACID "doesn't really belong"?
- [ ] Because databases can't store invariants
- [x] Because consistency (invariants holding) depends on the application defining correct transactions; the database only provides atomicity, isolation and durability to help
- [ ] Because consistency is the same as durability
- [ ] Because NoSQL databases don't support it
>>>
The database can enforce some constraints (foreign keys, uniqueness), but in general the application defines what valid data is (p. 217).

### predict
Two clients concurrently read a counter (42), add 1, and write it back, with no isolation. What's the final value?
- [ ] 44
- [x] 43 — one increment is lost
- [ ] 42
- [ ] An error
>>>
Figure 7-1: both computed 43 from the same stale read. You'll prevent this in several ways this week.

### mcq
Oracle 11g's isolation level called "serializable" actually implements:
- [ ] Two-phase locking
- [ ] Read committed
- [x] Snapshot isolation, which is weaker than serializability
- [ ] Serializable snapshot isolation
>>>
p. 218. Names of isolation levels are notoriously unreliable — this chapter is about the actual guarantees.

### tradeoff
Which statement about durability is most accurate?
- [ ] Replication to three nodes makes data perfectly durable
- [ ] fsync to an SSD guarantees durability
- [x] No single technique is perfect; disk writes, replication and backups reduce different risks and should be combined
- [ ] In-memory databases don't need disks if they replicate
>>>
The replication-and-durability sidebar (pp. 218–219): correlated faults, firmware bugs, silent corruption and SSD behaviour all break individual techniques.

### explain
"Transactions are the antithesis of scalability" vs "you need ACID transactions for serious applications". Explain why the book calls both hyperbole.
>>>
Transactions are a design choice with costs and benefits. They do have performance and availability costs, especially distributed ones, but many systems scale with transactions (and Chapter 9 shows distributed transactions are possible). On the other hand, "ACID" guarantees vary wildly between products — many "ACID" databases default to weak isolation that permits real bugs — and some applications with simple access patterns don't need them. The useful question is which specific safety guarantees your application needs and what they cost (p. 215).
:::

:::connect Where this goes next
Atomicity and isolation both describe what happens when a transaction makes several writes — tomorrow's topic: single- vs multi-object operations, and how to handle aborts. The durability sidebar connects to Chapter 5 (async replication loses writes) and your Week 3 fsync measurements.
:::
