---
title: Consistency Guarantees and Linearizability
kind: lesson
minutes: 90
chapter: 9
objectives:
- Explain the chapter's approach of finding general abstractions with useful guarantees, as with transactions
- Explain why eventual consistency (convergence) is a weak guarantee and hard to program against
- Define linearizability as the illusion of a single copy with atomic operations, and as a recency guarantee
- Decide which values a read may return when it is concurrent with a write, using register timing diagrams
- Explain the "no going back" constraint of Figure 9-3 and read a history like Figure 9-4
reading:
- Chapter 9 opening | 311-312
- Consistency guarantees | 312-313
- Linearizability; Figure 9-1 | 314-315
- What makes a system linearizable? | 315-319
complete:
- You produced both a linearizable and a non-linearizable version of Figures 9-2 and 9-4 in the checker
- You can say which reads in Figure 9-2 must return 0, must return 1, or may return either
- You answered the quiz
---

:::problem Alive and wrong, or right and dead?
Chapter 8 listed everything that goes wrong: lost, reordered, duplicated and delayed packets, approximate clocks, pausing and crashing nodes. The simplest response is to let the whole service fail and show an error. If that's unacceptable, we have to **tolerate** faults (p. 311).

The approach of this chapter mirrors Chapter 7. Find **general-purpose abstractions with useful guarantees**, implement them once, and let applications rely on them. A transaction lets an application pretend there are no crashes, no concurrent clients and perfectly reliable disks. Chapter 9 looks for abstractions that let applications ignore some of the problems of distributed systems. The most important is **consensus**: getting all nodes to agree on something. With it you can, for example, elect a new leader after a failover without **split brain**. Getting consensus right is surprisingly tricky, so we first explore what guarantees are possible at all (p. 312).
:::

:::intuition From "eventually" to "as if there were one copy"
**Eventual consistency** (p. 312). Most replicated databases promise only that if you stop writing and wait an unspecified time, all reads eventually return the same value. A better name is **convergence**. It's a very weak guarantee: it says nothing about *when*, and until then reads could return anything or nothing. Write a value and read it right back, and you may not see it (read-your-writes, Chapter 5). A database looks like a variable, but its semantics are much more complicated. Bugs are subtle, often show up only during faults or high concurrency, and are hard to find by testing (p. 313).

Stronger models exist. They cost performance or fault tolerance, but they're easier to use correctly. (They overlap with Chapter 7's isolation levels but are mostly independent. Isolation is about races between concurrent *transactions*, while distributed consistency is about coordinating the state of *replicas* despite delays and faults.)

**Linearizability** (p. 314), also called atomic consistency, strong consistency, immediate consistency or external consistency, means making a system **appear as if there were only one copy of the data, and all operations on it are atomic**. As soon as one client's write completes, **all** clients must see the new value: no stale caches, no lagging replicas. It is a **recency guarantee**.

**Figure 9-1**: Alice and Bob watch the 2014 World Cup final scores on their phones. Alice reloads, sees Germany has won and tells Bob. Bob reloads *after hearing her*, but his request hits a lagging replica that says the match is still on. Had they reloaded simultaneously, different answers would be fine. But Bob knows his request started after Alice's finished, so he expects a result at least as recent. The stale result violates linearizability (p. 315).
:::

:::visual LinearizabilityViz | Which values may a read return?
@props {"initial":"fig92"}
Each bar is one operation as a client experiences it, from sending the request to getting the response. The database processed it at some instant inside the bar, but the client doesn't know when.

**Try this:**
1. Figures 9-2/9-3: A's first read must return 0 (it finished before the write began), and A's last read must return 1 (it began after the write finished). Click the middle reads to try 0 and 1.
2. Make A's middle read return 1 and B's second read return 0. The checker says no: once *any* read has returned the new value, every read that starts later must return it too (Figure 9-3).
3. Switch to **Figure 9-4** and find the read that breaks linearizability. Fix it.
:::

:::details Registers, timing diagrams and Figure 9-4 (pp. 315–319)
In the literature the object being read and written is a **register**. In practice that's one key in a key-value store, one row or one document. Diagrams show operations from the client's side. A bar starts when the request is sent and ends when the response arrives. Because of variable network delays, the client only knows the operation took effect *somewhere inside* its bar. (Footnote i: the horizontal axis assumes a global clock. That's fine for *analyzing* an algorithm, as long as the algorithm itself can't access it.)

Notation: `read(x) ⇒ v` (the read returned v) and `write(x, v) ⇒ r` (r is ok or error).

**Figure 9-2.** x is initially 0. C writes 1, while A and B poll.
- A read that **completes before** the write begins must return **0**.
- A read that **begins after** the write completes must return **1**.
- Reads **concurrent** with the write may return either.

