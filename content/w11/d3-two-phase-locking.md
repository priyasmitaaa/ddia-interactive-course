---
title: Serializability II — Two-Phase Locking
kind: lesson
minutes: 90
chapter: 7
objectives:
- Explain 2PL's lock rules (shared and exclusive locks, held until commit) and how they differ from snapshot isolation
- Explain why 2PL causes deadlocks and how databases handle them
- Explain why 2PL performance and latency are poor under contention
- Explain predicate locks, and index-range (next-key) locks as their practical approximation
reading:
- Two-phase locking; implementation | 248-249
- Performance of two-phase locking | 249-250
- Predicate locks; index-range locks | 250-252
complete:
- You watched 2PL block, deadlock and abort in the simulator for lost update, write skew and the phantom
- You can explain why "2PL is not 2PC"
- You answered the quiz
---

:::problem Making the locks strong enough
Read committed and snapshot isolation use locks only to stop **writers** from interfering with each other. Write skew happened because one transaction **read** data that another then changed behind its back. For about 30 years, the one widely used algorithm for serializability was to make locks stronger: **two-phase locking (2PL)** — sometimes called strong strict 2PL (SS2PL). (2PL is **not** two-phase commit, 2PC, which is Chapter 9.)
:::

:::intuition Readers and writers block each other
Several transactions may **read** an object concurrently, but anyone **writing** needs exclusive access (p. 248):
- If A has **read** an object and B wants to **write** it, B waits until A commits or aborts (so B can't change it behind A's back).
- If A has **written** an object and B wants to **read** it, B waits (reading an old version, as in snapshot isolation, isn't allowed).

So in 2PL **writers block readers and readers block writers** — the opposite of snapshot isolation's mantra. In exchange, 2PL is serializable: it prevents lost updates, write skew, everything.

**Implementation** (p. 249) — used by serializable in MySQL/InnoDB and SQL Server, and repeatable read in DB2. Each object has a lock in **shared** or **exclusive** mode:
- To **read**, acquire the lock in shared mode (many holders allowed; wait if someone holds it exclusively).
- To **write**, acquire it in exclusive mode (no other holder at all).
- Read then write → **upgrade** shared to exclusive.
- **Hold every lock until the end of the transaction.** Phase 1: acquire locks while executing; phase 2: release all at commit/abort — hence "two-phase".

With so many locks, **deadlocks** are common: A waits for B and B waits for A. The database detects them and **aborts one**, which the application retries.
:::

:::visual TxnSim | 2PL in action
@props {"scenario":"writeSkew","level":"2pl"}
**Try this:**
1. **Write skew** under **2PL**: both transactions take *shared predicate locks* when counting doctors. Each one's write then needs an exclusive lock that conflicts with the other's predicate lock → **deadlock** → one is aborted; the other completes and the invariant holds.
2. **Lost update** under 2PL: both hold shared locks on the counter; both try to upgrade → deadlock.
3. **Read skew** under 2PL: the transfer's write must wait for Alice's shared lock, so Alice reads consistent balances.
4. **Phantom** under 2PL: the predicate lock blocks the other transaction's insert of a *row that didn't exist yet*.
:::

:::details Performance, predicate locks and index-range locks (pp. 249–252)
**Performance** is the big downside, and why 2PL isn't used everywhere: throughput and response times are significantly worse than under weak isolation — partly the overhead of locks, mostly **reduced concurrency**: anything that might race has to wait. Traditional databases don't limit transaction duration (designed for interactive use), so waits are unbounded; a queue can form behind one object. **Latencies are unstable and high at high percentiles** under contention — one slow transaction, or one that touches lots of data and takes many locks, can grind the system to a halt. Deadlocks happen far more often than under lock-based read committed, and an aborted, retried transaction redoes all its work.

**Predicate locks** (pp. 250–251). Serializable isolation must prevent **phantoms**: if one transaction searched for bookings of room 123 between noon and 1 pm, another mustn't concurrently insert one that matches. A **predicate lock** belongs not to an object but to all objects matching a condition, e.g. `room_id = 123 AND end_time > '12:00' AND start_time < '13:00'`:
- To read objects matching a condition, take a **shared predicate lock** on it; wait if another transaction holds an exclusive lock on any matching object.
- To insert, update or delete an object, check whether its **old or new value matches** any existing predicate lock; if another transaction holds one, wait.
The key: it applies to objects **that don't exist yet** (phantoms). 2PL + predicate locks = serializable.

**Index-range locks** (next-key locking). Predicate locks perform badly (checking many locks is slow), so most 2PL databases use a simplified approximation: lock a **bigger** set of objects than the predicate — safe, because anything matching the original also matches the approximation. With an index on `room_id`, lock the index entry for room 123 (any time); with a time index, lock a range of times (any room). A conflicting insert must update the same part of the index, hits the lock, and waits. Less precise but much cheaper — a good compromise. With no suitable index, fall back to a **shared lock on the whole table** (bad for performance, but safe). (This is where B-trees' "each key in one place" helps, Chapter 3.)
:::

:::quiz
### mcq
How does 2PL differ from snapshot isolation in who blocks whom?
- [x] In 2PL, readers block writers and writers block readers; in snapshot isolation, readers and writers never block each other
- [ ] They're the same
- [ ] In 2PL, nobody blocks anybody
- [ ] In snapshot isolation, readers block writers
>>>
p. 248. That's the root of both 2PL's correctness and its performance cost.

### mcq
Where does the name "two-phase" locking come from?
- [ ] Two lock modes, shared and exclusive
- [ ] Two databases involved
- [x] Locks are acquired during the transaction (first phase) and all released together at commit/abort (second phase)
- [ ] Each lock is requested twice
>>>
p. 249. And it's unrelated to two-phase commit.

### predict
Under 2PL, A and B both read the counter (shared locks) and then both try to write it. What happens?
- [ ] Both writes succeed
- [ ] The second write overwrites the first
- [x] Each waits for the other's shared lock to upgrade to exclusive — a deadlock; the database aborts one, the other proceeds
- [ ] Both are aborted
>>>
You watched exactly this in the simulator. The aborted transaction should be retried.

### mcq
What do predicate locks protect against that ordinary row locks can't?
- [ ] Dirty reads
- [x] Phantoms: writes that would create or change rows matching another transaction's search condition, including rows that don't exist yet
- [ ] Deadlocks
- [ ] Disk corruption
>>>
A row lock needs an existing row. A predicate lock covers a search condition, so an insert that would match it must wait even though the row didn't exist when the lock was taken (pp. 250–251).

### tradeoff
Why do databases use index-range locks instead of exact predicate locks?
- [x] Exact predicate locks are expensive to check; index-range locks lock a somewhat larger set (e.g. all bookings for the room) but are cheap, so more conflicts but far less overhead
- [ ] Index-range locks are more precise
- [ ] Predicate locks don't prevent phantoms
- [ ] Index-range locks don't need indexes
>>>
p. 251–252. Without a usable index, fall back to locking the whole table.

### explain
Explain why 2PL databases can have "quite unstable latencies" and be "very slow at high percentiles".
>>>
Under 2PL any transaction that might conflict must wait, and locks are held until commit. Transactions aren't time-limited, so a single slow transaction — or one that reads lots of data and takes many shared locks — makes everyone who touches that data wait; a queue can form behind a hot object; deadlocks abort transactions that then redo all their work. Most requests are fine, but the unlucky ones wait behind long chains of lock holders, so the tail (p99, p999) becomes very slow and unpredictable (p. 250) — Week 1's tail-latency story, caused by contention.
:::

:::connect Where this goes next
So far: serial execution doesn't scale, 2PL doesn't perform. Tomorrow: an optimistic algorithm from 2008 that offers full serializability with only a small penalty over snapshot isolation — SSI.
:::
