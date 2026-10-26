---
title: Multi-Leader Topologies and Causality
kind: lesson
minutes: 70
chapter: 5
objectives:
- Describe circular, star and all-to-all replication topologies
- Explain how replication loops are prevented with node identifiers
- Explain the fault-tolerance weakness of circular and star topologies
- Explain how all-to-all topologies can deliver causally dependent writes out of order, and why timestamps don't fix it
reading:
- Multi-leader replication topologies | 168-171
complete:
- You made an update overtake its insert in the visualization, and broke a ring by killing a node
- You can explain why timestamps can't order the insert and the update
- You answered the quiz
---

:::problem More than two leaders
With two leaders there's one obvious path: each sends everything to the other. With three or more, there's a choice of **replication topology** — the communication paths writes travel along (Figure 5-8). The choice affects what happens when a node fails, and — surprisingly — whether writes arrive in an order that makes sense.
:::

:::intuition Rings, stars, and full meshes
- **Circular**: each node receives writes from one node and forwards them (plus its own) to the next. MySQL's default.
- **Star**: one designated root forwards writes to all others; generalises to a tree. (Not to be confused with the star *schema* of Chapter 3.)
- **All-to-all**: every leader sends its writes to every other leader. The most general.

In circular and star topologies, writes pass through several nodes, so nodes must **forward** changes. To prevent infinite loops, each node has a unique ID and each write in the log is **tagged with the IDs of every node it has passed through**; a node ignores a change tagged with its own ID.

Weakness: in circular and star topologies, **one failed node can interrupt the flow** between others until it's fixed (reconfiguring around it is usually manual). Densely connected topologies like all-to-all tolerate failures better because messages can take different paths.
:::

:::visual TopologySim | Paths, failures and overtaking
Leader L1 inserts a row; leader L3 updates it 20 ms after it sees the insert (Figure 5-9).

**Try this:**
1. **All-to-all**: raise the L1→L2 link delay above ~220 ms. L2 receives the update **before** the insert — an update to a row that doesn't exist yet.
2. **Circular**: kill L2. L3 and L4 stop receiving L1's writes.
3. **Star** (L1 is the hub): kill L4 — only L4 is affected; the hub itself would be a single point of failure.
:::

:::details Causality and why timestamps aren't enough (pp. 169–170)
All-to-all has its own problem: some links are faster than others (congestion), so some replication messages **overtake** others. In Figure 5-9, client A inserts a row on leader 1 and client B updates it on leader 3; leader 2 may get the update first — an update to a row that, from its point of view, doesn't exist — and the insert later.

This is a **causality** problem, like consistent prefix reads (p. 159): the update depends on the insert, so every node must process the insert first. **Attaching timestamps doesn't solve it**, because clocks can't be trusted to be sufficiently in sync to order these events correctly at leader 2 (Chapter 8). The right tool is **version vectors** (Friday).

The book's warning: conflict detection is poorly implemented in many multi-leader systems. In 2016, PostgreSQL BDR didn't provide causal ordering of writes, and Tungsten Replicator for MySQL didn't even try to detect conflicts. If you use multi-leader replication, read the documentation carefully and test thoroughly that it gives the guarantees you think it has.
:::

:::quiz
### mcq
How do circular and star topologies prevent a write from looping around forever?
- [ ] Each write has a time-to-live in seconds
- [x] Each write is tagged with the IDs of the nodes it has passed through; a node ignores writes already tagged with its own ID
- [ ] The root node deletes duplicates
- [ ] They use all-to-all links
>>>
Because writes are forwarded through intermediate nodes, a write could otherwise travel around the ring forever. The tag list lets each node recognise a change it has already processed (p. 169).

### mcq
What is the main weakness of a circular topology?
- [ ] It needs too many network links
- [x] A single failed node can interrupt replication between the other nodes until it's fixed or the topology is reconfigured (usually manually)
- [ ] It can't replicate deletes
- [ ] It requires synchronous replication
>>>
p. 169. All-to-all is more fault tolerant because messages can take different paths.

### predict
In an all-to-all topology, leader 1 inserts a row and leader 3 updates it shortly after. The link from leader 1 to leader 2 is congested. What can leader 2 observe?
- [ ] Nothing unusual
- [x] The update arriving before the insert — an update to a row it doesn't have yet
- [ ] Only the insert
- [ ] Two inserts
>>>
Figure 5-9: messages can overtake each other on faster paths.

### mcq
Why can't timestamps on each write solve the ordering problem of Figure 5-9?
- [ ] Timestamps are too large
- [ ] Databases don't support timestamps
- [x] Clocks on different nodes can't be trusted to be in sync closely enough to order causally dependent events correctly
- [ ] Timestamps only work in star topologies
>>>
The insert's node clock might be ahead of the updater's; ordering needs causality tracking (version vectors), not wall clocks (p. 170, Chapter 8).

### explain
You're evaluating a multi-leader replication product for three datacenters. Based on today's lesson, list three things you would test before trusting it.
>>>
Examples: (1) **Causal ordering** — does a dependent update ever get applied before the write it depends on when links have different delays? (2) **Conflict detection and resolution** — what happens on concurrent writes to the same record: are conflicts detected at all, how are they resolved, is data silently lost (e.g. LWW)? (3) **Topology fault tolerance** — if one node or link fails, do the others keep replicating, and is reconfiguration automatic? Also: interaction with auto-increment keys, triggers and constraints, and behaviour after a long partition heals.
:::

:::connect Where this goes next
Tomorrow we abandon leaders entirely: Dynamo-style leaderless replication, where any replica accepts writes and correctness comes from overlapping quorums.
:::
