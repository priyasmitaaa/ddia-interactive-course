---
title: Part II Exam — Distributed Data (Chapters 5–9)
kind: assessment
minutes: 110
chapter: 9
objectives:
- Demonstrate integrated understanding of replication, partitioning, transactions, faults and consensus
- Diagnose unfamiliar failure scenarios using Part II concepts
- Design with explicit trade-offs and cite the relevant chapters
reading:
- Skim the summaries of Chapters 5–9 after the exam, not before | 363-365
complete:
- You answered every question without notes, in about 90 minutes
- You compared your answers with the model answers and noted weak topics
- You scheduled a re-read for any topic you missed
---

:::note How to take this exam
Closed book, about 90 minutes, answers on paper or in a text file first. Then reveal each model answer and grade yourself honestly. Every answer you get wrong goes into your review queue automatically, so the spaced-repetition system will bring it back. This exam is cumulative over Chapters 5–9. Questions are ordered roughly by chapter, and the last two integrate everything.
:::

:::quiz Part II exam
### mcq
A follower in a single-leader setup applies its replication log in order but lags by 30 seconds. Which guarantee does it still provide to readers?
- [ ] Linearizability
- [ ] Read-your-writes for all clients
- [x] A causally consistent (consistent prefix) view of the leader's history, just delayed
- [ ] No ordering at all
>>>
A single leader's log is a total order consistent with causality. Lag delays the view but doesn't reorder it (Chapter 5, pp. 334–335).

### scenario
A leaderless store uses n = 3, w = 2, r = 2, sloppy quorums and LWW. A product manager says "quorums mean we're strongly consistent". List three distinct reasons this is false, from three different chapters.
>>>
(1) Chapter 5: sloppy quorums let writes go to stand-in nodes outside the home replicas, so a later read quorum may not overlap the write at all, and staleness is possible. (2) Chapter 8: LWW with time-of-day timestamps silently drops writes when clocks are skewed (Figure 8-3), and concurrent writes are discarded. (3) Chapter 9: even strict quorums aren't linearizable under variable network delays (Figure 9-6), unless reads repair synchronously and writes read a quorum first, and even then compare-and-set needs consensus (p. 325).

### mcq
You hash-partition users by user_id. Which query is now expensive?
- [ ] Get user by user_id
- [x] Find all users in a given city, unless there's a secondary index, and then it's either scatter/gather (document-partitioned) or a multi-partition write (term-partitioned)
- [ ] Update one user's email
- [ ] Delete a user by id
>>>
Hash partitioning destroys key ordering and helps only key lookups. Secondary indexes come with trade-offs (Chapter 6).

### mcq
Two doctors both go off call under snapshot isolation, leaving none on call. Which is the weakest isolation level that prevents this automatically?
- [ ] Read committed
- [ ] Snapshot isolation with lost-update detection
- [x] Serializable (2PL, SSI or serial execution)
- [ ] Read uncommitted
>>>
It's write skew, which only serializability prevents automatically (Chapter 7, p. 239).

### scenario
A service acquires a ZooKeeper lock, then writes to S3. After a 40 s GC pause, two writers occasionally overwrite each other's objects. Explain and fix.
>>>
The lock is a lease tied to a ZooKeeper session. During the pause, the session times out, the lock is released, and another client acquires it. The paused client resumes believing it still holds the lock and writes too: Figure 8-4 (pp. 287–289, 293). Fix: use a fencing token, ZooKeeper's zxid or cversion from the lock acquisition (p. 295), and make the resource reject stale tokens. S3 can't check custom tokens directly, so include the token in the object key (write `object.v<token>` and point readers at the highest), or use a conditional-write mechanism keyed on a version, so a stale writer can't overwrite newer data (p. 295). Re-checking the lock before writing narrows the window but doesn't close it.

### mcq
Which statement about clocks is TRUE?
- [ ] Monotonic clock values can be compared across machines
- [ ] NTP guarantees ordering of events across nodes
- [x] A clock reading is better thought of as a confidence interval, and most APIs don't expose its width
- [ ] Time-of-day clocks never go backwards
>>>
Chapter 8, p. 285. Spanner's TrueTime is the exception that exposes it.

