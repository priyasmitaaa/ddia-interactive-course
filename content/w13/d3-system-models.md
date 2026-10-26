---
title: System Models, Safety and Liveness
kind: lesson
minutes: 85
chapter: 8
objectives:
- Explain what a system model is and why algorithms need one
- Define the synchronous, partially synchronous and asynchronous timing models, and the crash-stop, crash-recovery and Byzantine node models
- State the correctness properties of a fencing-token service and classify them as safety or liveness
- Define safety and liveness precisely, and explain why algorithms must keep safety in all situations but may make liveness conditional
- Explain how real systems break model assumptions, and summarize Chapter 8
reading:
- System model and reality | 298-299
- Correctness of an algorithm | 299-300
- Safety and liveness | 300-301
- Mapping system models to the real world | 301-302
- Summary | 302-303
complete:
- You classified a list of properties as safety or liveness
- You can name the most useful system model for real systems and say why
- You answered the quiz
---

:::problem How do you prove anything about a system where anything can go wrong?
Chapter 9 will present algorithms such as consensus that must tolerate the faults of this chapter. To be useful, they mustn't depend too heavily on the details of particular hardware and software. That means **formalizing the faults we expect**, through a **system model**: an abstraction that describes what an algorithm may assume (p. 298).
:::

:::intuition Two dials: timing and node failures
**Timing models** (pp. 298–299):
- **Synchronous.** Network delay, process pauses and clock error are all **bounded**. That doesn't mean zero delay or perfectly synchronized clocks, only that they never exceed some known upper bound. It is **not realistic** for most practical systems, because unbounded delays and pauses do occur.
- **Partially synchronous.** The system behaves synchronously **most of the time** but sometimes exceeds the bounds, and then delays, pauses and clock error may become arbitrarily large. That is a realistic model of many systems.
- **Asynchronous.** No timing assumptions at all. There is no clock, so **no timeouts**. Some algorithms can be designed this way, but it's very restrictive.

**Node failure models** (p. 299):
- **Crash-stop.** A node fails only by crashing. It stops responding and never comes back.
- **Crash-recovery.** Nodes may crash and perhaps start responding again after some unknown time. **Stable storage** (disk) survives crashes, while in-memory state is lost.
- **Byzantine (arbitrary).** Nodes may do anything, including trying to trick and deceive others.

**For modeling real systems, partially synchronous plus crash-recovery is generally the most useful combination** (p. 299).

**Correctness = properties.** Just as "sorted" can be stated formally ("for any two distinct elements, the one further left is smaller"), we write down properties for a distributed algorithm. For the **fencing tokens** of Monday's lesson (pp. 299–300):
- **Uniqueness:** no two requests for a fencing token return the same value.
- **Monotonic sequence:** if request *x* returned token *t_x*, request *y* returned *t_y*, and *x* completed before *y* began, then *t_x* < *t_y*.
- **Availability:** a node that requests a token and doesn't crash eventually receives a response.

An algorithm is correct in a model if it always satisfies its properties in every situation the model allows. But if all nodes crash or all network delays become infinite, nothing can get done. That's where the distinction between two kinds of property comes in.
:::

:::details Safety, liveness, and mapping models to reality (pp. 300–303)
**Safety and liveness** (p. 300). Uniqueness and monotonic sequence are **safety** properties. Availability is a **liveness** property. A giveaway is that liveness properties often contain the word **"eventually"**, and yes, **eventual consistency is a liveness property**. Informally, safety means *nothing bad happens* and liveness means *something good eventually happens*, but good and bad are subjective. The precise definitions:
- If a **safety** property is violated, you can point to a **particular point in time** when it was broken (the operation that returned a duplicate token). Once violated, the damage **cannot be undone**.
- A **liveness** property may not hold at some moment (a request is sent but not yet answered), but **there is always hope it will be satisfied in future**.

Why the distinction helps: distributed algorithms commonly require that **safety always holds**, in all possible situations of the model, even if all nodes crash or the entire network fails. The algorithm must never return a wrong result. **Liveness may come with caveats**: for example, a request is answered only if a majority of nodes are up and the network eventually recovers. The partially synchronous model's definition requires that the system *eventually* returns to a synchronous state, meaning any network interruption lasts a finite time and is then repaired (pp. 300–301).

**Mapping system models to the real world** (pp. 301–302). Models are simplifications, and "the messy facts of reality come back to bite you":
- Crash-recovery algorithms assume stable storage survives crashes. What if the disk is corrupted, or wiped by hardware error or misconfiguration? What if firmware fails to recognize the drives on reboot?
- Quorum algorithms rely on a node **remembering** data it claims to have stored. A node with **amnesia** breaks the quorum condition and the algorithm's correctness. A new model ("stable storage *mostly* survives") would be harder to reason about.
- A theoretical description can declare that certain things never happen, but a real implementation may still need code for the "impossible", even if it's just `printf("Sucks to be you")` and `exit(666)` so a human can clean up. That is "arguably the difference between computer science and software engineering".

Abstract models are still "incredibly helpful". They distill real complexity into a manageable set of faults, and proofs show properties always hold in a model. Proving an algorithm correct doesn't mean its *implementation* always behaves correctly, but theoretical analysis uncovers problems that might stay hidden for a long time in a real system. **Theoretical analysis and empirical testing are equally important** (pp. 301–302).

