---
title: Capstone Assessment — Defend Your Design
kind: assessment
minutes: 100
objectives:
- Explain and defend MiniKV's design choices with the book's concepts
- Predict MiniKV's behavior in failure scenarios you haven't tested
- Identify the most valuable next improvements
complete:
- All MiniKV tests and your fuzzer pass
- You answered every question aloud or in writing, citing chapters
- You chose one improvement and wrote a one-paragraph plan for it
---

:::note How to do this assessment
Imagine a design review. A senior engineer has read your DESIGN.md and asks the questions below. Answer each in writing, or record yourself answering aloud, then compare with the model answers. If you can, do it with a friend who has also read the book. The aim isn't to have built a perfect system. It's to know exactly what you built.
:::

:::quiz Capstone review
### scenario
"A node's disk returns a corrupted block in the middle of an SSTable. What does MiniKV do, and what should it do?"
>>>
Today, `decode_stream` stops at the first checksum mismatch, so a corrupted block silently truncates what that SSTable returns. Keys after the corruption look missing, and a read may fall through to an older SSTable and return a stale value. That's a silent integrity violation. It should detect the corruption explicitly, raising and flagging the file rather than treating it as end-of-data (only the WAL's tail is allowed to be torn), mark the node unhealthy, and re-replicate the partition from a healthy replica (Chapter 5's "setting up new followers": snapshot plus log). This is the "trust, but verify" and weak-lying defense of checksums (Chapter 8) combined with replication for repair.

### scenario
"Two clients write the same key through the same leader at the same time. What value wins, and is that what users expect?"
>>>
The leader serializes writes: each gets the next sequence number in the order the leader processes them, so the later one in log order wins on every replica, and all replicas agree (Chapter 5). There are no lost-update protections: if both clients did read-modify-write, one increment could be lost (Chapter 7). Users who need atomic read-modify-write need a compare-and-set operation. That's easy on a single leader per partition (check the current value before appending), and it's linearizable only if the leader is the true leader of the current epoch (Chapter 9).

### mcq
"Why didn't you use hash(key) % number_of_groups?"
- [ ] It's slower
- [x] Adding a group would change the owner of most keys; with a fixed number of partitions and an assignment map, only whole partitions move to the new group
- [ ] It can't handle strings
- [ ] It requires consensus
>>>
That's Chapter 6's rebalancing argument, measured in the M5 tests.

### scenario
"Your election picks the node with the highest last_seq. Is that always safe?"
>>>
Within MiniKV's model it picks a node that has every entry any reachable node has, so no reachable replica loses data it already holds. But it isn't a real consensus protocol. Two concurrent `elect()` calls in a distributed implementation could both increment the epoch and pick different leaders. "Highest last_seq" also compares only sequence numbers, not epochs, so a node with a long log of entries from an old, deposed leader's epoch could beat a node with the current epoch's committed entries. Raft compares the last entry's term first, then length (Lab 35), and requires votes from a majority, each node voting once per term (Chapter 9). A production MiniKV would delegate elections to Raft or to a coordination service issuing epochs.

### design
"Pick the one improvement that most increases MiniKV's correctness, and outline how you'd build it."
>>>
A strong choice is majority-commit replication. A write is acknowledged only once a majority of the partition's replicas have appended it, and the leader tracks a commit index. Change-stream consumers read only up to the commit index. Elections follow Raft's rules: vote once per term, and only for candidates whose log is at least as up to date, last term first. This removes lost acknowledged writes (async), zombie-acknowledged writes, and phantoms in derived data in one design. It costs a majority round trip per write and unavailability on the minority side of a partition, the trade-offs of Chapter 9, which you'd document in DESIGN.md. You'd verify it with the fuzzer plus the linearizability checker on leader reads that confirm leadership with a quorum.
:::

:::connect Tomorrow
The final review. How to keep this knowledge alive, and where to go next.
:::
