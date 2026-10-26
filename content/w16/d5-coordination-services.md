---
title: Limits of Consensus, and Coordination Services like ZooKeeper
kind: lesson
minutes: 90
chapter: 9
objectives:
- List the costs and limitations of consensus algorithms
- Explain what ZooKeeper and etcd are for, and the four ZooKeeper features that matter
- Explain how coordination services are used for leader election, work allocation and service discovery
- Explain membership services, and why agreement on membership is useful even if sometimes wrong
- Summarize Chapter 9, including the list of problems equivalent to consensus and the three ways to handle a failed leader
reading:
- Limitations of consensus | 359-360
- Membership and coordination services | 360-361
- Allocating work to nodes | 361-362
- Service discovery; membership services | 362-363
- Summary | 363-365
complete:
- You can list ZooKeeper's four features and say which one really needs consensus
- You can list the six problems the summary calls equivalent to consensus
- You answered the quiz
---

:::problem Consensus is a breakthrough. Why isn't it everywhere?
Consensus algorithms are "a huge breakthrough for distributed systems". They bring concrete safety properties (agreement, integrity, validity) to systems where everything else is uncertain, and they stay fault tolerant as long as a majority is up. They provide total order broadcast, and so linearizable atomic operations. Nevertheless, **the benefits come at a cost** (p. 359).
:::

:::intuition The costs, and a service that packages consensus
**Limitations of consensus** (pp. 359–360):
- **Voting is synchronous replication.** Databases are often configured for asynchronous replication, accepting that some committed data may be lost on failover in exchange for performance.
- **A strict majority is always required.** That means 3 nodes to tolerate 1 failure and 5 to tolerate 2. If a network fault cuts some nodes off, **only the majority side makes progress**, and the rest is blocked.
- **Fixed membership.** Most algorithms assume a fixed set of voting nodes. Dynamic-membership extensions exist but are much less well understood.
- **Timeouts.** Failure detection relies on timeouts. With highly variable delays, especially geo-distributed, nodes often **falsely believe the leader failed**. That doesn't harm safety, but frequent elections can mean the system spends more time choosing a leader than doing useful work.
- **Sensitivity to network problems.** **Raft** has unpleasant edge cases. If the network works except for one consistently unreliable link, leadership can bounce between two nodes, or the leader is continually forced to resign, so the system never makes progress. More robust algorithms were still an open research problem.

**ZooKeeper and etcd** (pp. 360–361) are described as distributed key-value stores or coordination and configuration services. You read and write keys and iterate over them. You rarely use ZooKeeper directly, because it isn't a good general-purpose database. You rely on it through **HBase, Hadoop YARN, OpenStack Nova, Kafka**. It holds **small amounts of data that fit in memory** (still written to disk for durability), replicated with fault-tolerant total order broadcast. Modeled on **Google's Chubby** lock service, ZooKeeper offers:
- **Linearizable atomic operations.** A compare-and-set gives you a lock. A distributed lock is usually a **lease** with an expiry, so it's released if the client fails.
- **Total ordering of operations.** **Fencing tokens** come from the monotonically increasing **zxid** and **cversion**.
- **Failure detection.** Clients keep a long-lived **session** with heartbeats. If heartbeats stop for longer than the session timeout, the session is declared dead, and its locks can be deleted automatically. These are **ephemeral nodes**.
- **Change notifications.** Clients can **watch** keys, for example to see another client join or fail when its session times out and its ephemeral nodes disappear, without polling.

**Only the linearizable atomic operations really require consensus**, but the combination is what makes it so useful for coordination.
:::

:::visual RaftSim | The engine inside a coordination service
ZooKeeper's Zab and etcd's Raft run the same epoch-and-quorum logic you saw yesterday. **Try this:** run the simulation, then crash **two** nodes. The cluster still has 3 of 5 and keeps electing and committing. Crash a third. Writes stop, but nothing committed is lost or contradicted. That's the bargain on p. 356: an outage stops progress, but it can't corrupt decisions. Now think about why ZooKeeper runs on just 3 or 5 nodes and not on all 1,000 of your application servers.
:::

:::details Using coordination services, and the Chapter 9 summary (pp. 361–365)
**Allocating work to nodes** (pp. 361–362):
- **Choosing a leader or primary** among several instances of a service, for single-leader databases but also job schedulers and similar stateful systems.
- **Assigning partitions** of a partitioned resource (database, message streams, file storage, actor system) to nodes, and **rebalancing** as nodes join, leave or fail (Chapter 6).

These are done with atomic operations, ephemeral nodes and notifications. Done right, the application recovers from faults without human intervention. It's still not easy, and libraries like **Apache Curator** help, but it's far better than implementing consensus from scratch, which "has a poor success record". ZooKeeper runs on a **fixed small number of nodes (usually 3 or 5)** and supports many clients, which **"outsources"** coordination: consensus, operation ordering and failure detection. Its data is **slow-changing**, like "node 10.1.1.23 is the leader for partition 7", changing over minutes or hours. It isn't for runtime application state that changes thousands or millions of times per second. For that, use tools like **Apache BookKeeper**.

**Service discovery** (pp. 362–363). ZooKeeper, etcd and **Consul** are often used to find a service's IP address. Services register their endpoints on startup, which is useful in clouds where VMs come and go. **Does service discovery need consensus? Less clear.** **DNS** uses layers of caching for performance and availability, its reads are **absolutely not linearizable**, and slightly stale results are usually fine. Availability and robustness matter more. But **leader election does need consensus**, so if your consensus system knows the leader, it can help others discover it. Some systems support **read-only caching replicas** that receive the log of decisions asynchronously without voting, serving reads that don't need to be linearizable.

