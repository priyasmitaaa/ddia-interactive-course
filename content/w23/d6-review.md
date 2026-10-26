---
title: Review — Capstone Week 1 Checkpoint
kind: review
minutes: 60
objectives:
- Consolidate milestones M1–M4
- Explain MiniKV's single-partition guarantees precisely
- Catch up on any failing tests
reading:
- Re-read the Chapter 5 summary | 186-187
complete:
- You did today's spaced review
- M1–M4 tests all pass
- DESIGN.md has storage, replication and failover sections
---

:::review Today's spaced review
Scheduled questions from Weeks 1–23.
:::

:::task Trace one write end to end
Without looking at the code, write down every step of `ReplicaSet.write("k", "v", semi_sync=True)`, from the client call to the acknowledgment. Name which file and function handles each step, what is fsynced and when, and what each node's log and store contain afterwards. Then trace what happens if the leader is isolated right after the acknowledgment, a new leader is elected, and the old leader recovers. Check your trace by stepping through the M4 tests in a debugger, or by adding prints.
:::

:::quiz Capstone week 1
### mcq
Which component makes an acknowledged write durable on a single node?
- [ ] The memtable
- [x] The fsynced WAL record
- [ ] The sparse index
- [ ] The replication log in memory
>>>
The memtable is lost on a crash. The WAL is replayed on restart (M2).

### mcq
After an async failover, a client's acknowledged write is missing. Which design change would have prevented it?
- [ ] More SSTables
- [x] Acknowledging only after the write is replicated (semi-sync, or a majority quorum)
- [ ] A larger memtable
- [ ] A longer election timeout
>>>
Chapter 5's lost-writes pitfall, reproduced in the M4 tests.

### explain
In two or three sentences, state MiniKV's guarantees for a single partition, as you would in DESIGN.md.
>>>
A strong answer covers each mode. "An acknowledged write survives a crash of the node that acknowledged it (fsynced WAL). With semi-sync it also survives the loss of the leader; with async it may be lost on failover. Replicas apply the same entries in the same order. After an election, entries from a deposed leader's epoch are rejected (fencing), and its unreplicated writes are discarded on recovery. Follower reads may be stale, and even leader reads aren't linearizable during a partition, since a zombie leader can serve stale reads."
:::