### tradeoff
For a global user-registration service, compare (a) a single-leader database in one region, and (b) a consensus-replicated registry with replicas in three regions.
- [x] (a) is simple and linearizable, but every remote registration pays a cross-region round trip and failover needs consensus or humans; (b) survives a region outage automatically but every write needs a cross-region majority (high latency), and the minority side of a partition can't register
- [ ] (a) is always better
- [ ] (b) has no latency cost
- [ ] Both are eventually consistent
>>>
Chapters 5 and 9: linearizability costs latency always and availability during partitions (pp. 326–329). Consensus solves failover (p. 365).

### mcq
Which is a property of total order broadcast that Lamport timestamps lack?
- [ ] Uniqueness of numbers
- [ ] Consistency with causality
- [x] The order is final at delivery; no message can later be inserted before an already-delivered one
- [ ] Compactness
>>>
That's what makes uniqueness constraints implementable (pp. 338, 340).

### scenario
During a 2PC transaction across two databases, the coordinator process's disk is destroyed after it logged "commit" and told DB 1. DB 2 is prepared. What is the state, what can be done, and what lesson does Chapter 9 draw?
>>>
DB 1 has committed. DB 2 is in doubt, holding its locks indefinitely, and nobody can automatically learn the decision because the coordinator's log is gone. This is an orphaned in-doubt transaction (p. 353). Rebooting DB 2 doesn't help, since correct 2PC keeps in-doubt locks across reboots. An administrator must inspect the participants, see that DB 1 committed, and commit DB 2 manually (or apply a heuristic decision, carefully). The lesson: the coordinator is itself a database and must be replicated and treated with the same care. An unreplicated coordinator is a single point of failure, and XA in app servers makes them stateful (p. 354).

### explain
Explain the chain: "unique usernames need consensus". Go from uniqueness, to why Lamport timestamps fail, to total order broadcast, to linearizable cas, to consensus.
>>>
To accept a registration immediately, a node must be sure no concurrent registration of the same name will be ordered ahead of it. Lamport timestamps give a causally consistent total order, but only after you've collected everyone's operations. At decision time another node may assign a lower timestamp, so you'd have to ask all nodes, which blocks on any failure (pp. 337–338). Total order broadcast fixes the order at delivery: append your claim, wait for it to come back, and you win if it's the first claim for the name. Every node computes the same answer. That gives a linearizable compare-and-set, with reads sequenced through the log (pp. 340–341). Total order broadcast, and cas or increment-and-get registers, are proven equivalent to consensus (p. 342). So a fault-tolerant uniqueness constraint is a consensus problem, best solved by a proven algorithm (Raft, Zab, Paxos) or a service built on one.

### design
Design the data layer for a ride-hailing app's "trip" object (created when a rider requests, updated by driver assignment, location pings and completion), across 3 regions. Address: replication, partitioning, the "only one driver per trip" rule, location pings, and fare calculation at completion. Cite Part II concepts.
>>>
Partition trips by trip ID, with hash partitioning for even load (Chapter 6), and keep each trip's home in the rider's region. Replicate each partition single-leader with synchronous or semi-synchronous replication to one follower in-region (durability, Chapter 5), plus asynchronous followers in the other regions for reads. **Only one driver per trip** is a uniqueness constraint: assign with a linearizable conditional update on the trip's leader (`UPDATE trips SET driver = ? WHERE id = ? AND driver IS NULL`). The partition leader is elected via consensus with epochs, so a GC-paused ex-leader can't double-assign, and its writes are fenced (Chapters 8, 9). **Location pings** are high volume and tolerate staleness and loss: write them to a separate store or stream partitioned by driver, with eventual consistency and LWW per driver (only the latest position matters, and losing one ping is harmless), and keep them out of the trip's transactional path. **Fare calculation** reads the trip's events (request, assignment, start, end) and must see a consistent set. Run it as a single-partition serializable transaction on the trip's leader (Chapter 7), with an idempotency key so a retried completion doesn't double-charge. Payments in another service get an event from the trip service rather than XA (avoid heterogeneous 2PC, p. 354). Failure analysis: during a region split, riders in the trip's home region proceed. Others can view stale trip state but can't change assignment, a deliberate choice of linearizability over availability for the assignment rule (p. 327).
:::

:::connect After the exam
Grade yourself against the model answers and be strict: a partially right answer counts as wrong for review purposes. Tomorrow's review brings your misses back. Then Part III begins with Chapter 10, where data systems stop being one database and become a pipeline of derived data, starting with batch processing and the Unix philosophy.
:::
