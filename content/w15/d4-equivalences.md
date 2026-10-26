---
title: Linearizable Storage and Total Order Broadcast — Two Sides of One Coin
kind: lesson
minutes: 95
chapter: 9
objectives:
- Explain the difference between total order broadcast (asynchronous, ordered) and linearizability (recency)
- Build a linearizable compare-and-set (unique usernames) on top of total order broadcast
- Explain why that procedure gives sequential consistency and how to make reads linearizable
- Build total order broadcast from a linearizable increment-and-get register, and explain why gaps matter
- State that linearizable CAS, total order broadcast and consensus are equivalent
reading:
- Implementing linearizable storage using total order broadcast | 340-342
- Implementing total order broadcast using linearizable storage | 342-342
complete:
- Exercise 33 (username registry on a log) is done
- You can describe both constructions in four steps each
- You answered the quiz
---

:::problem Same thing?
A linearizable system has a total order of operations (Figure 9-4). Total order broadcast delivers messages in a total order. Are they the same thing? Not quite, but there are close links (p. 340).

**Total order broadcast is asynchronous.** Messages are guaranteed to be delivered reliably in a fixed order, but there's no guarantee *when*, so one recipient may lag behind the others. **Linearizability is a recency guarantee.** A read is guaranteed to see the latest value written. Still, each can be built from the other.
:::

:::intuition Construction 1: linearizable compare-and-set from a log
Imagine a linearizable register for every possible username, initially null, with an atomic **compare-and-set**. To claim a name, cas its register from null to your user ID. If several users try at once, only one cas succeeds, because the others see a non-null value.

Built on total order broadcast used as an **append-only log** (p. 341):
1. **Append** a message to the log, tentatively claiming the username.
2. **Read the log and wait** for the message you appended to be delivered back to you. (Footnote xi: if you don't wait and acknowledge as soon as it's enqueued, you get something like the multi-core x86 memory model, which is neither linearizable nor sequentially consistent.)
3. **Check** for messages claiming that username. If the **first** claim is yours, you've succeeded. Commit the claim (perhaps by appending another message) and acknowledge the client. If the first claim is someone else's, abort.

Log entries reach every node in the same order, so **all nodes agree which concurrent claim came first**, and therefore whether each write committed or aborted. The same approach implements serializable multi-object transactions on a log.

**Reads.** This makes **writes** linearizable, but not reads. A read from a store that is asynchronously updated from the log may be stale. (The procedure provides **sequential consistency**, also called timeline consistency, which is slightly weaker.) To make reads linearizable (pp. 341–342):
- **Sequence the read through the log.** Append a message, and read when it's delivered back. Its position in the log defines when the read happens. etcd's quorum reads work somewhat like this.
- If the log lets you fetch **the position of the latest message linearizably**, query it, wait until everything up to that position has been delivered, then read. That's the idea behind ZooKeeper's `sync()`.
- Read from a replica that is **updated synchronously** on writes, as in **chain replication**.
:::

:::visual TOBSim | Revisit: the log decides
Switch to **Total order broadcast (log)** and vary the delays from node 1 and node 3 to the log. Whoever's claim reaches the log first wins, and both nodes agree on it. Then make delivery to node 2 slow. Node 2's local view lags, but the decisions made by nodes 1 and 3 are already final. A *read* at node 2 would be stale unless it's sequenced through the log. That's the reads point above.
:::

:::details Construction 2, and the big equivalence (p. 342)
**Total order broadcast from linearizable storage.** Assume a linearizable register holding an integer, with an atomic **increment-and-get** (or compare-and-set). For each message you want to broadcast, increment-and-get the register and attach the result as a **sequence number**. Send the message to all nodes, resending lost ones. Recipients deliver messages **consecutively by sequence number**.

Unlike Lamport timestamps, these numbers have **no gaps**. A node that has delivered message 4 and receives message 6 knows it must **wait for message 5**. With Lamport timestamps you can't know whether something is missing, and **that's the key difference between total order broadcast and timestamp ordering**.

