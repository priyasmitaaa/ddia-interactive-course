---
title: Implementing Replication Logs
kind: lesson
minutes: 80
chapter: 5
objectives:
- Explain statement-based replication and why non-determinism breaks it
- Explain WAL shipping and why it couples leader and followers to one storage format
- Explain logical (row-based) logs and their advantages, including change data capture
- Explain when trigger-based replication is useful
reading:
- Implementation of replication logs — statement-based, WAL shipping, logical, trigger-based | 152-155
complete:
- You ran the replication-log exercise and got 0 divergences with the row-based log
- You can explain the zero-downtime upgrade trick that logical logs enable
- You answered the quiz
---

:::problem What exactly does the leader send?
"The leader sends its changes to the followers" — but in what form? The SQL statements it ran? The bytes it wrote to disk? The rows that changed? Each choice has surprising consequences for correctness, upgrades, and what else you can do with the log.
:::

:::intuition Instructions, bytes, or results
Think of keeping two kitchens' recipe results identical:

- **Statement-based**: phone the other kitchen the *instructions* ("add a pinch of salt, stir until done"). If an instruction is vague or random, results differ.
- **WAL shipping**: send the *exact physical state* (photograph every shelf). Precise, but only works if both kitchens have identical shelving.
- **Logical log**: send the *results* ("pot 3 now contains 2 litres of soup with recipe v4"). Precise, and doesn't care how the other kitchen arranges its shelves.
:::

:::details The four methods (pp. 152–155)
### Statement-based replication
The leader logs every write statement (`INSERT`, `UPDATE`, `DELETE`) and followers execute them as if from a client. It breaks when:
- statements call **non-deterministic functions** (`NOW()`, `RAND()`), giving different values on each replica;
- statements use **auto-increment** or depend on existing data (`UPDATE … WHERE <condition>`) — they must run in exactly the same order everywhere, which limits concurrent transactions;
- statements have **side effects** (triggers, stored procedures, user-defined functions) that aren't perfectly deterministic.

Workarounds exist (the leader replaces `NOW()` with a fixed value), but edge cases abound. MySQL used it before 5.1; today MySQL switches to row-based logging if a statement is non-deterministic. VoltDB uses it safely by requiring deterministic transactions.

### Write-ahead log (WAL) shipping
Storage engines already write every change to a log (the LSM log itself, or a B-tree's WAL — Chapter 3). Ship that same log to followers, which build exactly the same data structures. Used by PostgreSQL and Oracle. The catch: the WAL is **very low-level** — which bytes changed in which disk block — so replication is **coupled to the storage engine**. If the storage format changes between versions, leader and followers usually can't run different versions. That matters operationally: if followers could run a newer version, you could do a **zero-downtime upgrade** — upgrade the followers, then fail over to an upgraded one. With WAL shipping, upgrades often need downtime.

### Logical (row-based) log replication
Use a different log format for replication, decoupled from storage internals: a **logical log**. For a relational database, records at row granularity:
- **insert**: the new values of all columns;
- **delete**: enough to identify the row (the primary key; without one, the old values of all columns);
- **update**: enough to identify the row, plus the new values of all (or the changed) columns.

A transaction touching several rows produces several records followed by a commit record. MySQL's binlog in row-based mode works like this. Advantages: easier to keep **backward compatible** (leader and follower on different versions, even different storage engines); and **easy for external applications to parse** — to feed a data warehouse, or build custom indexes and caches. That's **change data capture**, central to Chapter 11.

### Trigger-based replication
Sometimes you need replication in the application layer: replicate only a subset of data, from one kind of database to another, or with custom conflict-resolution logic. Tools like Oracle GoldenGate read the database log; alternatively, **triggers** (custom code run on every write) log changes into a separate table that an external process reads and replicates (Databus for Oracle, Bucardo for Postgres). Higher overhead, more bugs and limitations than built-in replication — but flexible.
:::

:::practice 18-replication-logs | Replicate one workload two ways
Run a workload with `random()` and a data-dependent `UPDATE` through statement-based replication (diverges every time), then implement a row-based log (never diverges).
:::

:::quiz
### mcq
A statement `UPDATE accounts SET bonus = RAND() * 100 WHERE active` is replicated statement-by-statement. What happens?
- [ ] All replicas get identical bonuses
- [x] Each replica computes different random bonuses, so replicas diverge
- [ ] The statement is rejected
- [ ] Only the leader runs it
>>>
Non-deterministic functions are the first failure mode of statement-based replication (p. 152).

### mcq
Why does WAL shipping often prevent running different database versions on leader and followers?
- [ ] WALs are encrypted per version
- [x] The WAL describes low-level changes to disk blocks in a specific storage format, so a version with a different format can't apply it
- [ ] Followers can't read logs
- [ ] WAL shipping only works with MySQL
>>>
Coupling to the storage engine makes replication brittle across upgrades (p. 153).

### predict
With a logical log that permits version mismatch, how can you upgrade the database software with zero downtime?
- [ ] Upgrade the leader first while it keeps serving writes
- [x] Upgrade the followers first, then fail over to make an upgraded follower the leader, then upgrade the old leader
- [ ] Stop all writes for a few seconds
- [ ] It's impossible
>>>
That's the trick the book describes (p. 153). It only works if followers on the new version can still consume the old leader's replication log.

### mcq
Which feature of logical logs makes change data capture possible?
- [ ] They're smaller than statements
- [x] They describe row-level changes independently of storage internals, so external systems can easily parse them
- [ ] They include the SQL text
- [ ] They're synchronous
>>>
External consumers (warehouses, search indexes, caches) can read "row X changed to Y" without understanding disk blocks (p. 154).

### explain
You need to replicate only the `orders` table from PostgreSQL into a different database product, transforming the data on the way. Which replication method fits, and what does it cost?
>>>
Application-level replication: trigger-based (a trigger writes each change to a changes table, read by an external process that transforms and writes to the other database), or a tool that reads the database's logical log (change data capture). Built-in replication copies everything to the same kind of database and can't do this. The cost: more overhead on the database, more moving parts, and more potential for bugs and subtle limitations than the built-in mechanism (pp. 154–155).
:::

:::connect Where this goes next
Your Project 1 v1→v2 format change is the same issue as WAL shipping vs logical logs: who can read whose bytes during an upgrade. Chapter 11 turns the logical log into the backbone of an architecture (change data capture, event sourcing). Tomorrow: what users experience when followers lag.
:::
