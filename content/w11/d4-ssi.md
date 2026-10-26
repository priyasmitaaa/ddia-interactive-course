---
title: Serializability III — Serializable Snapshot Isolation (SSI)
kind: lesson
minutes: 95
chapter: 7
objectives:
- Distinguish pessimistic and optimistic concurrency control and when each performs better
- Explain SSI as snapshot isolation plus detection of decisions based on outdated premises
- Explain the two detection cases (stale MVCC reads; writes affecting prior reads)
- Explain why SSI aborts at commit time, and SSI's performance characteristics
- Summarise Chapter 7's anomalies and isolation levels
reading:
- Serializable snapshot isolation; pessimistic vs optimistic | 252-253
- Decisions based on an outdated premise; detecting stale MVCC reads | 253-255
- Detecting writes that affect prior reads; performance of SSI | 255-257
- Summary | 257-259
complete:
- You ran all six scenarios under SSI and saw which transaction aborts in each
- You can explain Figures 7-10 and 7-11 in your own words
- You answered the quiz
---

:::problem Are serializability and performance at odds?
So far: serializability that doesn't perform (2PL) or doesn't scale (serial execution), versus weak isolation that performs well but permits lost updates, write skew and phantoms. Perhaps they aren't fundamentally at odds: **serializable snapshot isolation (SSI)**, first described in 2008 (Michael Cahill's PhD thesis), gives full serializability with only a small penalty over snapshot isolation (p. 252). Used in PostgreSQL's serializable level since 9.1, and in distributed form in FoundationDB.
:::

:::intuition Proceed optimistically, check at the end
**2PL is pessimistic**: if anything might go wrong (a lock held by another transaction), wait until it's safe — like mutexes in multithreaded code. **Serial execution is pessimistic to the extreme**: effectively an exclusive lock on the whole database (or partition), compensated by making each transaction very fast.

**SSI is optimistic**: transactions continue even if something potentially dangerous happens, hoping all is well. At **commit**, the database checks whether isolation was violated; if so, the transaction is **aborted** and retried. Only serializable executions commit.

Optimistic concurrency control is an old idea. It performs **badly under high contention** (many aborts; retries add load near maximum throughput). With spare capacity and moderate contention it tends to **beat pessimistic** approaches — and contention can be reduced with commutative operations (concurrent counter increments don't conflict if the counter isn't read).

SSI's twist versus older optimistic schemes: all reads come from a **consistent snapshot** (snapshot isolation), plus an algorithm for detecting serialization conflicts among writes and deciding which transaction to abort.
:::

:::visual TxnSim | SSI catches outdated premises
@props {"scenario":"writeSkew","level":"ssi"}
**Try this:** step through **Write skew** under SSI. Nothing blocks; both transactions read 2 and write. A commits first. When B commits, the database sees that A — which committed after B's snapshot — wrote data B had read: B's premise is outdated → **abort**. Then try **Phantom** and **Lost update** under SSI, and **Read skew**: Alice's read-only transaction never aborts.
:::

:::details How SSI detects conflicts (pp. 253–257)
**Decisions based on an outdated premise.** Write skew follows a pattern: read, decide, write. Under snapshot isolation, by commit time the data read may have changed — the **premise** ("two doctors are on call") may no longer be true. The database doesn't know how the application used the query result, so to be safe it assumes any change in the result invalidates the transaction's writes. It must detect when a transaction may have acted on an outdated premise and abort it. Two cases:

**1. Detecting stale MVCC reads** (Figure 7-10): a write that was uncommitted when the read happened. Transaction 43 reads Alice as on call because transaction 42's change is uncommitted and ignored by MVCC visibility rules. By the time 43 commits, 42 has committed, so the ignored write has taken effect. The database **tracks when a transaction ignores another's writes** due to visibility rules; at commit it checks whether any ignored writes have since committed → abort. **Why wait until commit?** If 43 were read-only, there'd be no risk of write skew; at read time the database doesn't know whether the transaction will write. SSI must support long-running read-only snapshot queries without unnecessary aborts.

**2. Detecting writes that affect prior reads** (Figure 7-11): the write happens after the read. Like index-range locks, record (e.g. on the `shift_id = 1234` index entry, or table-level without an index) that transactions 42 and 43 read that data — but these locks **don't block**. When a transaction writes, it looks up recent readers of the affected data and notifies them that what they read may be out of date — a **tripwire**. In the figure, 42 commits first (43's write hasn't taken effect yet); when 43 commits, 42's conflicting write has committed, so 43 aborts. Read information can be forgotten once the transaction and all concurrent ones finish.