**Membership services** (p. 363). ZooKeeper belongs to a long line of research on membership services going back to the 1980s, used for highly reliable systems like **air traffic control**. A membership service determines **which nodes are currently active members**. Failures can't be detected reliably, but **coupling failure detection with consensus** lets nodes **agree** on who is alive. A node may still be wrongly declared dead, but agreement itself is very useful. For example, "choose the lowest-numbered current member as leader" only works if everyone has the same member list.

**Summary** (pp. 363–365):
- **Linearizability** makes replicated data look like a single copy with atomic operations. It's easy to understand, like a variable in a single-threaded program, but slow, especially with large network delays.
- **Causality** gives a weaker model with branching and merging histories, without linearizability's coordination overhead and much less sensitive to network problems.
- Even with causal order (Lamport timestamps), some things, like rejecting concurrent registrations of the same username, need **consensus**.
- **Equivalent to consensus**: linearizable compare-and-set registers, atomic transaction commit, total order broadcast, locks and leases, membership/coordination services, and uniqueness constraints.
- All are easy on a single node, or with a single leader that holds all decision power. If that leader fails, there are **three options**: (1) **wait** for it to recover, as many XA/JTA coordinators do, which doesn't satisfy termination; (2) **manual failover** by humans ("consensus by act of God"), limited by human speed; (3) an **algorithm that automatically chooses a new leader**, which requires a consensus algorithm. Automatic failover without a proven algorithm is likely to behave badly in adverse networks.
- A single leader still needs consensus to maintain and change leadership. Having a leader "kicks the can down the road". Tools like ZooKeeper provide outsourced consensus, failure detection and membership. **If you need something reducible to consensus, and you want it fault tolerant, use something like ZooKeeper.**
- **Not every system needs consensus.** Leaderless and multi-leader systems usually don't use global consensus. Their conflicts are the consequence, and maybe that's fine: we can learn to work with branching and merging version histories.
:::

:::extra Beyond the 2016 text
**Not from the book.** Since 2016, Kafka has replaced its ZooKeeper dependency with its own Raft-based controller quorum (**KRaft**). etcd underpins Kubernetes' control plane. Consensus-based distributed SQL databases (for example CockroachDB, YugabyteDB, TiDB, Spanner) run Raft or Paxos groups per data range, which makes consensus a per-partition building block rather than only an external coordination service. The trade-offs the chapter describes (majorities, latency, timeout sensitivity) apply unchanged.
:::

:::quiz
### mcq
Which ZooKeeper feature genuinely requires consensus?
- [ ] Change notifications (watches)
- [ ] Failure detection via sessions
- [x] Linearizable atomic operations such as compare-and-set
- [ ] Storing data in memory
>>>
The rest are useful additions, but the combination is what makes coordination easy (p. 361).

### mcq
How many nodes does a consensus system need to tolerate two simultaneous failures?
- [ ] 3
- [ ] 4
- [x] 5
- [ ] 6
>>>
A strict majority must remain: 3 of 5 (p. 359).

### predict
A 5-node etcd cluster spans three regions with highly variable latency, and the election timeout is aggressive. What's the likely symptom?
- [ ] Lost committed writes
- [ ] Two leaders accepting writes in the same term
- [x] Frequent unnecessary leader elections, hurting performance and availability, while safety is unaffected
- [ ] Byzantine faults
>>>
False suspicions of leader failure trigger elections, and the system can spend more time electing than working (p. 359).

### mcq
Does service discovery require consensus, according to the book?
- [ ] Yes, always
- [x] Not necessarily: DNS-style, cached, non-linearizable lookups usually suffice; but leader election does need consensus, so a consensus system can usefully publish who the leader is
- [ ] No, and leader election doesn't either
- [ ] Only in the cloud
>>>
Availability and robustness matter more for discovery (p. 362).

### tradeoff
Why does ZooKeeper typically run on 3 or 5 nodes instead of on every application server?
- [x] Majority votes over thousands of nodes would be terribly inefficient; a small fixed ensemble does the voting while serving many clients, outsourcing coordination
- [ ] Because ZooKeeper has a license limit
- [ ] Because more nodes would reduce safety
- [ ] Because application servers can't run Java
>>>
That's "outsourcing" consensus, ordering and failure detection to a small dedicated service (p. 362).

### explain
The summary gives three ways to handle a failed leader. Name them and say which one actually solves consensus.
>>>
(1) Wait for the leader to recover and accept that the system is blocked meanwhile. Many XA/JTA transaction coordinators do this. It doesn't satisfy termination, because if the leader never recovers the system is blocked forever. (2) Manual failover: humans pick a new leader and reconfigure the system, as many relational databases do. It's "consensus by act of God", made outside the computer system and limited by human speed. (3) An algorithm automatically chooses a new leader. Only this requires, and actually is, a consensus algorithm, and doing it without a proven algorithm is likely to behave badly in adverse network conditions (pp. 364–365).
:::

:::connect Where this goes next
Tomorrow: the Chapter 9 checkpoint. Next week consolidates all of Part II, with two labs (2PC with recovery, and leader election with fuzzing), a design case study, and the Part II exam.
:::
