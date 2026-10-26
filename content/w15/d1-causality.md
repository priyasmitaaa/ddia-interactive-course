---
title: Ordering and Causality
kind: lesson
minutes: 85
chapter: 9
objectives:
- Recall where ordering appeared in Chapters 5, 7 and 8, and why it keeps coming up
- Recognize causal dependencies in the book's earlier examples and state "watch your causality"
- Distinguish a total order from a partial order, and map linearizability and causality onto them
- Explain why linearizability implies causal consistency, and why causal consistency is attractive
reading:
- Ordering guarantees | 329-330
- Ordering and causality | 330-331
- The causal order is not a total order | 331-332
- Linearizability is stronger than causal consistency | 332-333
complete:
- You classified at least six pairs of events as happened-before or concurrent in the visualization
- You can explain why there's no concurrency in a linearizable datastore
- You answered the quiz
---

:::problem Order keeps coming up. Why?
Ordering has appeared again and again (pp. 329–330):
- **Chapter 5.** The main job of the leader in single-leader replication is to determine the **order of writes** in the replication log. Without a single leader, concurrent operations conflict.
- **Chapter 7.** Serializability means transactions behave as if executed in **some sequential order**, whether literally or by preventing serialization conflicts.
- **Chapter 8.** Timestamps and clocks are an attempt to **introduce order into a disorderly world**: which of two writes happened later?

There are deep connections between ordering, linearizability and consensus. This part is more theoretical than most of the book, but it clarifies what systems can and cannot do.
:::

:::intuition Cause comes before effect
One big reason ordering matters is that it **preserves causality**. Examples from earlier in the book (pp. 330–331):
- **Consistent prefix reads** (Figure 5-5): an observer saw an answer before the question. The question and answer are **causally related**.
- **Figure 5-9**: writes "overtaking" others between leaders, so a replica saw an update to a row that didn't exist. A row must be created before it can be updated.
- **Detecting concurrent writes** (Chapter 5): for operations A and B, either A happened before B, B happened before A, or they're concurrent. *Happened before* means B might have known about, built on or depended on A. **Concurrent** means neither knew about the other.
- **Snapshot isolation**: "consistent" snapshot means **consistent with causality**. If it contains an answer, it contains the question. **Read skew** means reading a state that violates causality.
- **Write skew** (Figure 7-8): going off call is *causally dependent* on observing who is on call. SSI detects write skew by tracking those causal dependencies.
- **Alice and Bob** (Figure 9-1): Bob hearing Alice is causally dependent on the score announcement, so he should see the score too. The image resizer race (Figure 9-5) is the same thing.

"Many of the last 200 pages of this book could be boiled down to the three words: **watch your causality!**" (p. 331). Chains of causally dependent operations (one node reads and writes, another reads that and writes something else) define the **causal order**: what happened before what. A system that obeys it is **causally consistent**.
:::

:::visual CausalityViz | Happened-before vs concurrent
@props {"initialTab":"hb"}
Three nodes exchange messages (arrows). An event happened before another if a chain of same-node steps and messages leads from the first to the second.

**Try this:**
1. Compare **b** and **j**, then **b** and **k**. Why is one pair concurrent and the other causally ordered?
2. Find two events on the *same* node that are concurrent. (You can't. Why not?)
3. Turn off vector clocks to see Lamport numbers. Find two concurrent events where Lamport still says one is "smaller". That's tomorrow's topic.
:::

:::details Total vs partial order, and causal consistency (pp. 331–333)
**Total vs partial order.** A **total order** lets you compare any two elements. Natural numbers are totally ordered: 13 > 5. Mathematical **sets** are **partially ordered**. Is {a, b} greater than {b, c}? Neither is a subset of the other, so they're **incomparable**.

This maps onto consistency models (p. 332):
- **Linearizability** gives a **total order** of operations. With a single copy and atomic operations, you can always say which of two operations happened first, as in the single timeline of Figure 9-4.
- **Causality** gives a **partial order**. Causally related operations are ordered, and concurrent ones are incomparable.

So there are **no concurrent operations in a linearizable datastore**. There's a single timeline on which every operation is totally ordered. Requests may wait, but each is handled atomically at one point in time on one copy. Concurrency would mean the timeline branches and merges, like Figure 5-14's jumble of concurrent operations whose arrows show the partial order. **Git histories** look like this: usually a straight line, but branches when people work concurrently, and merges when the work is combined.

**Linearizability is stronger than causal consistency** (pp. 332–333). **Linearizability implies causality.** Any linearizable system preserves causality correctly, even across *multiple communication channels* (the queue and the file storage in Figure 9-5), without passing timestamps around. That's what makes linearizable systems simple to understand and appealing. But, as we saw, linearizability harms performance and availability, especially with large network delays such as geo-distribution, and many systems therefore abandoned consistency guarantees altogether.

There's a **middle ground**. A system can be causally consistent without the performance hit of linearizability, and **CAP doesn't apply**. In fact, **causal consistency is the strongest possible consistency model that doesn't slow down due to network delays and remains available during network failures**. Many systems that *appear* to need linearizability really only need causal consistency. Researchers are building databases that preserve causality with the performance and availability of eventually consistent systems. As of 2016 this research was recent and not yet in many production systems, with challenges remaining, but it is a promising direction (p. 333).
:::

:::quiz
### mcq
Which statement is correct?
- [ ] Causality defines a total order of all events
- [x] Linearizability gives a total order of operations; causality gives a partial order, where concurrent operations are incomparable
- [ ] Linearizability allows concurrent operations
- [ ] Partial orders can compare any two elements
>>>
Single timeline vs branching and merging history (p. 332).

### mcq
Which example from earlier chapters is NOT a causality violation?
- [ ] An observer seeing an answer before its question (consistent prefix reads)
- [ ] Read skew in a backup taken while transfers run
- [ ] Bob seeing a stale score after hearing Alice
- [x] Two users concurrently editing different documents with no knowledge of each other
>>>
Concurrent events with no causal link can be ordered either way without violating causality (pp. 330–331).

### predict
A causally consistent store keeps running during a network partition. Can it remain available, according to the book?
- [ ] No, CAP forbids it
- [x] Yes: causal consistency is the strongest model that doesn't slow down due to network delays and remains available during network failures
- [ ] Only if it has a single leader
- [ ] Only with synchronized clocks
>>>
CAP is about linearizability. Causal consistency avoids its trade-off (p. 333).

### mcq
Why does linearizability automatically handle cross-channel races like Figure 9-5?
- [ ] Because it uses timestamps
- [x] Because linearizability implies causality: once the write completed, anyone who learns about it through any channel and then reads sees it
- [ ] Because the queue is linearizable too
- [ ] It doesn't
>>>
Linearizable systems preserve causality without passing extra information between components (p. 332).

### explain
Explain why there are "no concurrent operations in a linearizable datastore", and contrast it with a git repository's history.
>>>
Linearizability makes the system behave as if there were a single copy, with every operation taking effect atomically at one point on a single timeline. Requests can be in flight at the same time, but the datastore handles each one at a distinct point, so any two operations are ordered: a total order (p. 332). A git history is a partial order. Commits made one after another form a line, but two people working concurrently create branches whose commits are incomparable (neither built on the other), and a merge commit later depends on both. That branching and merging is what concurrency looks like, and it's what causality, rather than linearizability, describes.
:::

:::connect Where this goes next
To preserve causality without linearizability, you have to **track** what happened before what. Tomorrow: why tracking every dependency is impractical, and Lamport's trick of a sequence number that's consistent with causality.
:::