**Performance.** Granularity of tracking is a trade-off: precise tracking means fewer unnecessary aborts but more bookkeeping. Sometimes reading overwritten data is provably still serializable; PostgreSQL uses this theory to reduce aborts. Versus 2PL: **no blocking** — readers and writers don't block each other, so latency is far more predictable; read-only queries need no locks, great for read-heavy workloads. Versus serial execution: not limited to one core — FoundationDB distributes conflict detection across machines and supports serializable transactions across partitions. The **abort rate** matters: long read-write transactions likely conflict, so they should be short (long read-only ones may be fine). SSI is probably less sensitive to slow transactions than 2PL or serial execution.

### Chapter 7 summary (pp. 257–259)
Transactions are an abstraction that lets applications pretend some concurrency problems and faults don't exist — a large class of errors becomes a simple abort and retry. Applications with simple access patterns might not need them; for complex ones they hugely reduce the error cases. Without transactions, denormalized data drifts, and reasoning about interacting accesses becomes very hard. Anomalies: **dirty reads, dirty writes, read skew, lost updates, write skew, phantom reads**. Weak levels protect against some; only **serializable** protects against all. Three implementations: **actual serial execution**, **two-phase locking**, **serializable snapshot isolation**. The ideas apply to single-node and distributed databases alike — distribution adds new challenges (next two chapters).
:::

:::quiz
### mcq
What makes SSI "optimistic"?
- [ ] It never aborts transactions
- [x] Transactions proceed without blocking; at commit, the database checks whether the execution was serializable and aborts the transaction if not
- [ ] It assumes there are no concurrent transactions
- [ ] It uses fewer locks than read committed
>>>
Instead of waiting whenever something might go wrong (pessimistic, like 2PL), it lets transactions run and validates at commit time, aborting only the ones whose execution wasn't serializable (pp. 252–253).

### mcq
When does optimistic concurrency control perform worse than pessimistic?
- [ ] When there is spare capacity and little contention
- [x] Under high contention, when many transactions access the same objects and many must abort and retry, adding load
- [ ] For read-only queries
- [ ] Never
>>>
With many transactions touching the same objects, most attempts fail validation and retry, and near maximum throughput the retries add even more load. With spare capacity and low contention, optimistic tends to win (p. 253).

### predict
Under SSI, a long read-only reporting transaction reads data that a concurrent write transaction modifies and commits. What happens to the report?
- [ ] It's aborted
- [ ] It blocks the writer
- [x] It commits normally — read-only transactions read a consistent snapshot and can't cause write skew, so SSI doesn't abort them
- [ ] It sees the new data mid-query
>>>
That's why SSI waits until commit to decide (p. 254). In the simulator, read skew under SSI shows Alice committing fine.

### mcq
In Figure 7-10, why can't transaction 43 commit?
- [ ] It read uncommitted data
- [x] It ignored transaction 42's then-uncommitted write (MVCC visibility), and 42 has since committed — so 43's premise is outdated
- [ ] It deadlocked with 42
- [ ] 42 aborted
>>>
Stale MVCC read detection (pp. 254–255).

### tradeoff
Compared with 2PL, what's SSI's main advantage, and what must applications do to benefit?
- [x] No blocking between readers and writers, so latency is more predictable; read-write transactions should be short to keep the abort rate low (and aborted ones must be retried)
- [ ] It never aborts
- [ ] It doesn't need snapshots
- [ ] It's limited to one CPU core
>>>
Readers and writers never block each other, so latency is predictable; but long read-write transactions are likely to conflict and abort, so keep them short and retry aborted ones (pp. 256–257).

### explain
In one paragraph, compare the three ways to implement serializability: how each prevents write skew in the doctors example, and its main cost.
>>>
**Serial execution** runs Alice's and Bob's transactions one at a time on a single thread, so the second sees only one doctor and does nothing; cost: throughput limited to one core per partition, transactions must be short stored procedures with data in memory. **2PL** makes each transaction take a shared (predicate/index-range) lock on the on-call doctors it read; each one's write then needs an exclusive lock that conflicts with the other's shared lock → deadlock → one is aborted and retried; cost: blocking, deadlocks, poor and unpredictable latency under contention. **SSI** lets both run on snapshots without blocking; at commit, the second committer finds that a concurrent committed transaction changed data it read (its premise), and is aborted and retried; cost: aborts under contention and bookkeeping of reads — but generally predictable latency.
:::

:::connect Where this goes next
Tomorrow's lab: implement MVCC snapshot isolation and SSI yourself. After that, Part II's last two chapters ask what changes when the transactions and the database are **distributed**: unreliable networks and clocks (Chapter 8), and consensus and atomic commit (Chapter 9).
:::
