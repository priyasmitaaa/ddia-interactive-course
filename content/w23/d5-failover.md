---
title: Milestone 4 — Failover, Epochs and Fencing
kind: project
minutes: 110
objectives:
- Implement majority-gated elections that pick the most up-to-date replica and increment the epoch
- Implement fencing by sender epoch, and recovery that discards divergent entries
- Demonstrate lost async writes and a fenced zombie leader in tests
reading:
- Re-read handling node outages (failover pitfalls) | 150-152
- Re-read the leader and the lock; fencing tokens | 293-295
- Re-read epoch numbering and quorums | 358-359
complete:
- All M4_Failover tests pass
- You wrote the failover section of DESIGN.md, including what MiniKV does not guarantee
- You answered the quiz
---

:::problem Is the leader dead, or just slow?
Chapter 5 lists the failover pitfalls: lost async writes, split brain, and choosing the timeout. Chapter 8 explains why you can never be sure a node is dead. Chapter 9 gives the fix: **epochs and quorums**. Milestone 4 implements a simplified version and puts each pitfall into a test.
:::

:::intuition Elect, fence, recover
- **`elect()`**: only if a **strict majority** of nodes is reachable (otherwise refuse, since a minority must never elect). Pick the reachable node with the **highest `last_seq`**, the most up to date, increment the **epoch**, and make it the only reachable node that believes it leads. Every reachable node learns the new epoch. Isolated nodes learn nothing, which is the point.
- **Fencing**: `Node.apply(e, sender_epoch)` rejects anything sent by a leader whose epoch is **older** than the receiver's (`StaleEpoch`). Note that it checks the *sender's* epoch, not the entry's. A new leader may legitimately ship entries **written** in epoch 1 to a lagging follower. That's the same idea as fencing tokens (Chapter 8) and Raft terms (Chapter 9).
- **The zombie**: an **isolated** old leader still believes it leads. MiniKV lets it accept and acknowledge writes, because that's what real systems do if a leader can't tell it's been cut off. When it reconnects, its attempt to replicate is fenced. Then **`recover()`** finds the longest common prefix of its log and the new leader's log, **discards the rest** (its zombie writes), rebuilds its store from the surviving log, and catches up.
- **Lost writes**: with async replication, a write acknowledged by the old leader but never replicated is **gone** after failover. The test proves it. Semi-sync, or a quorum commit as in Raft, closes that gap.

**DESIGN.md, failover section**: write down honestly what MiniKV guarantees and what it doesn't. For example: no split-brain writes are *replicated*, but a zombie can *acknowledge* writes that are later discarded; async writes can be lost; `elect()` is a stand-in for consensus (in production, use Raft or a coordination service).
:::

:::practice 45-capstone-minikv | M4 — failover
Implement `ReplicaSet.elect` and `ReplicaSet.recover` (and the epoch check in `Node.apply` if you haven't yet). Run `test_minikv.py M4_Failover`.
:::

:::quiz
### mcq
Why does `elect()` refuse to run without a majority of reachable nodes?
- [ ] To save CPU
- [x] Two minorities could otherwise each elect a leader; requiring a majority guarantees that any two elections overlap in at least one node
- [ ] Because followers can't vote
- [ ] Because the epoch would overflow
>>>
That's the quorum argument of Chapters 8 and 9 (pp. 292–293, 358).

### predict
A new leader (epoch 2) ships entry seq 5, written in epoch 1, to a follower that already knows epoch 2. Should the follower accept it?
- [x] Yes: the sender's epoch (2) isn't older than the follower's; entries from earlier epochs are legitimately replicated by the current leader
- [ ] No, the entry's epoch is 1, which is stale
- [ ] Only after a new election
- [ ] Only if the old leader confirms
>>>
Fence on the sender's authority, not the entry's history. That's the bug the M4 test catches if you get it wrong.

### mcq
What happens to writes that a zombie leader acknowledged while isolated?
- [ ] They're merged into the new leader's log
- [x] They're rejected when it tries to replicate (stale epoch) and discarded when it recovers; clients that got "ok" have lost their write
- [ ] They win, because they're newer
- [ ] They're kept on the zombie only
>>>
That's why real systems require a quorum to acknowledge a write, so a leader that can't reach a majority can't commit (Chapter 9).

### explain
How would you change MiniKV so that a zombie leader could never acknowledge a write that is later lost?
>>>
Make a write "committed", and acknowledge it, only after a majority of replicas has durably appended it, as in Raft and other consensus protocols (Chapter 9). An isolated leader can't reach a majority, so its writes never commit and clients get a timeout or error, not "ok". Combined with epoch fencing and an election that only picks a node holding all committed entries (Raft's up-to-date log rule, Lab 35), this guarantees committed writes survive failover. Semi-sync to one follower is a weaker version: it survives a single crash, but a partition can still leave the isolated leader acknowledging writes if its "one follower" is on the same side.
:::

:::connect Tomorrow
Review the week, make sure M1–M4 are solid, and finish the first half of DESIGN.md.
:::
