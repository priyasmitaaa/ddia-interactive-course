---
title: Reading Distributed-Systems Papers and Jepsen Reports
kind: supplement
minutes: 75
chapter: 9
objectives:
- Use the system-model and safety/liveness vocabulary to read a paper's claims precisely
- Read a database's consistency documentation critically, using linearizability, serializability and isolation terms correctly
- Explain how Jepsen-style testing (history recording plus checking) relates to this course's labs
reading:
- Chapter 9 summary: the value of the references | 365-365
complete:
- You applied the five-question checklist to one real paper or database document
- You answered the quiz
---

:::note Mostly beyond the book
The book's chapter summary encourages you to explore its references: theoretical papers "help us reason about what can and cannot be done, and help us find the counter-intuitive ways in which distributed systems are often flawed" (p. 365). The reading method, checklist and tool descriptions below are **supplementary material, not from the book**. They're there so you can keep learning after Part II.
:::

:::problem The words are the same, the meanings aren't
Database marketing and documentation say "strong consistency", "ACID", "highly available", "exactly once". By now you know each phrase can mean several precise things, or nothing at all. The book itself warns that "strong consistency" is used for linearizability (p. 314), that ACID's isolation varies between implementations (Chapter 7), and that CAP's availability "does not match its usual meaning" (p. 328). Reading carefully is a skill you can practice.
:::

:::intuition A five-question checklist for any paper or database doc
1. **System model.** What does it assume about timing (synchronous, partially synchronous, asynchronous) and about failures (crash-stop, crash-recovery, Byzantine)? (Chapter 8, pp. 298–299.)
2. **Which guarantee, precisely?** Linearizability? Serializability? Snapshot isolation? Causal consistency? Per key, per partition, or global? Reads too, or only writes? (Footnote iii on p. 320 is a classic gap: linearizable writes, but possibly stale reads.)
3. **Safety vs liveness.** Which properties always hold, and which only "eventually" or "if a majority is up and the network recovers"? (Chapter 8, p. 300.)
4. **What happens under faults?** A network partition, a paused leader, a clock jump, a lost disk. Does the doc say, or does it only describe the happy path? (Chapter 8's catalogue.)
5. **What does it cost?** Latency (Attiya–Welch, p. 329), availability during partitions (p. 327), operations (2PC coordinators, p. 354), and abort rates (SSI, p. 257).
:::

:::details Jepsen, checkers and where to go next (supplementary)
**Jepsen** (Kyle Kingsbury, who is also quoted at the start of Chapter 8) tests real databases by running concurrent clients while injecting faults: network partitions, clock changes, process pauses and crashes. It records every operation's invocation and completion as a **history**, and then **checks** the history against the claimed model, linearizability or a transaction isolation level. That's exactly the structure of Lab 31 (linearizability checker), Lab 30 (safety checker on a recorded history) and Lab 35 (fuzzing plus a property check), at much larger scale and with far more sophisticated checkers. Jepsen's published analyses are excellent case studies. Each one is essentially a worked example of this checklist. (Check jepsen.io for current reports. Their findings concern specific versions and change as vendors fix bugs.)

**Reading a classic paper.** Start with the abstract and conclusion. Then find the **system model** section and write it down in Chapter 8's vocabulary. Then find the **properties** and classify each as safety or liveness. Only then read the algorithm. The book names several algorithms you can now approach this way: Lamport's 1978 timestamps paper (p. 336), Viewstamped Replication, Paxos, Raft and Zab (p. 356), FLP (p. 344), and Spanner (p. 286). The **Raft** paper was written explicitly to be understandable, which makes it a good first full consensus paper.

**Common traps:**
- "Strongly consistent" with no definition.
- "Exactly once" that's really "at least once plus deduplication", which is fine if the doc says so (Chapter 11 returns to this).
- "Serializable" that's really snapshot isolation (Oracle calls its snapshot isolation "serializable", p. 233).
- Linearizable writes with stale reads by default.
- Failover described as "automatic" with no mention of how split brain is prevented.
:::

:::quiz
### mcq
A database doc says: "Writes are strongly consistent; reads are served by the nearest replica for low latency." What should you conclude?
- [ ] Reads are linearizable
- [x] Writes may be linearizable, but reads can be stale; you need to find out whether a linearizable read option exists (like etcd's quorum read or ZooKeeper's sync)
- [ ] The database is serializable
- [ ] Nothing can be concluded
>>>
It's the same pattern as footnote iii, p. 320.

### mcq
A paper proves an algorithm correct "in the asynchronous model with crash-stop failures". What should you check before using it in your datacenter?
- [ ] Nothing, because a proof is a proof
- [x] Whether its assumptions match reality: crash-stop means crashed nodes never return, but your nodes restart (crash-recovery) and may lose disks; and whether its liveness claims rely on assumptions like eventual synchrony
- [ ] Whether it uses Java
- [ ] Whether it's on GitHub
>>>
Mapping system models to the real world is where implementations break (Chapter 8, pp. 301–302).

### tradeoff
Why are recorded-history checkers (as in Jepsen and Labs 30, 31 and 35) so effective at finding bugs?
- [x] They judge only what clients observed against a precise model, independently of the implementation, so they catch violations no matter which internal mechanism caused them, especially when combined with fault injection
- [ ] They read the source code
- [ ] They prove the absence of bugs
- [ ] They only work on toy systems
>>>
They test the guarantee, not the implementation, but they can only show that bugs exist, never that there are none.

### explain
Apply the five-question checklist to a system from this course (for example, Dynamo-style quorums with LWW). Answer each question in a sentence.
>>>
(1) System model: asynchronous network with variable delays, crash-recovery nodes, no Byzantine faults, and time-of-day clocks with skew. (2) Guarantee: per-key eventual consistency (convergence). Not linearizable, since LWW plus clock skew and even strict quorums break it (pp. 324–325). Any "strong consistency" claim needs scrutiny. (3) Safety vs liveness: convergence is a liveness property. Its safety guarantees are weak, because LWW can silently drop acknowledged concurrent writes. (4) Under faults: it stays available with sloppy quorums and hinted handoff. A partition creates divergent replicas that converge later, with lost writes under LWW (Chapter 5). (5) Cost: low latency and high availability, paid for with application complexity (conflicts, lost updates) and no linearizable cas.
:::

:::connect Where this goes next
Tomorrow: the Part II exam, covering Chapters 5–9. Then Part III: derived data, batch processing and streams.
:::