**Chapter 8 summary** (pp. 302–303):
- Packets may be lost or arbitrarily delayed, and so may replies, so with no reply you have no idea whether the message got through.
- A node's clock may be significantly out of sync, may jump, and you probably have no good measure of its error.
- A process may pause for a substantial time at any point, be declared dead, and come back without realizing it was paused.

These are **partial failures**. Detecting them is hard: most systems rely on timeouts, which can't distinguish network failures from node failures. A node can also be in a **degraded** state, for example a Gigabit NIC dropping to 1 kbit/s because of a driver bug, and such a "limping" node can be harder to deal with than a cleanly failed one. Tolerating faults is hard too: there's no shared memory or common knowledge, and nodes can't even agree on the time. So major decisions can't be made by a single node, and we need protocols that get a **majority quorum** to agree.

If you can avoid opening Pandora's box and keep things on one machine, it's generally worth it, since a single computer can do a lot nowadays. But fault tolerance and low latency (data close to users) can't be achieved on a single node. Unreliability isn't a law of nature: bounded delays and real-time guarantees are possible but expensive, and most non-safety-critical systems choose **cheap and unreliable** over expensive and reliable. Distributed systems can, in theory, run forever, with all faults handled at the node level. In practice, a bad configuration change rolled out to all nodes still brings them to their knees. Next chapter: solutions.
:::

:::quiz
### mcq
Which system model does the book call generally the most useful for real systems?
- [ ] Synchronous with crash-stop faults
- [x] Partially synchronous with crash-recovery faults
- [ ] Asynchronous with Byzantine faults
- [ ] Synchronous with Byzantine faults
>>>
Real systems are well behaved most of the time but occasionally exceed every bound, and nodes crash and restart with their disks intact (p. 299).

### mcq
Which of these is a liveness property?
- [ ] No two clients are granted the same fencing token
- [ ] A committed write is never lost
- [x] Every request to a non-crashed node eventually receives a response
- [ ] Tokens returned in sequence are increasing
>>>
"Eventually" is the giveaway. A liveness property can be unsatisfied at a moment but may still be satisfied later (p. 300).

### predict
Your algorithm guarantees "no two nodes ever both believe they are leader in the same term". During a total network outage, no node can become leader. Is the guarantee violated?
- [ ] Yes, because there is no leader
- [x] No: that's a safety property, and having no leader breaks nothing; only liveness (eventually electing a leader) is affected, which may be conditional on the network recovering
- [ ] Yes, because the network failed
- [ ] It depends on the clocks
>>>
Safety must hold in all situations, while liveness may come with caveats such as "if a majority is up and the network eventually recovers" (pp. 300–301).

### mcq
What distinguishes the asynchronous model from the partially synchronous one?
- [ ] The asynchronous model allows Byzantine nodes
- [x] In the asynchronous model, an algorithm may make no timing assumptions at all, and doesn't even have a clock, so it can't use timeouts
- [ ] The asynchronous model has bounded delays
- [ ] They are the same
>>>
It's very restrictive. Partial synchrony instead assumes bounds hold most of the time (pp. 298–299).

### tradeoff
A quorum-based database assumes that a node remembers what it acknowledged. A disk failure wipes a node, and it rejoins empty. What does the book say about this?
- [x] It breaks the quorum condition and thus the algorithm's correctness; a model where storage "mostly" survives is harder to reason about, and implementations may need code to handle such "impossible" cases
- [ ] It's fine, because quorums tolerate any failure
- [ ] It's a liveness problem only
- [ ] It's a Byzantine fault, which the book ignores
>>>
Node "amnesia" is a gap between the crash-recovery model and reality (p. 301).

### explain
State the three correctness properties of a fencing-token service, classify each as safety or liveness, and say how you'd detect a violation of each in a test.
>>>
Uniqueness (no two token requests return the same value) is safety: a violation is a specific pair of responses with the same token, which you can find by checking all returned tokens for duplicates. Monotonic sequence (if request x completed before request y began, then x's token is smaller than y's) is safety: record each request's start time, end time and token, then check every pair where x.end < y.start. Any pair with t_x ≥ t_y is a violation at a specific point in time. Availability (a non-crashed requester eventually gets a response) is liveness: a test can't prove "eventually" from a finite run, but it can check that responses arrive within some bound when a majority is up and the network works, and treat missing responses under those conditions as failures (pp. 299–300). Lab 30 builds exactly this checker.

### scenario
A team says: "We proved our replication protocol correct, so we don't need fault-injection testing." Respond using the end of Chapter 8.
>>>
A proof shows the algorithm's properties hold within its system model. Real systems break model assumptions. Disks get corrupted or wiped, firmware fails to recognize drives, nodes suffer amnesia, NICs "limp" at 1 kbit/s, and the implementation may contain bugs the proof never covered (pp. 301–302). Proofs are valuable because they reveal design flaws that could stay hidden for a long time, but "theoretical analysis and empirical testing are equally important". Keep the proof and also inject faults deliberately (network faults, pauses, clock jumps, disk loss), as in Chapter 1's chaos-testing advice.
:::

:::connect Where this goes next
Tomorrow's lab: implement a lease service with fencing tokens, reproduce Figure 8-4 with real threads, and write a checker for the safety properties above. After that, a case study that ties Chapters 5–8 together.
:::
