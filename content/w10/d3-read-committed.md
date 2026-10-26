---
title: Weak Isolation I — Read Committed
kind: lesson
minutes: 85
chapter: 7
objectives:
- Explain why concurrency bugs are hard to find and why weak isolation is common anyway
- Define dirty reads and dirty writes and why preventing each matters
- Explain how databases implement read committed (row write locks, remembering the old committed value)
- Explain why read locks are a bad way to prevent dirty reads
reading:
- Weak isolation levels | 224-225
- Read committed — no dirty reads, no dirty writes | 225-227
- Implementing read committed | 227-228
complete:
- You stepped through dirty-read and dirty-write scenarios at "No isolation" and "Read committed"
- You can explain why read committed doesn't prevent Figure 7-1's lost update
- You answered the quiz
---

:::problem Bugs that only appear when you're unlucky
Concurrency problems only arise when one transaction reads data another is modifying, or two modify the same data at once (p. 224). They're **hard to find by testing** — they need unlucky timing, are rare and hard to reproduce — and hard to reason about in large applications where you don't know what other code touches the database.

So databases try to hide concurrency through **isolation**: serializable isolation would let you pretend there's no concurrency at all. But it has a performance cost many databases don't want to pay, so it's common to use **weak (non-serializable) isolation levels**, which prevent some anomalies but not all. Those bugs are real: they've caused lost money, financial audits and corrupted customer data. "Use an ACID database for financial data!" misses the point — many popular relational databases use weak isolation by default. **We must understand the anomalies ourselves.**
:::

:::intuition Read committed: two promises
The most basic level (p. 225):

1. **No dirty reads** — when reading, you only see **committed** data.
2. **No dirty writes** — when writing, you only overwrite **committed** data.

(Some databases offer an even weaker **read uncommitted**: no dirty writes, but dirty reads allowed.)

**Why prevent dirty reads?** If a transaction updates several objects, a dirty read can show some of the updates but not others (the new email without the updated counter, Figure 7-2) — confusing for users and leading other transactions to wrong decisions. And if the transaction later **aborts**, a dirty reader has seen data that **never existed**. Under read committed, other transactions see a transaction's writes only when it commits, and then all at once (Figure 7-4).

**Why prevent dirty writes?** If two transactions update several objects and their writes interleave, you can get a mix: in Figure 7-5, Alice and Bob both try to buy the same car; the listing goes to Bob but the invoice to Alice. Read committed prevents such mishaps, usually by **delaying the second write until the first transaction commits or aborts**.

But read committed does **not** prevent the counter race of Figure 7-1: there, the second write happens after the first transaction committed, so it's not a dirty write — still incorrect, for a different reason (the lost update, Day 5).
:::

:::visual TxnSim | Dirty writes and dirty reads
@props {"scenario":"dirtyWrite","level":"none"}
**Try this:**
1. **Dirty write** (Figure 7-5) at **No isolation**: step through — the car goes to one buyer, the invoice to the other. Switch to **Read committed**: Bob's first write is **blocked** by Alice's lock until she commits.
2. Choose **Dirty read** (Figure 7-2): at No isolation, user 2 sees the email but a zero counter. At Read committed, user 2 sees the old committed state of both.
3. Choose **Lost update** at Read committed: it still loses an update. Why isn't that a dirty write?
:::

:::details Implementing read committed (pp. 227–228)
The default in Oracle 11g, PostgreSQL, SQL Server 2012, MemSQL and many others.

**Dirty writes** are prevented with **row-level locks**: to modify an object, a transaction acquires a lock on it and holds it until commit or abort. Only one transaction holds the lock; another writer waits. Done automatically in read committed (and stronger) modes.

**Dirty reads** could be prevented with the same lock (briefly acquire it to read), but **read locks work badly in practice**: one long-running write transaction would force many read-only transactions to wait, hurting their response times and operability — a slowdown in one part of the application ripples into a completely different part through lock waits.

So most databases instead **remember two values** for every object being written: the **old committed value** and the **new value** set by the transaction holding the write lock. Other transactions reading the object get the old value until the writer commits; then they switch to the new one. (At the time of writing, only IBM DB2 and SQL Server with `read_committed_snapshot=off` used locks for read committed.)
:::

:::quiz
### mcq
What is a dirty read?
- [ ] Reading a value that was overwritten after you read it
- [x] Reading data written by another transaction that hasn't committed (yet)
- [ ] Reading from a stale replica
- [ ] Reading corrupted bytes from disk
>>>
p. 225. Read committed prevents it.

### predict
Under read committed, transaction A has written x = 3 but not committed. Transaction B reads x. What does B get, and how does the database do it?
- [ ] 3, because it's the latest value
- [x] The old committed value (2): the database keeps the old committed value alongside A's uncommitted one and gives readers the committed one
- [ ] B blocks until A commits, in most databases
- [ ] An error
>>>
Most databases avoid read locks and serve the old committed value (Figure 7-4, p. 228).

### mcq
Why don't most databases prevent dirty reads with read locks?
- [ ] Read locks are impossible to implement
- [x] One long-running write transaction would make many read-only transactions wait, harming response times and spreading slowdowns across the application
- [ ] Read locks cause dirty writes
- [ ] Read locks use too much disk space
>>>
A reader would have to wait for any writer holding the lock, so a slow write transaction delays unrelated reads, spreading slowdowns through the application. Remembering the old committed value avoids that (p. 228).

### mcq
Does read committed prevent the lost update of Figure 7-1?
- [ ] Yes, because it prevents dirty writes
- [x] No — the second transaction's write happens after the first committed, so it isn't a dirty write; it's a lost update, which needs other techniques
- [ ] Yes, because it prevents dirty reads
- [ ] Only with read locks
>>>
p. 227, and you saw it in the simulator.

### explain
Explain, using Figure 7-5, what goes wrong with dirty writes and how row-level locks fix it.
>>>
Alice and Bob each run a transaction that updates two objects: the car listing's buyer and the invoice's recipient. Without dirty-write prevention their writes can interleave: Bob's listing update overwrites Alice's uncommitted one, while Alice's invoice update overwrites Bob's — ending with the car sold to Bob and the invoice sent to Alice. With row-level write locks held until commit, Bob's first write must wait until Alice's transaction commits (or aborts); then Bob overwrites both objects, and the final state consistently reflects one buyer.
:::

:::connect Where this goes next
Read committed sounds like enough — tomorrow shows a simple anomaly it allows (read skew: money seeming to vanish), and the most common fix, snapshot isolation (MVCC), which generalises today's "keep the old committed value" trick to many versions.
:::
