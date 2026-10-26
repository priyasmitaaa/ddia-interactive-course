---
title: Fault-Tolerant Consensus — Properties, Epochs and Quorums
kind: lesson
minutes: 100
chapter: 9
objectives:
- State the four properties of (uniform) consensus and classify them as safety or liveness
- Explain why termination requires a majority of nodes, and why 2PC doesn't satisfy it
- Explain why VSR, Paxos, Raft and Zab are total order broadcast algorithms
- Resolve the "to elect a leader we need a leader" paradox with epoch numbers and quorums
- Explain how the voting in consensus differs from 2PC
reading:
- Fault-tolerant consensus | 355-356
- Consensus algorithms and total order broadcast | 356-357
- Single-leader replication and consensus | 357-358
- Epoch numbering and quorums | 358-359
complete:
- In the consensus simulator, you saw a minority-side leader fail to commit while the majority elected a higher term, then healed the network
- You can explain why two majorities must overlap
- You answered the quiz
---

:::problem Agreement that survives failures
Formally, one or more nodes **propose** values, and the algorithm **decides** on one of them. In seat booking, each node handling a customer proposes that customer's ID, and the decision says who gets the last seat. A consensus algorithm must satisfy (p. 355):
- **Uniform agreement**: no two nodes decide differently.
- **Integrity**: no node decides twice.
- **Validity**: if a node decides v, then v was proposed by some node.
- **Termination**: every node that doesn't crash eventually decides some value.

Agreement and integrity are the core: everyone decides the same, and nobody changes their mind. Validity rules out trivial solutions like "always decide null". Without fault tolerance, the first three are easy: make one node a "**dictator**" that decides everything. But if it fails, nothing can be decided. That's exactly 2PC with a failed coordinator. (Footnote xiii: this variant is called *uniform* consensus.)
:::

:::intuition Termination, majorities, and epochs
**Termination formalizes fault tolerance** (p. 356). The algorithm can't sit around doing nothing forever. Even if some nodes fail, the others must decide. Termination is a **liveness** property, and the other three are **safety** properties (Chapter 8). The system model: a crashed node disappears and **never comes back**. Imagine its datacenter destroyed by a landslide, the node "buried under 30 feet of mud". Any algorithm that waits for a node to recover can't satisfy termination, and **2PC doesn't**.

There's a limit: **any consensus algorithm needs at least a majority of nodes functioning correctly** to ensure termination. So termination assumes fewer than half the nodes are crashed or unreachable. **Safety holds regardless.** Most implementations keep agreement, integrity and validity even if a majority fails or the network is badly broken. A large outage can stop the system from processing requests, but it can't make it decide wrongly. Most consensus algorithms assume **no Byzantine faults**. Byzantine-robust consensus is possible with fewer than one third of nodes faulty, but it's rarely used in practice.

