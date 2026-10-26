---
title: Testing MiniKV — Properties, Faults and Histories
kind: project
minutes: 100
objectives:
- Write MiniKV's safety and liveness properties
- Build a randomized fault-injection test (crashes, partitions, failovers) with a reference model
- Check recorded single-key histories with your linearizability checker, and interpret the results
reading:
- Re-read correctness of an algorithm; safety and liveness | 299-301
- Re-read what makes a system linearizable | 315-319
complete:
- You wrote a fuzz test that runs 200+ random scenarios against MiniKV
- You ran your Lab 31 checker on at least one recorded history
- You answered the quiz
---

:::problem Tests that pass on a sunny day
Your milestone tests check specific scenarios. Real bugs live in **unanticipated interleavings** of crashes, partitions and elections. Chapter 8 recommends stating your system model and properties, then deliberately injecting faults. Today you test MiniKV like the fuzzers in Labs 30 and 35, and like Jepsen.
:::

:::intuition Properties, a model, and a fuzzer
**1. Write the properties.** Safety must always hold:
- *Agreement*: after replication, all reachable replicas of a partition have identical logs up to the shortest one.
- *No stale-epoch application*: no node ever appends an entry sent by a leader of an older epoch than its own.
- *Durability under semi-sync*: a semi-sync write acknowledged before a single leader failure is readable after failover.

Liveness holds only under conditions:
- *Progress*: if a majority is reachable, `elect()` succeeds and writes are accepted.
- *Convergence*: after healing and replication, all replicas have the same data.

**2. Keep a reference model.** A plain Python dict holds what a correct, single-copy store would contain *given which writes are guaranteed to survive*. For semi-sync writes, that's all of them. For async writes, the model must allow a write to be lost on failover, so record it as "maybe".

**3. Fuzz.** In a loop with a seeded RNG, randomly write (async or semi-sync), replicate, crash a node, isolate a node, elect, recover, and occasionally flush or compact a node's store. After each step, check the safety properties. At the end, heal everything, replicate, and check convergence plus the model. Shrink a failing seed by deleting steps until the failure disappears.

**4. Check a history.** Record client operations on one key as `(start, end, kind, value)` while the fuzzer runs, with leader reads and writes only, and feed them to your **Lab 31 checker**. Expect violations around zombie leaders, since a zombie can serve stale reads and acknowledge lost writes. That's not a checker bug, but evidence for the limitation in your DESIGN.md.
:::

:::practice 45-capstone-minikv | Add test_fuzz.py
Create `practice/45-capstone-minikv/test_fuzz.py` with the fuzzer described here (about 80 lines). Reuse `ReplicaSet` directly. Run at least 200 seeds. Optional: copy `linearizability.py` from Lab 31 and check recorded histories.
:::

:::quiz
### mcq
Which of these is a safety property of MiniKV?
- [ ] An election eventually succeeds
- [ ] Followers eventually catch up
- [x] No node ever applies an entry sent by a leader with an older epoch than its own
- [ ] The consumer eventually indexes every write
>>>
Safety properties can be violated at a specific moment and must always hold. The others are liveness (Chapter 8).

### mcq
Why does the reference model treat async writes as "maybe present" after a failover?
- [ ] Because async writes are always lost
- [x] Because an async write acknowledged by a leader that then failed may or may not have reached a follower; both outcomes are correct for MiniKV's stated guarantees
- [ ] Because the model is lazy
- [ ] Because tombstones are special
>>>
A test must encode the guarantees you actually claim. Otherwise it flags correct behavior as a bug.

### predict
Your linearizability checker reports a violation in a history recorded while a zombie leader served reads. Is that a MiniKV bug?
- [ ] Yes, always
- [x] Not necessarily: MiniKV doesn't claim linearizable reads during partitions (a zombie can serve stale data), so it's expected behavior; it would be a bug only if you claimed otherwise
- [ ] It means the checker is broken
- [ ] It means clocks are skewed
>>>
Leader reads aren't linearizable without confirming leadership with a quorum (Chapter 9, p. 323).

### explain
Why is a seeded random fuzzer with property checks more effective than adding more hand-written scenario tests?
>>>
Hand-written tests cover the interleavings you thought of. Bugs live in the ones you didn't think of: crash during compaction just after an election, recover a node twice, isolate the new leader right after a semi-sync write. A fuzzer explores thousands of random combinations cheaply, checks invariants after every step instead of asserting one expected outcome, and with a seed every failure is reproducible and can be shrunk to a minimal case. That's how Lab 35 found the double-vote bug that occurs only about once in 10,000 elections, and how Jepsen and deterministic simulation testing find real database bugs (Chapter 8's advice to deliberately inject faults, p. 302).
:::

:::connect Tomorrow
Measure MiniKV's performance honestly, with percentiles, and finish DESIGN.md.
:::
