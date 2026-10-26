---
title: Review — Chapter 7 Checkpoint
kind: assessment
minutes: 70
chapter: 7
objectives:
- Retrieve all of Chapter 7 from memory
- Diagnose concurrency anomalies in unfamiliar applications
- Choose an isolation level and technique for a given workload
reading:
- Chapter 7 Summary | 257-259
complete:
- You did today's spaced review
- You answered the checkpoint without notes
- Exercises 24–27 are done (or consciously skipped)
---

:::review Today's spaced review
Scheduled questions from Weeks 1–11.
:::

:::task The anomaly ladder
From memory, write the six anomalies of the Chapter 7 summary in order and, for each: a one-sentence definition, a real example, the weakest isolation level that prevents it, and a manual workaround if you're stuck at a weaker level. Check against pp. 257–258 and the simulator.
:::

:::quiz Chapter 7 checkpoint
### scenario
An airline seat-selection service runs on PostgreSQL at the default isolation level (read committed). Two passengers sometimes get the same seat. The code: `SELECT count(*) FROM seats_taken WHERE flight=? AND seat=?;` then, if 0, `INSERT INTO seats_taken …`. Name the anomaly and give three fixes, from least to most general.
>>>
Write skew via a phantom: both transactions check for the absence of a row, both see none, both insert (p. 241). Fixes: (1) a UNIQUE constraint on (flight, seat) — the second insert fails; (2) materialize the conflict / lock: pre-create one row per seat and `SELECT … FOR UPDATE` it (or update it atomically with a condition `UPDATE seats SET passenger=? WHERE flight=? AND seat=? AND passenger IS NULL`); (3) run the transaction at SERIALIZABLE (SSI in PostgreSQL) and retry on serialization failure.

### mcq
Which isolation level is the weakest one that prevents read skew?
- [ ] Read uncommitted
- [ ] Read committed
- [x] Snapshot isolation
- [ ] Only serializable
>>>
Summary p. 258: read skew is most commonly prevented with snapshot isolation (MVCC).

### tradeoff
A read-heavy analytics app with occasional short write transactions needs serializability. 2PL or SSI?
- [x] SSI: read-only queries need no locks and never block writers, and short writes keep the abort rate low
- [ ] 2PL: reads take shared locks, which helps analytics
- [ ] Actual serial execution, regardless of data size
- [ ] Read committed is enough
>>>
Under 2PL, long analytic reads would hold shared locks and block writes (and vice versa). SSI's read-only transactions run on snapshots without locks, and short write transactions rarely conflict (pp. 256–257).

### mcq
Which statement is FALSE?
- [ ] Atomic increment prevents lost updates on a single counter
- [ ] SELECT FOR UPDATE can prevent write skew when the rows being checked already exist
- [x] Snapshot isolation in PostgreSQL detects and prevents write skew automatically
- [ ] Index-range locks approximate predicate locks
>>>
PostgreSQL's repeatable read doesn't detect write skew; its serializable level (SSI) does (p. 239).

### explain
Connect Chapter 7 to Chapters 5 and 6: why do multi-object transactions become harder in a replicated and partitioned database? Give one example from each chapter.
>>>
Replication (Ch 5): locks and compare-and-set assume one up-to-date copy; with multi-leader or leaderless replication, concurrent writes on different replicas can't be prevented by local locks, so you get conflicts and siblings; and asynchronous replication can lose committed writes on failover, weakening durability. Partitioning (Ch 6): a transaction touching several partitions (e.g. a document and its term-partitioned global index entries, or VoltDB cross-partition transactions) needs coordination across nodes so all partitions commit or abort together, which is slow and needs an atomic commit protocol (2PC, Chapter 9); serializability across partitions needs distributed concurrency control (e.g. FoundationDB's distributed SSI).

### design
You're designing the transaction strategy for a ticketing system: reads of event pages dominate; ticket purchases must never oversell; peak load is extreme for popular events. Propose an approach and justify it with Chapter 7.
>>>
A good answer: keep event-page reads on snapshots or replicas (no locks, no interference with purchases). For purchases, avoid write skew/phantoms on the inventory: model inventory per ticket category as a single counter row and decrement atomically with a condition (`UPDATE inventory SET remaining = remaining − n WHERE event=? AND category=? AND remaining >= n`) — atomic, no read-modify-write race, no phantom; or, if purchase logic is complex (seat maps, per-user limits), run purchase transactions at SERIALIZABLE (SSI) with short transactions and automatic retry, materializing contention points (one row per seat) as needed. For extreme peaks on a hot event, a single-threaded queue/partition per event (actual serial execution) processes purchases in order with predictable throughput. Use idempotency keys so retries after timeouts don't double-purchase.
:::
