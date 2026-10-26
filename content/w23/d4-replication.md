---
title: Milestone 3 — Leader-Based Replication
kind: project
minutes: 100
objectives:
- Implement a sequence-numbered replication log, and followers that apply entries strictly in order
- Implement async and semi-synchronous writes, and observe replication lag
- Explain what each choice guarantees about durability when the leader fails
reading:
- Re-read leaders and followers; synchronous vs asynchronous replication | 146-149
- Re-read implementation of replication logs | 152-155
complete:
- All M3_Replication tests pass
- You wrote the replication section of DESIGN.md
- You answered the quiz
---

:::problem One copy isn't enough
A single node, however careful, can die. Milestone 3 gives each partition **three replicas**: one **leader** accepts writes, and two **followers** copy them. This is Chapter 5's single-leader replication with a logical (row-based) log: each entry carries the key and new value, not disk pages.
:::

:::intuition A log of numbered entries
- **The leader** assigns each write the next **sequence number**, appends an `Entry(seq, epoch, key, value)` to its log, applies it to its own `LSMStore`, and acknowledges.
- **Followers** pull every entry with `seq > last_seq` from the leader and `apply` them **in order**. `apply` rejects a gap (`seq` must be `last_seq + 1`), because applying out of order could produce a state the leader never had. The sequence number is exactly the "log sequence number" a follower uses to resume after a disconnection (Chapter 5).
- **Async writes** (the default) are acknowledged before any follower has them. That's fast, and followers lag. A read from a follower right after a write returns the old value, which is replication lag.
- **Semi-sync writes** wait until **one** follower has applied the entry. If the leader then dies, at least one surviving node has the write, which costs one follower round trip per write (Chapter 5's semi-synchronous configuration).

`Node.apply` also takes a `sender_epoch`. You'll use it tomorrow for fencing. Today, just apply entries from the current leader.

**DESIGN.md, replication section**: when is a write acknowledged in each mode? What can a follower read return? What does a client lose if the leader dies 1 ms after acknowledging an async write?
:::

:::practice 45-capstone-minikv | M3 — replication
Implement `Node.apply` (ordering checks; you can already add the epoch check described in its docstring) and `ReplicaSet.write`. Run `test_minikv.py M3_Replication`.
:::

:::quiz
### mcq
Why must a follower reject an entry whose seq isn't last_seq + 1?
- [ ] For performance
- [x] Applying out of order, or with a gap, could produce a state that never existed on the leader; the log's order is what keeps replicas identical
- [ ] Because sequence numbers are random
- [ ] Because followers can't store gaps
>>>
Same operations, same order, same state: state machine replication (Chapters 5 and 9).

### predict
With async replication, a client writes x=1 and immediately reads x from a follower. What does it see?
- [ ] Always 1
- [x] Possibly the old value (or nothing): the follower may not have pulled the entry yet
- [ ] An error
- [ ] A conflict
>>>
Replication lag. Read-your-writes would require reading from the leader (Chapter 5).

### tradeoff
Async vs semi-sync replication in MiniKV: what's the trade-off?
- [x] Async gives the lowest write latency but can lose acknowledged writes if the leader dies; semi-sync guarantees the write survives a single leader failure at the cost of a follower round trip per write
- [ ] Semi-sync is always faster
- [ ] Async never loses writes
- [ ] They're identical
>>>
That's Chapter 5's durability trade-off, which you'll demonstrate concretely in M4.

### explain
Why is MiniKV's replication log "logical" rather than physical (WAL shipping), and what does that buy?
>>>
Each entry records the key and new value (or a delete), not bytes of a disk page. So followers can use a different storage layout, compaction state or even engine version than the leader. That makes rolling upgrades and heterogeneous replicas possible, and the log is easy for external consumers to parse, which is exactly what MiniKV's change stream will do in M6 (Chapter 5's logical log replication and its link to CDC). Physical WAL shipping ties replicas to the same storage format and version.
:::

:::connect Tomorrow
Milestone 4: the leader dies, or worse, only *seems* to die. Elections, epochs, fencing and lost writes.
:::
