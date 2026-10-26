---
title: Limits of Quorums, Sloppy Quorums and Hinted Handoff
kind: lesson
minutes: 90
chapter: 5
objectives:
- Explain the trade-off of choosing w + r ≤ n
- List the edge cases where stale reads happen despite w + r > n
- Explain why staleness is hard to monitor in leaderless systems
- Explain sloppy quorums and hinted handoff, and why a sloppy quorum isn't really a quorum
- Describe multi-datacenter leaderless operation
reading:
- Limitations of quorum consistency; monitoring staleness | 175-177
- Sloppy quorums and hinted handoff; multi-datacenter operation | 177-178
complete:
- You measured stale-read probabilities in the staleness exercise
- You produced a stale read with w + r > n using a sloppy quorum in the simulator
- You answered the quiz
---

:::problem "Quorum" sounds like a guarantee. Is it?
Yesterday: with w + r > n, reads see the latest write. Today the book adds the fine print: in practice there are many edge cases where that's not true; Dynamo-style databases are optimised for applications that **tolerate eventual consistency**, and w and r adjust the *probability* of stale reads rather than giving absolute guarantees (p. 176).
:::

:::intuition Dial, not switch
You can choose w + r ≤ n deliberately (p. 175): reads and writes are still sent to n nodes, but fewer successful responses are needed. **More stale reads** (the read may miss the node with the latest value) in exchange for **lower latency and higher availability** — you can keep working through larger network interruptions; only when reachable replicas drop below w or r does the database become unavailable.

Your exercise today puts numbers on this dial.
:::

:::practice 20-quorum-staleness | Measure "eventual"
A Monte-Carlo model of a write followed by a read. You'll see stale-read probability by (n, w, r), how fast it decays with time after the write, and the availability you buy with smaller w.
:::

:::details Edge cases, monitoring, and sloppy quorums (pp. 175–178)
### Stale reads even with w + r > n
- **Sloppy quorum** (below): the w writes may land on different nodes than the r reads, so there's no guaranteed overlap.
- **Concurrent writes**: it's unclear which happened first; the only safe option is merging. If a winner is picked by timestamp (LWW), writes can be lost due to clock skew.
- **A write concurrent with a read**: the write may be reflected on only some replicas; whether the read sees it is undetermined.
- **Partially failed writes**: a write that succeeded on some replicas but on fewer than w overall is **not rolled back** where it succeeded — so a write reported as failed may or may not show up in later reads.
- **A node with the new value fails and is restored from a replica with an old value**: the number of replicas with the new value can drop below w.
- **Unlucky timing** even when everything works (Chapter 9, "Linearizability and quorums").

So you usually **don't** get read-your-writes, monotonic reads or consistent prefix reads in Dynamo-style stores. Stronger guarantees generally need transactions or consensus.

### Monitoring staleness (p. 176)
Even if staleness is tolerable, you need to know how replication is doing. In leader-based replication, lag is measurable: subtract a follower's log position from the leader's. In leaderless systems there's **no fixed order of writes**, so that's harder; with read repair only, a rarely read value can be arbitrarily old. Research exists on predicting stale-read percentages from n, w, r (that's essentially your exercise), but it isn't common practice. "Eventual consistency is a deliberately vague guarantee, but for operability it's important to be able to quantify 'eventual'."

### Sloppy quorums and hinted handoff (pp. 177–178)
Quorums tolerate failed and slow nodes without failover — appealing for high availability and low latency. But a network interruption can cut a *client* off from many nodes, which then might as well be dead to it. In a large cluster (many more than n nodes), the client can probably reach *some* nodes, just not the n "home" nodes for this value. Choice:

- return errors for every request that can't reach w or r home nodes, or
- **accept writes anyway** on reachable nodes that aren't among the n home nodes: a **sloppy quorum** — w and r successful responses still required, but they may come from non-home nodes. (Locked out of your house? Sleep on the neighbour's couch.)

When the interruption is fixed, the stand-in nodes send those writes to the home nodes: **hinted handoff**. (Found your keys? The neighbour politely asks you to go home.)