That alone would allow a value to **flip back and forth** during a write. (Footnote ii: such a register is called a **regular register**.) That isn't what a single copy behaves like.

**Figure 9-3: the extra constraint.** There must be some point *within* the write at which x **atomically flips** from 0 to 1. After any read has returned 1, all subsequent reads, on any client, must return 1, even if the write hasn't completed yet. It's Alice and Bob again.

**Figure 9-4** adds **compare-and-set**, `cas(x, v_old, v_new) ⇒ r`, which sets x to v_new only if x currently equals v_old, and otherwise returns an error. Each operation gets a marker at the moment it appears to have taken effect, and the markers are joined in sequence. The result must be a valid register history, with every read returning the latest write. **The joining line must always move forward in time, never backward.** Details worth noticing (pp. 318–319):
- B sent its read first, then D wrote 0, then A wrote 1, yet B's read returned 1. That's fine: the three were concurrent, so the database could process D, then A, then B's read. Perhaps B's request was delayed in the network.
- B read 1 *before* A got its "ok". That doesn't mean the value was read before it was written. A's response was simply delayed.
- No transaction isolation is assumed: C reads 1 and then 2 because B changed it in between. `cas` checks for concurrent changes, so B's and C's cas succeed and D's fails, because x is no longer 0 when it's processed.
- **B's final read is not linearizable.** It's concurrent with C's cas from 2 to 4, so alone it could return 2. But A had *already read 4* before B's read began, so B may not return an older value.

Testing whether a real system is linearizable is possible, though computationally expensive. Record the timing of all requests and responses, then check whether they can be arranged into a valid sequential order (p. 319). You'll build exactly that this week.
:::

:::quiz
### mcq
Why is eventual consistency described as a "very weak guarantee"?
- [ ] Because replicas never converge
- [x] Because it says nothing about when replicas will converge; until then, reads could return anything or nothing
- [ ] Because it requires a leader
- [ ] Because it only works with LWW
>>>
It's really just convergence. It doesn't even guarantee you'll read your own write right after making it (pp. 312–313).

### mcq
In Figure 9-2, a read starts after C's write of 1 has completed. In a linearizable system, what must it return?
- [ ] 0 or 1
- [ ] 0
- [x] 1
- [ ] An error
>>>
The write took effect before it completed, and the read is processed after it started, so it's processed after the write (p. 316).

### predict
During a write of x from 0 to 1, client A's read returns 1. Just afterwards, client B starts a read, while the write is still in progress. What may B's read return?
- [ ] 0 or 1, since the write is still in progress
- [x] Only 1: once any read has seen the new value, all later reads must see it too
- [ ] Only 0
- [ ] Nothing until the write completes
>>>
Figure 9-3's constraint: there's a single moment when the value flips, and A's read shows that it has already happened (p. 317).

### mcq
In Figure 9-4, B's read returns 1 even though B sent it before A sent the write of 1. Why is that allowed?
- [ ] Because B's read is not linearizable
- [x] Because the three requests were concurrent, so the database may have processed D's write, then A's write, then B's read
- [ ] Because B used compare-and-set
- [ ] Because reads are always delayed
>>>
Only operations that *don't overlap* in time have a required order. Concurrent ones may take effect in any order (pp. 318–319).

### tradeoff
A teammate says: "Our cache is eventually consistent, so it's fine for showing users their own just-updated profile." What's the risk?
- [x] A read right after the write may be served by a replica or cache that hasn't converged, so users may not see their own update; that needs read-your-writes or a stronger guarantee
- [ ] There's no risk; eventual consistency includes read-your-writes
- [ ] The cache will crash
- [ ] Writes will be lost permanently
>>>
Eventual consistency guarantees neither when you'll see the value nor that you'll see your own write (p. 313, Chapter 5).

### explain
Explain linearizability to someone who knows programming but not distributed systems, using the "variable" analogy and Figure 9-1.
>>>
In a single-threaded program, once you assign `x = 1`, every later read of x gives 1. There's one copy and it changes instantly. A linearizable database promises the same behavior even though it actually keeps several copies on different machines. Once a write has completed, or once anyone has read the new value, every read that starts afterwards returns it, from any client and any replica. Figure 9-1 shows a violation. Alice sees the final score, tells Bob, and Bob then reloads but gets a stale "game still on" from a lagging replica. Since Bob's request started after Alice's finished, a single-copy system could never give him an older answer. Linearizability is a recency guarantee, so you never go back in time (pp. 314–317).
:::

:::connect Where this goes next
Tomorrow: linearizability is easily confused with serializability, so we untangle them. Then the situations where linearizability is required for correctness: locks, leader election, uniqueness constraints, and races between two communication channels.
:::
