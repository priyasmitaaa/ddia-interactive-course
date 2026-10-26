---
title: Tracking Causality, Sequence Numbers and Lamport Timestamps
kind: lesson
minutes: 95
chapter: 9
objectives:
- Explain what a replica must do to maintain causal consistency, and why version vectors generalize to it
- Explain why tracking all causal dependencies is impractical, and how sequence numbers help
- Explain why a single-leader replication log gives a causally consistent total order
- Explain why odd/even counters, physical timestamps and block allocation are not consistent with causality
- Explain how Lamport timestamps work (Figure 9-8) and how they differ from version vectors
reading:
- Tracking causal relationships | 333-334
- Sequence number ordering | 334-335
- Non-causal sequence number generators | 335-336
- Lamport timestamps | 336-337
complete:
- You reproduced Figure 9-8 and broke it by turning off "carry the max counter"
- Exercise 32 (logical clocks) is done
- You answered the quiz
---

:::problem Who knew what, and when?
To maintain causality you must know which operation happened before which. That's a partial order: concurrent operations may be processed in any order, but if one happened before another, **every replica must process them in that order**. When a replica processes an operation, all causally preceding operations must already be processed. If one is missing, the later operation waits (p. 333).

To determine causal relationships, you need to describe a node's **knowledge**. If it had already seen X when it issued write Y, then X and Y may be causally related. "The arguments start looking like the kinds of questions you would expect in a criminal investigation of fraud charges: did the CEO know about X at the time when they made decision Y?"
:::

:::intuition Version vectors, sequence numbers, and Lamport's trick
**Tracking causality** (pp. 333–334). The techniques resemble Chapter 5's detection of concurrent writes, but causal consistency must track dependencies across the **entire database**, not just one key. **Version vectors can be generalized** to do this. The database must know **which version of the data the application read**. That's why, in Figure 5-13, the version number from the previous operation is passed back on a write. SSI does something similar: at commit it checks whether the data a transaction read is still up to date.

**Sequence number ordering** (p. 334). Tracking *every* dependency is impractical. Clients read lots of data before writing, and it's unclear which reads the write depended on. The better way is **sequence numbers or timestamps**, from a **logical clock** (counters) rather than a time-of-day clock. They're compact, a few bytes, and give a **total order**. We can create a total order **consistent with causality**: if A causally happened before B, A gets the lower number, and concurrent operations are ordered arbitrarily. That captures all the causality information but imposes *more* order than causality strictly requires. (Footnote vii: a total order *inconsistent* with causality is easy, such as comparing random UUIDs, but useless.)

**With a single leader**, this is easy (pp. 334–335). The leader increments a counter for each operation in the replication log. A follower that applies writes in log order is always **causally consistent**, even if it's lagging.

**Without a single leader** (multi-leader, leaderless, or partitioned), practical generators are (p. 335):
1. **Independent per-node sequences**, such as odd numbers on one node and even on another, or node-ID bits in the number.
2. **Physical timestamps** with enough resolution, as LWW uses.
3. **Pre-allocated blocks**: node A gets 1–1,000 and node B gets 1,001–2,000.

They're faster and more scalable than a single leader, and give unique, approximately increasing numbers, but **none is consistent with causality** (pp. 335–336):
- Nodes process different numbers of operations per second, so one counter lags the other, and an odd and an even number can't tell you which came first.
- Physical clocks are subject to **skew** (Figure 8-3). (Footnote viii: Spanner's commit wait makes physical timestamps causal, but most clocks can't provide the needed uncertainty bound.)
- A block allocator may give a causally *later* operation a number from a *lower* block.
:::

