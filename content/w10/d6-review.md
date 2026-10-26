---
title: Review — ACID and Weak Isolation
kind: review
minutes: 60
chapter: 7
objectives:
- Retrieve ACID and weak isolation levels from memory
- Match anomalies to the isolation levels that prevent them
- Catch up on this week's exercises
reading:
- Re-read the anomaly list in the Chapter 7 Summary | 257-258
complete:
- You did today's spaced review
- You filled in the anomaly table from memory
- Exercises 24 and 25 are done
---

:::review Today's spaced review
Scheduled questions from Weeks 1–10.
:::

:::task Anomaly table from memory
Fill in, without notes: rows **dirty read, dirty write, read skew, lost update**; columns **No isolation / Read committed / Snapshot isolation (PostgreSQL) / Snapshot isolation (MySQL)** — mark ✓ prevented or ✗ possible. Then verify each cell with the Transactions simulator (W10 D3–D5 lessons).
:::

:::quiz Weak isolation checkpoint
### scenario
A nightly job computes "total money in all accounts" as an integrity check while customers keep making transfers. It sometimes reports a mismatch, but every individual balance is correct. Which anomaly is this, and what's the simplest fix?
>>>
Read skew (non-repeatable read): the long-running query sees some accounts before and some after concurrent transfers, so the total is inconsistent even though each value it read was committed. Fix: run the check in a transaction with snapshot isolation (e.g. PostgreSQL REPEATABLE READ), so it reads one consistent snapshot without blocking the writers (pp. 229–230).

### mcq
Which statement about read committed is correct?
- [ ] It prevents lost updates
- [ ] It requires read locks in most databases
- [x] It prevents dirty reads and dirty writes, typically with row write locks plus serving the old committed value to readers
- [ ] It's the same as snapshot isolation
>>>
Writes lock rows until commit (no dirty writes); readers get the last committed value instead of waiting (no dirty reads). It still allows read skew and lost updates (pp. 225–228).

### mcq
Which anomaly does snapshot isolation alone (without any lost-update detection) still allow?
- [ ] Dirty reads
- [ ] Read skew
- [x] Lost updates
- [ ] Dirty writes
>>>
Writers still lock each other out (no dirty writes) and reads use snapshots — but two read-modify-write cycles can still clobber each other unless the database detects it (p. 236).

### explain
In your own words: why is "atomicity" in ACID different from "atomic" in multi-threaded programming? Which ACID letter corresponds to the multi-threading meaning?
>>>
In multi-threading, "atomic" means no other thread can observe a half-finished operation — that's about concurrency, which corresponds to ACID's **isolation**. ACID's atomicity is about faults: if a transaction can't complete (crash, network failure, disk full, constraint violation), all of its writes are discarded, so the application can safely retry. It says nothing about what concurrent transactions see (p. 216). (The book even notes "atomic increment" should strictly be called isolated or serializable increment.)

### design
Your app lets users "like" a post; the like count is shown on every view. Pick an approach to keep counts correct at 10,000 likes/second on one hot post in (a) a single PostgreSQL database and (b) a leaderless Cassandra-style store.
>>>
(a) Use an atomic `UPDATE posts SET likes = likes + 1 WHERE id = …` (no read-modify-write); for an extremely hot row, reduce lock contention by splitting the counter into N sub-counter rows updated randomly and summed on read (like key salting), or by batching increments. (b) Locks and compare-and-set don't work across replicas; use a commutative counter datatype (CRDT counter, e.g. Cassandra counters/Riak counters) that merges concurrent increments without loss — not LWW on a plain integer, which would lose updates (p. 237).
:::
