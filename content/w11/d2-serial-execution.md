---
title: Serializability I — Actual Serial Execution
kind: lesson
minutes: 85
chapter: 7
objectives:
- Explain why weak isolation is a "sad situation" and what serializability guarantees
- Name the three implementation techniques for serializability
- Explain what changed (cheap RAM, short OLTP transactions) to make single-threaded execution feasible
- Explain why serial execution requires stored procedures, and their pros and cons
- Explain how partitioning scales serial execution and the cost of cross-partition transactions
reading:
- Serializability | 242-243
- Actual serial execution; stored procedures | 243-246
- Pros and cons of stored procedures; partitioning; summary of serial execution | 246-248
complete:
- You built the single-threaded executor and compared throughputs
- You can state the four constraints of serial execution
- You answered the quiz
---

:::problem Weak isolation is a mess
The situation (pp. 242–243): isolation levels are hard to understand and inconsistently implemented ("repeatable read" means different things to different people); it's hard to tell from application code whether it's safe at a given level; and there are no good tools to detect race conditions — testing is hard because the bugs are non-deterministic. This has been true since the 1970s, and the researchers' answer has always been simple: **use serializable isolation!**

**Serializable isolation** guarantees that even though transactions may run in parallel, the result is the same as if they ran **one at a time, serially**. If each transaction is correct on its own, they stay correct when run concurrently: the database prevents **all** race conditions. So why doesn't everyone use it? It depends on how it's implemented. Three techniques: **actual serial execution**, **two-phase locking**, and **serializable snapshot isolation**.
:::

:::intuition Remove the concurrency
The simplest way to avoid concurrency problems: **execute one transaction at a time on a single thread**. Serializable by definition.

Obvious — yet database designers only decided around **2007** that a single-threaded loop was feasible. What changed (p. 244)?
- **RAM became cheap** enough to keep the whole active dataset in memory: no waiting for disk.
- OLTP transactions are usually **short** with few reads and writes; long analytic queries are read-only and can run on a snapshot outside the serial loop.

Implemented in **VoltDB/H-Store, Redis and Datomic**. Without lock overhead, a single thread can even beat a concurrent system — but throughput is limited to **one CPU core**, and transactions must be structured differently.
:::

:::details Stored procedures, partitioning, constraints (pp. 244–248)
**Interactive transactions don't fit.** Early databases imagined a transaction spanning a whole user flow (search flights, choose, book, enter details, pay). Humans are slow, so databases would hold huge numbers of idle transactions; instead OLTP apps keep transactions short and within one HTTP request. But even without the human, transactions are usually **interactive**: the application sends a query, reads the result, sends another, across the network (Figure 7-9). With serial execution, the database would spend most of its time **waiting for the application's next statement**. So single-threaded systems **don't allow interactive multi-statement transactions**: the application submits the whole transaction as a **stored procedure** in advance. With data in memory, it runs very fast without network or disk waits.

**Stored procedures' bad reputation:** each vendor has its own archaic language (PL/SQL, T-SQL, PL/pgSQL) without a library ecosystem; code in the database is hard to debug, version, deploy, test and monitor; and a badly written procedure hurts a shared, performance-sensitive database more than bad application code would. **Modern answers:** general-purpose languages — VoltDB uses Java or Groovy, Datomic Java or Clojure, Redis Lua. VoltDB also **replicates by executing the same stored procedure on each replica**, so procedures must be **deterministic** (special APIs for the current time, etc.).

**Partitioning** (pp. 246–247). To use more cores and machines, partition the data (VoltDB supports it) so each transaction touches **one partition**; each partition gets its own single thread, and throughput scales linearly with cores. Transactions spanning partitions need lock-step coordination across them and are **vastly slower**: VoltDB reports ~**1,000 cross-partition writes per second**, orders of magnitude below single-partition throughput, and adding machines doesn't help. Simple key-value data partitions easily; data with many secondary indexes needs lots of cross-partition coordination.

**Summary of serial execution** (pp. 247–248) — viable within constraints:
- every transaction must be **small and fast** (one slow transaction stalls everything);
- the **active dataset must fit in memory** (otherwise: abort the transaction, fetch data asynchronously, restart it — anti-caching);
- **write throughput must fit on one core**, or transactions must partition without cross-partition coordination;
- cross-partition transactions are possible but hard-limited.
:::

:::practice 27-serial-execution | Interactive vs stored procedure
Build a tiny single-threaded "stored procedure" executor and compare it with interactive transactions, serial and concurrent.
:::

:::quiz
### mcq
What does serializable isolation guarantee?
- [ ] Transactions literally run one at a time
- [x] The result is the same as if transactions had run one at a time, even if they actually ran in parallel
- [ ] Reads never block
- [ ] No transaction is ever aborted
>>>
p. 243. Implementations may run things in parallel, or literally serially.

### mcq
Why did single-threaded transaction execution become feasible around 2007?
- [ ] CPUs got 100× faster single-threaded performance
- [x] RAM became cheap enough to hold the active dataset in memory, and designers realised OLTP transactions are short while analytics can run on snapshots
- [ ] Networks became reliable
- [ ] SQL was replaced by stored procedures
>>>
With everything in memory, transactions don't wait for disk; and short OLTP transactions can run back to back while long analytic reads use snapshots outside the serial loop (p. 244).

### predict
A single-threaded database executes interactive transactions of 5 statements, each needing a 1 ms network round trip between application and database. Roughly what is the maximum throughput?
- [ ] 1,000,000 transactions/s
- [ ] 10,000 transactions/s
- [x] About 200 transactions/s — the thread is idle waiting for the network ~5 ms per transaction
- [ ] It depends only on CPU speed
>>>
That's why serial execution requires stored procedures (Figure 7-9). Your exercise showed the same effect.

### mcq
Why must VoltDB's stored procedures be deterministic?
- [ ] For security
- [x] Because VoltDB replicates by running the same procedure on every replica, which must produce identical results
- [ ] Because Java requires it
- [ ] Because of SQL syntax
>>>
p. 246 — the same issue as statement-based replication with NOW() and RAND() (Chapter 5).

### tradeoff
A partitioned serial-execution database runs 200,000 single-partition transactions per second. Your new feature needs transactions touching two partitions. What should you expect?
- [x] Those transactions will be orders of magnitude slower (VoltDB: ~1,000 cross-partition writes/s), and adding machines won't raise that limit
- [ ] Same throughput
- [ ] Half the throughput
- [ ] Higher throughput, because two threads are used
>>>
Cross-partition transactions must run in lock-step across all partitions they touch; VoltDB reported about 1,000 such writes per second, and the coordination cost doesn't shrink by adding machines (p. 247).

### explain
List the conditions under which actual serial execution is a good way to achieve serializability.
>>>
Every transaction is small and fast (one slow transaction stalls all others); the active dataset fits in memory (rarely accessed data can be on disk only if transactions don't need it, or with anti-caching); write throughput is low enough for one CPU core, or the data can be partitioned so that transactions stay within one partition; and cross-partition transactions are rare, because they're limited to low throughput. Transactions must be submitted as stored procedures rather than interactively (pp. 245–248).
:::

:::connect Where this goes next
Tomorrow: the algorithm that was *the* way to implement serializability for 30 years — two-phase locking — and why its performance made people settle for weak isolation.
:::
