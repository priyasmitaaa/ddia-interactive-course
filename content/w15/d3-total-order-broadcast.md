---
title: Timestamp Ordering Is Not Sufficient — Total Order Broadcast
kind: lesson
minutes: 90
chapter: 9
objectives:
- Explain why Lamport timestamps can't enforce a uniqueness constraint at the moment a request arrives
- Define total order broadcast by its two properties, and explain its scope with partitioned databases
- Explain how total order broadcast gives state machine replication, serializable transactions and fencing tokens
- Explain why total order broadcast is stronger than timestamp ordering (the order is fixed at delivery)
reading:
- Timestamp ordering is not sufficient | 337-338
- Total order broadcast | 338-339
- Using total order broadcast | 339-340
complete:
- In the TOB simulator, you saw both users "win" with timestamps and exactly one win with the log
- You can state the two properties of total order broadcast
- You answered the quiz
---

:::problem Who grabbed "ada" first?
Two users concurrently try to create an account with the username **ada**. One should succeed and the other fail. At first glance a total order such as Lamport timestamps solves this: pick the claim with the **lower timestamp** as the winner (p. 337).

That works for determining the winner **after the fact**, once you've collected every username-creation operation in the system. It doesn't work when a node has just received a request and must decide **right now**. At that moment it doesn't know whether another node is concurrently creating the same username, or what timestamp that node will assign. To be sure, it would have to **check with every other node**, and if any of them has failed or can't be reached, the system grinds to a halt. That isn't fault tolerant (p. 338).
:::

:::intuition Knowing when the order is final
The problem is that **the total order only emerges after you've collected all the operations**. Operations you haven't heard about yet may need to be inserted anywhere in the order. To implement a uniqueness constraint, it isn't enough to have a total order. **You also need to know when that order is finalized.** If you're sure no other node can insert a claim for the same name *ahead* of yours, you can safely declare success (p. 338).

That idea is **total order broadcast**, also called atomic broadcast (pp. 338–339). On a single CPU core the total order is simply the order of execution. Single-leader replication does the same by sequencing everything on the leader's single core. The open questions are how to scale beyond one leader's throughput and how to handle failover.

Total order broadcast is described as a protocol for exchanging messages, with two properties that must always hold:
- **Reliable delivery**: no messages are lost. If a message is delivered to one node, it's delivered to all nodes.
- **Totally ordered delivery**: messages are delivered to every node **in the same order**.

They must hold even when nodes or the network are faulty. Messages can't be delivered while the network is down, but the algorithm keeps retrying, and when the network is repaired they're delivered in the correct order.

(Box, p. 339: partitioned databases with one leader per partition often maintain ordering **only per partition**, so they can't offer consistent snapshots or foreign-key guarantees across partitions. Total ordering across all partitions is possible, but needs extra coordination. Footnote ix: "atomic broadcast" is a confusing name, unrelated to ACID atomicity. "Total order multicast" is a synonym.)
:::

:::visual TOBSim | Claiming a username: timestamps vs a log
**Try this:**
1. **Lamport timestamps.** X claims via node 1 and Y via node 3, almost simultaneously. If each node decides immediately, *both* are told "yours". X's lower timestamp only wins after the fact.
2. Tick **ask every node before deciding**. Now it's correct, until you untick **node 2 reachable**: everything blocks.
3. **Total order broadcast.** Each claim is appended to the log, and a node decides only once its own claim has been delivered back to it: the first claim in the log wins. Exactly one user wins, even with node 2 down. Notice that with the default delays, Y's claim reaches the log first, so Y wins though X clicked first. The log's order is what counts.
:::

:::details What total order broadcast is good for (pp. 339–340)
**Consensus services such as ZooKeeper and etcd implement total order broadcast**, a hint of its connection to consensus, which comes next week.

- **Database replication.** If every message is a write and every replica processes the same writes in the same order, the replicas stay consistent (apart from temporary lag). This is **state machine replication**, and it returns in Chapter 11.
- **Serializable transactions.** If every message is a **deterministic transaction** run as a stored procedure, and every node processes them in the same order, partitions and replicas stay consistent with each other. That's actual serial execution from Chapter 7, distributed.
- **The order is fixed at delivery time.** A node may not retroactively insert a message at an earlier position once later messages have been delivered. **This makes total order broadcast stronger than timestamp ordering.**
- **It's a log.** Delivering a message is like appending to a replication log, transaction log or write-ahead log. All nodes read the log and see the same sequence.
- **Fencing tokens.** Every lock request is appended as a message, and messages are numbered sequentially in log order. The **sequence number serves as the fencing token**, because it's monotonically increasing. In ZooKeeper it's the **zxid** (Chapter 8's fencing tokens, finally with a source of truth).
:::

:::quiz
### mcq
Why can't a node enforce "unique username" by comparing Lamport timestamps when a request arrives?
- [ ] Lamport timestamps aren't unique
- [x] At that moment it doesn't know whether another node is concurrently assigning a lower timestamp to a claim for the same name; it would have to ask every node, which blocks if one is unreachable
- [ ] Lamport timestamps aren't consistent with causality
- [ ] Usernames can't be ordered
>>>
The total order only emerges after all operations are collected (pp. 337–338).

### mcq
Which two properties define total order broadcast?
- [ ] Low latency and high throughput
- [x] Reliable delivery (delivered to one means delivered to all) and totally ordered delivery (same order everywhere)
- [ ] Linearizable reads and writes
- [ ] Causal consistency and availability
>>>
Both must hold even with faulty nodes or networks (p. 339).

### predict
A node using total order broadcast has delivered messages 1–7. Can message 5's position later change because a slow node's message turns out to have an earlier timestamp?
- [ ] Yes, it is re-sorted by timestamp
- [x] No: the order is fixed at delivery time; later messages are appended after 7
- [ ] Only if the leader changes
- [ ] Only for writes
>>>
That's precisely why it's stronger than timestamp ordering (p. 340).

### mcq
How does total order broadcast provide fencing tokens?
- [ ] By using wall-clock time
- [x] Each lock request is a message in the log, and its sequence number, which is monotonically increasing, serves as the fencing token (ZooKeeper's zxid)
- [ ] By hashing the client ID
- [ ] It can't
>>>
That gives Chapter 8's fencing tokens a single, totally ordered source (p. 340).

### tradeoff
A partitioned database keeps a separate ordered log per partition. What can't it easily guarantee?
- [x] Consistent snapshots or foreign-key constraints spanning partitions, since there's no total order across partitions without extra coordination
- [ ] Ordering within a partition
- [ ] Durability
- [ ] Replication
>>>
That's the box on p. 339 on the scope of ordering guarantees.

### explain
What is state machine replication, and why does total order broadcast make it work?
>>>
Treat each replica as a deterministic state machine whose state is changed only by applying a sequence of commands (writes or deterministic transactions). If every replica starts in the same state and applies the same commands in the same order, they all end up in the same state, apart from temporary lag. Total order broadcast guarantees exactly that input: every message is delivered to every replica, and in the same order. So replicas stay consistent without comparing state (p. 339). The commands must be deterministic, which is why stored procedures for serial execution must avoid things like reading the current time or random numbers (Chapter 7).
:::

:::connect Where this goes next
Tomorrow: the surprising equivalences. With total order broadcast you can build a linearizable compare-and-set, and with a linearizable increment-and-get you can build total order broadcast. Both turn out to be equivalent to consensus.
:::