**The algorithms** (pp. 356–357): **Viewstamped Replication (VSR)**, **Paxos**, **Raft** and **Zab**. They're similar but not the same. The book skips the details: "unless you're implementing a consensus system yourself (which is probably not advisable — it's hard)". Most don't decide a single value. They decide a **sequence of values**, which makes them **total order broadcast** algorithms. Total order broadcast is equivalent to repeated rounds of consensus, one decision per message delivered:
- **Agreement**: all nodes deliver the same messages in the same order.
- **Integrity**: messages aren't duplicated.
- **Validity**: messages aren't corrupted or made up.
- **Termination**: messages aren't lost.

VSR, Raft and Zab implement total order broadcast directly. For Paxos, the optimization is called **Multi-Paxos**.
:::

:::visual RaftSim | Terms, majorities and a partitioned leader
**Try this:**
1. **Run** until a leader is elected (green). Pause. Write v1 via the leader and step: it's committed (✓) once a majority stores it.
2. Choose **Partition: leader + 1 | 3**. Run. The 3-node side times out, elects a leader with a **higher term**, and keeps working.
3. Write via **both** leaders and step a few times. The old leader's entry never commits, because it can reach only 2 of 5. The new leader's does.
4. Heal the network (**Network healthy**) and step. The old leader sees the higher term, **steps down**, and its uncommitted entry is replaced. No committed write was lost.
5. Crash nodes (click them) until fewer than 3 are up. What happens to progress? To safety?
:::

:::details Breaking the leader paradox: epochs and quorums (pp. 357–359)
**Single-leader replication and consensus** (p. 357). Chapter 5's single-leader replication sends all writes to the leader and applies them in the same order on followers, which is essentially total order broadcast. Why didn't Chapter 5 need consensus? Because of **how the leader is chosen**. If humans configure the leader manually, you have a "consensus algorithm" of the **dictatorial** variety. It can work well in practice, but it doesn't satisfy termination, since progress after a leader failure needs human intervention. Automatic failover gets closer to fault-tolerant total order broadcast, but split brain means **we need consensus to elect a leader**. And consensus algorithms are total order broadcast algorithms, which are like single-leader replication, which needs a leader… "In order to solve consensus, we must first solve consensus" (p. 358).

**Epoch numbering and quorums.** The protocols use a leader internally but **don't guarantee it's unique**. They make a weaker guarantee: there's an **epoch number** (ballot number in Paxos, view number in VSR, term number in Raft), and **within each epoch, the leader is unique**.
- When the current leader is thought dead, a vote elects a new leader with an **incremented epoch number**. Epochs are totally ordered and monotonically increasing. If two leaders conflict (perhaps the old one wasn't dead after all), **the higher epoch prevails**.
- Before deciding anything, a leader must check that no leader with a higher epoch exists. It can't trust its own judgment (Chapter 8), so it relies on a **quorum**. For every decision, it sends the proposal to the other nodes and waits for **a majority** to respond in favor. A node votes for a proposal only if it knows of **no other leader with a higher epoch**.
- **Two rounds of voting**: one to choose a leader, and one on each of that leader's proposals. **The two quorums must overlap.** At least one node that votes on a proposal must also have voted in the most recent leader election. So if a proposal gets a majority, the leader knows no higher-epoch leader has been elected, and it can safely decide.

**Consensus vs 2PC** (p. 359). The voting looks superficially like 2PC. The biggest differences: **consensus needs votes from only a majority**, while 2PC needs a "yes" from **every** participant. And consensus algorithms define a **recovery process** by which nodes reach a consistent state after a new leader is elected, so safety always holds. These differences are key to their fault tolerance.
:::

:::quiz
### mcq
Which consensus property is a liveness property?
- [ ] Uniform agreement
- [ ] Integrity
- [ ] Validity
- [x] Termination
>>>
"Every node that does not crash eventually decides some value." The others are safety properties (p. 356).

### mcq
Why doesn't 2PC satisfy the termination property?
- [ ] Because it uses two phases
- [x] Because if the coordinator crashes, in-doubt participants must wait for it to recover, and in the consensus system model a crashed node never comes back
- [ ] Because it needs a majority
- [ ] Because it's Byzantine
>>>
2PC with a coordinator is like a dictator: no decisions without it (pp. 355–356).

### predict
A 5-node Raft cluster is partitioned 2 | 3, with the old leader on the 2-node side. A client writes to the old leader. What happens?
- [ ] The write commits, because the old leader is still leader
- [x] The write can't commit, since the old leader can't get a majority; the 3-node side elects a leader with a higher term, and when the network heals the old leader steps down and the uncommitted entry is discarded
- [ ] Both sides commit and then merge
- [ ] The cluster loses data
>>>
Within each epoch, decisions need a majority, and the higher epoch prevails (pp. 358–359).

### mcq
How do consensus algorithms break the "to elect a leader we need a leader" circularity?
- [ ] By having humans choose leaders
- [x] They don't guarantee a unique leader overall, only a unique leader per epoch; higher epochs prevail, and every decision needs a majority quorum that overlaps with the election quorum
- [ ] By using synchronized clocks
- [ ] By running 2PC first
>>>
Epoch numbers plus overlapping quorums (p. 358).

### tradeoff
What do consensus algorithms gain by needing only a majority instead of every participant, as in 2PC?
- [x] They keep making progress while a minority of nodes is crashed or unreachable, instead of blocking on any single failure, and they still keep safety
- [ ] They avoid disk writes
- [ ] They never need a leader
- [ ] They tolerate Byzantine faults
>>>
Majority voting plus a recovery process is the key to their fault tolerance (p. 359).

### explain
Explain why the quorum for electing a leader and the quorum for each of its proposals must overlap, and what goes wrong if they don't.
>>>
A leader for epoch e needs votes from a majority, and each proposal it makes needs acceptance from a majority. Any two majorities of the same node set share at least one node. If a newer leader with epoch e+1 has been elected, at least one node that the old leader asks about its proposal took part in that newer election. That node knows about epoch e+1 and refuses the old leader's proposal, so the old leader can't get a majority and learns it has been superseded (p. 358). If the quorums didn't have to overlap, say with "half" counted as a majority on 4 nodes, two disjoint groups could each elect a leader and each accept proposals, and the system would decide two conflicting things: split brain. Lab 35 demonstrates exactly this bug.
:::

:::connect Where this goes next
Tomorrow: what consensus costs (synchronous replication, fixed membership, sensitivity to timeouts), and how ZooKeeper and etcd package it as a service: locks, fencing, failure detection, notifications, work allocation and service discovery.
:::
