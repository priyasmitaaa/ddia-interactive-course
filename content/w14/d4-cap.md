---
title: The Cost of Linearizability — CAP and Network Delays
kind: lesson
minutes: 85
chapter: 9
objectives:
- Explain, with Figure 9-7, why a network interruption forces a choice between linearizability and availability
- State the CAP trade-off precisely, and explain why "pick 2 of 3" is misleading
- Explain CAP's historical role and its narrow scope
- Explain why even multi-core RAM is not linearizable, and why the reason is performance, not fault tolerance
- State the Attiya–Welch result about response time and network delay uncertainty
reading:
- The cost of linearizability | 326-327
- The CAP theorem; the unhelpful CAP theorem | 327-328
- Linearizability and network delays | 328-329
complete:
- In the CAP simulator, you made DC 2 unavailable under single-leader and produced a conflict under multi-leader
- You can rephrase CAP as "either consistent or available when partitioned"
- You answered the quiz
---

:::problem When the datacenters can't talk
Multi-leader replication is often a good fit for multi-datacenter deployments (Chapter 5). Figure 9-7 has two datacenters, a database in each, and clients in each. Now the **network between the datacenters is interrupted**, while each datacenter's internal network still works and clients can still reach their local datacenter (p. 326). What happens to clients in the datacenter that doesn't hold the leader?
:::

:::intuition Linearizability or availability, during a network fault
**Multi-leader**: each datacenter keeps working normally. Writes are queued and exchanged when connectivity returns.

**Single-leader** (leader in datacenter 1): all writes and all linearizable reads must go to the leader, synchronously over the inter-datacenter link. When that link is cut, clients connected to datacenter 2 **can't write and can't do linearizable reads**. They can still read from the follower, but those reads are **stale** (non-linearizable). If the application needs linearizable reads and writes, the interruption makes it **unavailable** in datacenter 2. Clients that can reach datacenter 1 directly are fine. Those that can only reach datacenter 2 see an outage until the link is repaired (pp. 326–327).

This is not specific to single- vs multi-leader, nor to multiple datacenters. **Any linearizable database has this problem**, however it's implemented, on any unreliable network (p. 327):
- If your application **requires linearizability** and some replicas are disconnected, those replicas **can't process requests** while disconnected. They must wait or return an error, so they're unavailable.
- If it **doesn't require linearizability**, each replica can process requests independently even when disconnected (multi-leader style), so it **stays available**, but its behavior isn't linearizable.

Applications that don't need linearizability tolerate network problems better. That insight is the **CAP theorem**, named by Eric Brewer in 2000, although database designers had known the trade-off since the 1970s. (Footnote v: the two choices are sometimes called CP and AP, but that classification has several flaws and is best avoided.)
:::

:::visual CAPSim | Figure 9-7: a network interruption between datacenters
**Try this:**
1. **Single-leader.** Write from DC 2 with the link up. It works but goes via DC 1. Cut the link and try a write and a linearizable read from DC 2: refused. Try a local read: it works but may be stale. DC 1 clients carry on normally.
2. **Multi-leader.** Cut the link, write from DC 1 *and* from DC 2. Both succeed. Restore the link and see a conflict that needs resolving (Chapter 5).
3. Which would you choose for a shopping cart, and which for a username registry?
:::

:::details Why CAP is "unhelpful", and why linearizability is slow anyway (pp. 327–329)
**CAP's history.** It was originally a rule of thumb without precise definitions, meant to start a discussion about database trade-offs. At the time, many distributed databases provided linearizable semantics on clusters with shared storage. CAP encouraged engineers to explore shared-nothing designs better suited to large-scale web services, and it deserves credit for the culture shift behind the NoSQL explosion of the mid-2000s.

**As formally defined, CAP is very narrow.** It considers one consistency model (linearizability) and one kind of fault: **network partitions**, meaning nodes alive but disconnected. It says nothing about network delays, dead nodes or other trade-offs. So it has "little practical value for designing systems", has been superseded by more precise results, and is "of mostly historical interest today" (pp. 327–328). (Footnote vi: this is the one place the book can't avoid "partition" meaning a network fault, because it's the P in CAP.)

**The unhelpful CAP theorem** (box, p. 328). "Consistency, Availability, Partition tolerance: pick 2 out of 3" is **misleading**. Partitions are a kind of fault, not something you choose: they happen or they don't. When the network works, a system can be both linearizable and totally available. When a network fault occurs, you must choose one. A better phrasing is **"either Consistent or Available when Partitioned"**. There are also contradictory definitions of *availability*, and the formal one doesn't match its usual meaning. Many "highly available" systems don't meet CAP's idiosyncratic definition. All told, CAP is **best avoided**.