Sloppy quorums increase **write availability**: as long as any w nodes are reachable, writes succeed. But even with w + r > n you can't be sure to read the latest value — it may be sitting on stand-ins outside the n. So "a sloppy quorum actually isn't a quorum at all in the traditional sense" — only an assurance of **durability** (stored on w nodes *somewhere*). Optional in all common Dynamo implementations: enabled by default in Riak, disabled by default in Cassandra and Voldemort.

### Multi-datacenter operation (p. 178)
Leaderless replication suits multiple datacenters, tolerating concurrent writes, interruptions and latency spikes. Cassandra and Voldemort count replicas in all datacenters in n (you choose how many per datacenter); each write goes to all replicas, but the client usually waits only for a quorum in its **local** datacenter, with cross-datacenter writes often asynchronous. Riak keeps client communication within one datacenter (n is per datacenter) and replicates between clusters asynchronously in the background, similar to multi-leader.
:::

:::visual QuorumSim | Sloppy quorums
**Try this:** n=3, w=2, r=2. Tick **sloppy quorum**. Take replicas 2 and 3 down and write: stand-ins accept it with hints. Now bring replicas 2 and 3 back *and* take replica 1 down, then read from home replicas: stale, despite w + r > n. Finally press **Hinted handoff** and read again.
:::

:::quiz
### mcq
Which of these can cause a stale read even with w + r > n?
- [ ] Using an odd n
- [x] A sloppy quorum that stored the write on stand-in nodes outside the n home replicas
- [ ] Setting r = w
- [ ] Reading from all n replicas
>>>
One of the book's edge cases (p. 175); you reproduced it in the simulator.

### predict
A write is sent to 3 replicas with w = 2, but only 1 succeeds (two disks are full). The client is told the write failed. A later read with r = 2 happens to include the replica that accepted it. What might the read return?
- [ ] Definitely the old value
- [x] Possibly the "failed" write's value — it was not rolled back on the replica where it succeeded
- [ ] An error
- [ ] Both values merged
>>>
"If a write was reported as failed, subsequent reads may or may not return the value from that write" (p. 175).

### mcq
Why is replication lag harder to monitor in leaderless systems than in leader-based ones?
- [ ] Leaderless systems have no metrics
- [x] There is no single ordered log, so you can't simply subtract positions; and with read repair only, rarely read values can be arbitrarily stale
- [ ] Leaderless systems are always up to date
- [ ] Monitoring would require a leader
>>>
In a leader-based system, lag = leader's log position minus the follower's. Leaderless replicas apply writes in no fixed order, so there's no single position to compare — and without anti-entropy, a value nobody reads can stay stale indefinitely (p. 176).

### mcq
What is hinted handoff?
- [ ] Handing the leader role to another node
- [x] After a network interruption is fixed, stand-in nodes that accepted writes on behalf of unreachable home nodes forward those writes to the home nodes
- [ ] A client giving hints about which replica to read
- [ ] Moving a partition to a new node
>>>
The stand-in ("neighbour's couch") held the write temporarily during a sloppy quorum; handoff delivers it to its proper home replicas once they're reachable again (p. 177).

### tradeoff
Riak enables sloppy quorums by default; Cassandra disables them by default. What are you trading when you enable them?
- [x] Higher write availability during network problems, in exchange for losing the guarantee that w + r > n reads see the latest write (until handoff completes)
- [ ] Lower durability for higher consistency
- [ ] Faster reads for slower writes
- [ ] Nothing; they're strictly better
>>>
A sloppy quorum is really only a durability assurance (pp. 177–178).

### explain
Using your exercise results, explain what "quantifying eventual" means and why it matters operationally.
>>>
Instead of the vague promise "replicas converge eventually", you measure concrete numbers: e.g. with n = 3, w = r = 1 and ~10 ms network delays, about 25% of reads made immediately after a write are stale, ~3% after 20 ms, and well under 1% after 40 ms; with w + r > n, ~0% (in the simple model). Operationally this tells you whether staleness matters for a given feature, lets you pick n, w, r deliberately, and lets you alert when staleness grows (e.g. a slow node or network problem), as the book recommends (p. 176).
:::

:::connect Where this goes next
Concurrent writes were on today's list of quorum edge cases. Tomorrow: how a database can tell *concurrent* writes from *sequential* ones — without trusting clocks — and keep both instead of silently dropping one.
:::
