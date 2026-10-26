---
title: Implementing Linearizable Systems — Replication and Quorums
kind: lesson
minutes: 85
chapter: 9
objectives:
- Explain why the simplest linearizable system, a single copy, isn't fault tolerant
- Classify single-leader, consensus, multi-leader and leaderless replication by whether they can be linearizable, and why
- Explain how a delusional leader or asynchronous failover breaks linearizability in single-leader systems
- Walk through Figure 9-6 and explain why strict quorums with variable delays aren't linearizable
- Describe how Dynamo-style quorums can be made linearizable for reads and writes, and why compare-and-set still needs consensus
reading:
- Implementing linearizable systems | 323-324
- Linearizability and quorums | 324-325
complete:
- You reproduced Figure 9-6 in the quorum simulator and fixed it with synchronous read repair
- You can fill in the replication-method table from memory
- You answered the quiz
---

:::problem Linearizable and fault tolerant
Linearizability means "behave as though there were a single copy of the data, with atomic operations". The simplest implementation is to *actually* keep a single copy. But then the data is lost, or at least inaccessible, if that node fails (p. 323). To tolerate faults we replicate. Can each of Chapter 5's replication methods be made linearizable?
:::

:::intuition The four replication methods, graded
**Single-leader replication: potentially linearizable** (p. 323). The leader has the primary copy. Reads from the leader, or from *synchronously* updated followers, can be linearizable. Not every single-leader database is, though, either by design (for example because it uses snapshot isolation) or because of concurrency bugs. Reading from the leader also assumes you **know for sure who the leader is**. A node may think it's leader when it isn't (Chapter 8), and if that **delusional leader** keeps serving requests, it will likely violate linearizability. **Asynchronous failover** may even lose committed writes, which violates both durability and linearizability. (Footnote iv: partitioning a single-leader database, with one leader per partition, doesn't affect this, since linearizability is a single-object guarantee. Cross-partition transactions are a different matter.)

**Consensus algorithms: linearizable** (p. 324). They resemble single-leader replication but include measures against split brain and stale replicas, so they can implement linearizable storage safely. ZooKeeper and etcd work this way.

**Multi-leader replication: not linearizable.** Writes are processed concurrently on several nodes and replicated asynchronously, which produces conflicts that need resolving.

**Leaderless replication: probably not linearizable.** People sometimes claim quorum reads and writes (w + r > n) give "strong consistency". That's not quite true, depending on the configuration and on how you define strong consistency:
- **LWW based on time-of-day clocks** (for example Cassandra) is almost certainly non-linearizable, because timestamps can't be guaranteed consistent with the actual order of events under clock skew.
- **Sloppy quorums** ruin any chance of linearizability.
- Even **strict quorums** can be non-linearizable, as Figure 9-6 shows.
:::

:::visual QuorumRaceSim | Figure 9-6: a strict quorum that isn't linearizable
**Try this:**
1. The defaults reproduce Figure 9-6. n = 3, w = 3 (the write goes to all replicas), r = 2. Reader A asks replicas 1 and 2 and sees x = 1 on replica 1. Reader B starts *after A finished*, asks replicas 2 and 3, and gets 0 from both.
2. The quorum condition holds (3 + 2 > 3), but the history isn't linearizable. It's the Alice and Bob situation again.
3. Turn on **synchronous read repair**. A writes x = 1 back to replica 2 before returning. B's quorum must overlap A's, so it now sees 1.
4. Move B's start earlier, so it overlaps A. Is a 0 allowed then?
:::

:::details Making quorums linearizable, and the limits (p. 325)
In Figure 9-6, x is initially 0 and the writer sends x = 1 to all three replicas. Variable network delays mean replica 1 gets it early and replicas 2 and 3 get it late. Concurrently, A reads a quorum of two and sees the new value on one node. B, starting after A completes, reads a different quorum of two and sees only old values. The quorum condition is met, yet **B's request began after A's completed and returned an older value**: not linearizable.

Dynamo-style quorums *can* be made linearizable, at the cost of performance:
- A **reader must perform read repair synchronously** before returning results to the application.
- A **writer must read the latest state of a quorum** of nodes before sending its writes.

**Riak** doesn't do this, because of the performance penalty. **Cassandra** does wait for read repair to complete on quorum reads, but it loses linearizability when there are multiple concurrent writes to the same key, because it uses last-write-wins.

Even then, only linearizable **read and write** operations can be implemented this way. A linearizable **compare-and-set** cannot. It requires a **consensus algorithm**. Conclusion: "it is safest to assume that a leaderless system with Dynamo-style replication does not provide linearizability" (p. 325).
:::

:::quiz
### mcq
Which replication method does the book say can implement linearizable storage safely?
- [ ] Multi-leader replication
- [ ] Leaderless replication with sloppy quorums
- [x] Consensus algorithms, as used by ZooKeeper and etcd
- [ ] Any method with w + r > n
>>>
Consensus protocols include measures against split brain and stale replicas (p. 324).

### mcq
How can a single-leader database that reads only from the leader still violate linearizability?
- [ ] It can't
- [x] A node that wrongly believes it's still the leader may keep serving requests, and asynchronous failover can lose committed writes
- [ ] Followers may be ahead of the leader
- [ ] Reads from the leader are always stale
>>>
Both are Chapter 8 problems: the delusional leader, and lost data on failover (p. 323).

### predict
In Figure 9-6 with n = 3, w = 3, r = 2, reader B starts after reader A has finished. A saw 1. Without synchronous read repair, what can B see?
- [ ] Only 1
- [x] 0, if its quorum consists of replicas the write hasn't reached yet, which isn't linearizable
- [ ] An error
- [ ] B blocks until the write completes
>>>
The overlapping replica (replica 2) hasn't received the write yet, because of variable network delay (p. 325).

### mcq
Why is Cassandra's quorum read not linearizable, even though it waits for read repair?
- [ ] Because it never does read repair
- [ ] Because it uses sloppy quorums for all reads
- [x] Because it uses last-write-wins, which loses linearizability with multiple concurrent writes to the same key
- [ ] Because it has a single leader
>>>
LWW resolves concurrent writes by timestamp, and timestamps can contradict the real order (pp. 324–325).

### tradeoff
You add synchronous read repair and "read a quorum before writing" to your Dynamo-style store. What do you gain, and what's still missing?
- [x] Linearizable reads and writes, at the cost of latency; a linearizable compare-and-set still isn't possible without consensus
- [ ] Full linearizability for all operations, at no cost
- [ ] Nothing, since quorums can never be linearizable
- [ ] Compare-and-set, but not reads
>>>
The book is explicit that cas requires a consensus algorithm (p. 325).

### explain
Fill in the table from memory and justify each cell in one phrase: single-leader / consensus / multi-leader / leaderless, each marked linearizable, potentially, or not.
>>>
Single-leader is **potentially** linearizable: reads from the leader or synchronous followers can be, but delusional leaders, asynchronous failover, snapshot isolation or bugs can break it. Consensus algorithms **are** linearizable: they're like single-leader replication plus protections against split brain and stale replicas (ZooKeeper, etcd). Multi-leader is **not**: concurrent writes on several nodes are replicated asynchronously and conflict. Leaderless is **probably not**: LWW with clock skew, sloppy quorums, and even strict quorums with variable delays (Figure 9-6) break it, and only synchronous read repair plus read-before-write gives linearizable reads and writes, never compare-and-set (pp. 323–325).
:::

:::connect Where this goes next
Tomorrow: what linearizability **costs**. A network interruption forces a choice between linearizability and availability (the famous and often misunderstood CAP theorem), and linearizability is slow even when the network works.
:::