**Linearizability and network delays** (pp. 328–329). Surprisingly few systems are linearizable in practice. Even **RAM on a modern multi-core CPU** isn't: a thread on one core writes a memory address, and a thread on another core reading it shortly after isn't guaranteed to see the value, unless a **memory barrier or fence** is used. Each core has its own cache and store buffer, and caches are written back to main memory asynchronously, so there are several copies, updated asynchronously. CAP is irrelevant here: we don't expect a core to keep working when disconnected from the rest of the computer. **The reason for dropping linearizability is performance, not fault tolerance.**

The same is true of many distributed databases that choose not to be linearizable: they do it mainly for **performance**. **Linearizability is slow, all the time, not only during a network fault.** Is there a faster implementation? **Attiya and Welch** proved that if you want linearizability, the response time of reads and writes is **at least proportional to the uncertainty of delays in the network**. In networks with highly variable delays, like most computer networks, linearizable reads and writes are inevitably slow. Weaker consistency models can be much faster, which is an important trade-off for latency-sensitive systems (p. 329).
:::

:::quiz
### mcq
During an interruption between datacenters, what can clients connected only to the follower datacenter of a linearizable single-leader database do?
- [ ] Everything, at higher latency
- [x] Only non-linearizable (possibly stale) reads from the local follower; writes and linearizable reads are unavailable
- [ ] Writes but not reads
- [ ] Nothing at all, not even stale reads
>>>
They can't reach the leader, so anything that requires the leader fails (p. 326).

### mcq
What's the best short phrasing of CAP, according to the book?
- [ ] Pick any two of consistency, availability and partition tolerance
- [x] Either consistent (linearizable) or available when partitioned
- [ ] Consistency always beats availability
- [ ] Partition tolerance is optional
>>>
Network partitions aren't a choice. When one happens, you choose between linearizability and total availability (p. 328).

### mcq
Why does a multi-core CPU's memory system give up linearizability?
- [ ] To tolerate a core being disconnected (CAP)
- [x] For performance: per-core caches and store buffers make memory access much faster, at the cost of asynchronously updated copies
- [ ] Because RAM is unreliable
- [ ] It doesn't; RAM is always linearizable
>>>
Within one computer we assume reliable communication. The reason is performance, not fault tolerance (pp. 328–329).

### predict
A global database across three continents promises linearizable writes. By the Attiya–Welch result, what can you predict about its latency compared with an eventually consistent store?
- [ ] Same latency, as long as the network is healthy
- [x] Higher latency on every operation, roughly proportional to how uncertain the inter-continental network delays are
- [ ] Lower latency, because of fewer conflicts
- [ ] Latency only rises during network faults
>>>
Linearizability is slow all the time, not just during faults (p. 329).

### tradeoff
Why does the book call CAP "of mostly historical interest today"?
- [x] Its formal version covers only linearizability and network partitions, saying nothing about delays, dead nodes or other trade-offs, and more precise results have superseded it, though it helped spark the NoSQL design shift
- [ ] Because it was proved false
- [ ] Because networks no longer fail
- [ ] Because all databases are now linearizable
>>>
It was influential but has little practical value for designing systems (pp. 327–328).

### scenario
Your company runs a ticketing app in two regions with a single-leader database in region A. During a transatlantic link failure, users in region B can't buy tickets but can browse. A manager asks: "Why didn't we pick an AP system?" Give a balanced answer.
>>>
What happened is the CAP trade-off in action. Purchases need a linearizable uniqueness or stock constraint (no double-selling seats), so region B, cut off from the leader, has to refuse them, while browsing works off stale local reads (pp. 321, 326). An "available" multi-leader design would have let B keep selling, but concurrent sales in both regions could oversell the same seats, which then need conflict resolution and compensating actions (apologies, refunds) (pp. 321, 326). Whether that's better is a business decision: some sellers accept a rare oversell, while a seat-specific venue probably doesn't. Also, the CP/AP label is misleading. The system is fully consistent *and* available when the network is fine, and linearizability costs latency all the time, not only during failures (pp. 327–329). Options in between include routing B's purchases to A when possible, accepting reservations to be confirmed later, or partitioning inventory per region.
:::

:::connect Where this goes next
Tomorrow's lab: write a linearizability checker and use it to catch stale reads from a replicated store. Then next week: **ordering**, and the deep connection between ordering, linearizability and consensus.
:::