**How hard can a linearizable increment-and-get be?** If nothing ever failed, trivial: one variable on one node. The difficulty is network interruptions to that node, and restoring the value when it fails. "If you think hard enough about linearizable sequence number generators, you inevitably end up with a consensus algorithm."

**This is no coincidence.** It can be proved that a **linearizable compare-and-set (or increment-and-get) register** and **total order broadcast** are both **equivalent to consensus**. If you can solve one, you can transform it into a solution for the others, "a profound and surprising insight". (Footnote x: formally, a plain linearizable *read/write* register is an "easier" problem and can be implemented where consensus can't be. Adding atomic operations like cas or increment-and-get makes it equivalent to consensus. In practice, the problems are rather similar.)
:::

:::practice 33-total-order-log | Usernames on a log
Implement Construction 1 (claim via the log) and a log-sequenced read, and compare them with check-then-write on a local replica.
:::

:::quiz
### mcq
What's the essential difference between total order broadcast and linearizability?
- [ ] One is about writes, the other about reads
- [x] Total order broadcast guarantees a fixed delivery order but not when messages are delivered (recipients may lag); linearizability guarantees a read sees the latest write
- [ ] Linearizability doesn't order operations
- [ ] They're identical
>>>
Asynchronous ordering vs recency (p. 340).

### mcq
In the username procedure, why must a node wait for its own claim to be delivered back before deciding?
- [ ] To save network bandwidth
- [x] Until then it can't know whether another claim was ordered ahead of it; once its own message is delivered, everything before it in the log is known and the decision is final
- [ ] Because the log might lose the message
- [ ] It doesn't need to wait
>>>
Skipping the wait gives a model that's neither linearizable nor sequentially consistent (p. 341, footnote xi).

### predict
Writes go through the log procedure, but reads are served from each node's local, asynchronously updated state. Right after Alice's claim succeeds, Bob reads "ada" on another node. What might he see?
- [ ] Always Alice
- [x] Possibly no owner yet, since that node may not have applied the log entry; reads are only sequentially consistent unless sequenced through the log
- [ ] An error
- [ ] Bob's own claim
>>>
That's why the book lists three ways to make reads linearizable (p. 341).

### mcq
Why do recipients of sequence numbers from a linearizable increment-and-get know when a message is missing, while Lamport-timestamp recipients don't?
- [x] The register produces a gapless sequence (1, 2, 3, …), so a jump from 4 to 6 means 5 is missing; Lamport timestamps have gaps by design
- [ ] Because Lamport timestamps aren't unique
- [ ] Because the register also stores the messages
- [ ] They both know
>>>
That's the key difference between total order broadcast and timestamp ordering (p. 342).

### tradeoff
Your team wants a fast, "simple" linearizable counter service to generate order IDs, running on one server. Why does the book suggest this road leads to consensus?
- [x] A single node is easy until it fails or becomes unreachable; making the counter survive failures without gaps or duplicates means replicating it with agreement on every increment, which is exactly a consensus problem
- [ ] Because counters must be partitioned
- [ ] Because one server can't count fast enough
- [ ] It doesn't
>>>
Linearizable increment-and-get is equivalent to consensus (p. 342).

### explain
State the equivalence the book calls "profound and surprising", and give one practical consequence for system design.
>>>
A linearizable compare-and-set (or increment-and-get) register, total order broadcast, and consensus are all equivalent: a solution to any one can be transformed into a solution to the others (p. 342). Practically, you don't need to invent a new protocol for each coordination need. If you have a consensus-based service that provides total order broadcast (ZooKeeper, etcd), you also get linearizable cas (locks, leader election, unique names) and fencing tokens (zxid). Conversely, anyone building a "simple" fault-tolerant lock, sequence generator or leader election from scratch is really building a consensus algorithm, which is notoriously hard to get right, and should probably use an existing one.
:::

:::connect Where this goes next
Tomorrow we step back and consolidate the week: a case study that applies causality, timestamps and total order broadcast to a multi-service design.
:::
