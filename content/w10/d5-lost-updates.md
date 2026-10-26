---
title: Preventing Lost Updates
kind: lesson
minutes: 95
chapter: 7
objectives:
- Recognise the read-modify-write pattern behind lost updates in several forms
- Prevent lost updates with atomic write operations, explicit locking (SELECT FOR UPDATE), automatic detection, and compare-and-set
- Explain which databases detect lost updates automatically under snapshot isolation
- Explain why locks and compare-and-set don't apply to multi-leader/leaderless replication, and what does
reading:
- Preventing lost updates; atomic write operations | 233-235
- Explicit locking; automatically detecting lost updates; compare-and-set | 235-236
- Conflict resolution and replication | 237
complete:
- You reproduced lost updates with real threads and fixed them three ways
- You stepped through the lost update under snapshot isolation with and without detection
- You answered the quiz
---

:::problem Two read-modify-write cycles, one result
So far we've mostly discussed what *reading* transactions see. But two transactions *writing* concurrently cause other problems; the best known is the **lost update** (Figure 7-1). It happens whenever an application **reads a value, modifies it, and writes it back** (a read-modify-write cycle) and two transactions do so concurrently: the second write doesn't include the first modification, so it **clobbers** it (p. 234). Examples:

- incrementing a counter or updating an account balance;
- making a local change to a complex value, e.g. adding an element to a list inside a JSON document;
- two users editing a wiki page, each saving the whole page.
:::

:::intuition Four defences
1. **Atomic write operations** — let the database do the read-modify-write: `UPDATE counters SET value = value + 1 WHERE key = 'foo';`. MongoDB has atomic operations on parts of documents; Redis on data structures like priority queues. Usually the **best choice when applicable** (not for arbitrary text edits). Implemented with an exclusive lock held while reading and updating (**cursor stability**), or by running all atomic operations on one thread. Beware ORMs, which make it easy to accidentally write unsafe read-modify-write code.
2. **Explicit locking** — when the logic can't be a database operation (e.g. checking game rules before moving a piece), lock the rows first: `SELECT … FOR UPDATE` (Example 7-1). Works, but it's easy to forget a lock somewhere.
3. **Automatic detection** — let the cycles run in parallel; if the database detects a lost update, it **aborts** one transaction, which retries. Efficient together with snapshot isolation: PostgreSQL's repeatable read, Oracle's serializable and SQL Server's snapshot isolation do it; **MySQL/InnoDB's repeatable read does not** (so by some definitions it doesn't really provide snapshot isolation). Great because it needs no special application code.
4. **Compare-and-set** — in databases without transactions: update only if the value hasn't changed since you read it, otherwise retry. E.g. `UPDATE wiki_pages SET content = 'new' WHERE id = 1234 AND content = 'old';` — **but** if the database lets the WHERE clause read from an old snapshot, it may not be safe. Check before relying on it.
:::

:::visual TxnSim | Lost update vs isolation levels
@props {"scenario":"lost","level":"si"}
**Try this:** at **Snapshot isolation** with "detect lost updates" ticked, user 2's write is aborted (PostgreSQL-style). Untick it (MySQL-style): the update is lost. Try **Serializable: 2PL** — the two transactions deadlock and one is aborted.
:::

:::details Lost updates with replication (p. 237)
Locks and compare-and-set assume **a single up-to-date copy** of the data. Multi-leader and leaderless databases allow concurrent writes on several nodes, replicated asynchronously — there is no single up-to-date copy, so those techniques don't apply (more in Chapter 9, "Linearizability"). Instead: allow concurrent writes to create **siblings** and resolve/merge them afterwards with application code or special data structures (Chapter 5).

**Commutative atomic operations** work well across replicas: incrementing a counter or adding to a set gives the same result in any order — the idea behind Riak 2.0's datatypes, which merge concurrent updates so none are lost. **Last write wins**, on the other hand, is prone to lost updates — and unfortunately it's the default in many replicated databases.
:::

:::practice 25-lost-updates | Lose 1,400 increments, then fix it three ways
Eight threads, one counter, real SQLite connections. Implement the atomic update, the explicit lock (`BEGIN IMMEDIATE`) and compare-and-set.
:::

:::quiz
### mcq
Which code is safe against lost updates in most relational databases?
- [ ] `x = SELECT value ...; UPDATE ... SET value = x + 1` (two statements, read committed)
- [x] `UPDATE counters SET value = value + 1 WHERE key = 'foo'`
- [ ] Reading the value from a cache first
- [ ] Wrapping the two statements in a read committed transaction
>>>
The atomic operation makes the database perform the read-modify-write under its own lock (p. 234). Read committed alone doesn't prevent lost updates.

### mcq
In Example 7-1 (moving a game piece), why use `SELECT … FOR UPDATE` instead of an atomic operation?
- [ ] FOR UPDATE is faster
- [x] The application must check the game's rules before moving, logic that can't sensibly be expressed as a database operation
- [ ] Atomic operations don't work on strings
- [ ] Games need serializable isolation
>>>
p. 235. The lock forces concurrent read-modify-write cycles on the same piece to happen one after another.

### predict
Two transactions under MySQL/InnoDB's REPEATABLE READ both read a counter (42) and write 43. What happens, compared with PostgreSQL's REPEATABLE READ?
- [ ] Both databases abort one transaction
- [x] MySQL lets both commit (one update lost); PostgreSQL detects the lost update and aborts one, which retries
- [ ] Both lose the update
- [ ] Both deadlock
>>>
p. 236. You reproduced both behaviours with the "detect lost updates" checkbox.

### mcq
Why don't locks and compare-and-set prevent lost updates in a leaderless replicated database?
- [ ] They're too slow
- [x] They assume a single up-to-date copy of the data, but leaderless and multi-leader systems accept concurrent writes on different replicas
- [ ] Leaderless databases don't have keys
- [ ] They do prevent them
>>>
p. 237. Use siblings with merging, or commutative operations (CRDT-style counters and sets).

### tradeoff
Compare-and-set vs explicit locking for a contended counter (from your exercise). What's the trade-off?
- [x] CAS holds no lock during the application's work, but under contention many attempts fail and retry; locking never retries but makes others wait while the lock is held
- [ ] CAS always loses updates
- [ ] Locking is always faster
- [ ] They're identical
>>>
Optimistic vs pessimistic — the same trade-off as SSI vs 2PL next week.

### explain
Give two real-world examples of the lost-update pattern that are not counters, and say which defence you'd use for each.
>>>
Examples: (1) Two admins editing a product description in a CMS, each saving the whole text — use compare-and-set on a version number (reject the second save and show a merge/diff), or explicit locking while editing. (2) Two services appending a tag to a JSON array in a user document by reading, modifying and writing back the whole document — use the database's atomic array-append operation (e.g. MongoDB `$push`) or a lost-update-detecting snapshot isolation. (3) Reserving the last seat: read remaining seats, decrement — use an atomic conditional update (`UPDATE … SET seats = seats − 1 WHERE seats > 0`).
:::

:::connect Where this goes next
Lost updates involve two transactions writing the **same** object. Next week: **write skew**, where they write **different** objects based on a premise that becomes false — the doctors-on-call problem — and the three ways to get true serializability.
:::