:::visual CausalityViz | Figure 9-8: Lamport timestamps
@props {"initialTab":"lamport"}
**Try this:**
1. The preset is Figure 9-8. Client A writes to node 1 and gets (1,1). B writes to node 2 four times, getting (1,2)…(4,2). A writes to node 2 and gets (5,2), learning max = 5. When A writes to node 1, node 1 jumps from 1 to 5, so A gets **(6,1)**.
2. Untick **carry the max counter**. Now each node just counts its own operations, and A's third write gets (2,1), *smaller* than the (5,2) it had already seen. That's a causality violation.
3. Add your own operations. Can you produce a violation with the max carried? (You can't.)
:::

:::details Lamport timestamps precisely (pp. 336–337)
Proposed by **Leslie Lamport in 1978**, in one of the most-cited papers in distributed systems. Each node has a unique ID and a counter of operations it has processed. A **Lamport timestamp is the pair (counter, node ID)**. Two nodes may have the same counter, but the node ID makes each timestamp unique.

**Ordering:** a greater counter means a greater timestamp. On equal counters, the greater node ID wins. It has no relationship to time-of-day clocks.

So far that's the same as the odd/even counters. **The key idea:** every node *and every client* keeps track of the **maximum counter value it has seen**, and includes it on every request. When a node receives a request with a maximum greater than its own counter, it **immediately increases its counter to that maximum**. As long as the maximum is carried along with every operation, **every causal dependency results in an increased timestamp**, so the order is consistent with causality.

**Lamport timestamps vs version vectors** (p. 337). They're sometimes confused, but their purposes differ:
- **Version vectors** distinguish whether two operations are **concurrent** or one is causally dependent on the other.
- **Lamport timestamps** always enforce a **total order**. From the timestamps alone you **can't tell** whether two operations were concurrent or causally dependent.

The advantage of Lamport timestamps is compactness: one counter and a node ID, instead of one entry per node.
:::

:::practice 32-logical-clocks | Lamport vs vector clocks vs naive generators
Implement both logical clocks and score odd/even counters, block allocation and physical clocks against the true happened-before relation.
:::

:::quiz
### mcq
Why does a follower that applies a single leader's replication log in order stay causally consistent, even when lagging?
- [ ] Because followers are synchronous
- [x] Because the leader assigns increasing sequence numbers in the order it processes writes, and that total order is consistent with causality
- [ ] Because followers use version vectors
- [ ] Because lag doesn't exist with a leader
>>>
It may be behind, but it never sees an effect before its cause (pp. 334–335).

### mcq
Node A uses even sequence numbers and node B odd. A handles 10× more traffic than B. What's the problem?
- [ ] Numbers might collide
- [x] A's counter races ahead of B's, so a causally later operation on B can get a smaller number than an earlier one on A
- [ ] B runs out of numbers
- [ ] None; it's consistent with causality
>>>
Independent counters don't track ordering across nodes (p. 335).

### predict
In Figure 9-8, node 1's counter is 1 when it receives client A's request carrying max = 5. What timestamp does the new operation get?
- [ ] (2, 1)
- [ ] (5, 1)
- [x] (6, 1)
- [ ] (1, 5)
>>>
The node jumps to the maximum (5), then increments for the new operation (p. 337).

### mcq
What can version vectors tell you that Lamport timestamps can't?
- [ ] Which operation has the larger number
- [x] Whether two operations were concurrent or one causally depended on the other
- [ ] The wall-clock time of an operation
- [ ] Which node is the leader
>>>
Lamport timestamps always give a total order, so concurrency is invisible in them (p. 337).

### tradeoff
Why do the book's three non-causal generators exist at all, if they're not consistent with causality?
- [x] They're faster and more scalable than pushing every operation through a single leader's counter, and they give unique, approximately increasing numbers, which is good enough for some purposes
- [ ] They're more accurate than Lamport timestamps
- [ ] They detect concurrency
- [ ] They're required by multi-leader replication
>>>
The trade-off is scalability vs causal correctness (p. 335).

### explain
Explain why carrying the maximum counter on every request makes Lamport timestamps consistent with causality.
>>>
If operation a happened before b, there's a chain from a to b made of steps on the same node, where the node's counter increments each time, and messages, where the receiver's counter is raised to at least the sender's maximum before incrementing. Along every link of the chain the counter strictly increases, or ties are broken by node ID with a greater counter afterwards. So b's counter ends up strictly greater than a's, and every causal dependency yields an increased timestamp (p. 337). Without carrying the maximum, a message from a fast-counting node wouldn't raise the slow node's counter, which is the odd/even failure.
:::

:::connect Where this goes next
Lamport timestamps give a total order consistent with causality. Is that enough to enforce a unique username? Tomorrow: no. You also need to know when the order is **final**, and that's total order broadcast.
:::
