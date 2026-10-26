---
title: Leaderless Replication and Quorums
kind: lesson
minutes: 90
chapter: 5
objectives:
- Explain Dynamo-style leaderless replication and why it needs no failover
- Explain how version numbers let reads detect stale replicas
- Explain read repair and anti-entropy and their durability implications
- Explain quorum reads and writes, the w + r > n condition, and how many failures a configuration tolerates
reading:
- Leaderless replication | 171
- Writing to the database when a node is down; read repair and anti-entropy | 171-173
- Quorums for reading and writing | 173-175
complete:
- You can say how many unavailable nodes n=5, w=3, r=3 tolerates, and why
- You used the quorum simulator to produce and then repair a stale replica
- You answered the quiz
---

:::problem What if nobody is in charge?
Leaders impose an order on writes, but they're also a special node whose failure needs failover — with all its dangers. Some of the earliest replicated systems were **leaderless**; the idea came back into fashion with Amazon's in-house **Dynamo** system, which inspired the open-source **Riak, Cassandra and Voldemort** ("Dynamo-style"). (Confusingly, AWS's DynamoDB product uses a different, single-leader architecture.)

In leaderless replication, **any replica accepts writes**. The client sends writes to several replicas — directly, or via a coordinator that, unlike a leader, does not impose an order on writes. That has profound consequences.
:::

:::intuition Write to many, read from many
Three replicas, one being rebooted (Figure 5-10). The client sends its write to **all three in parallel**; two accept it, one misses it. If **two out of three** acknowledgements are enough, the write succeeds — no failover needed.

When the third replica comes back, it holds a stale value. So **reads are also sent to several replicas in parallel**; responses carry **version numbers**, and the client uses the newest.

The rule of thumb: if every successful write is on at least 2 of 3 replicas, at most 1 is stale; reading from 2 guarantees at least one is up to date. Generally, with **n** replicas, writes confirmed by **w** nodes, and reads querying **r** nodes:

> **w + r > n** → the set of nodes written and the set read must overlap, so at least one of the r replicas has the latest value (Figure 5-11).

Think of w and r as the minimum number of **votes** needed for a write or read to be valid.
:::

:::visual QuorumSim | n, w, r
**Try this:**
1. n=3, w=2, r=2. Take replica 3 down, write, bring it back. Read with "first r replicas": replica 3 might be among them — the version number exposes it as stale, and **read repair** fixes it.
2. Untick read repair, switch to **random** r replicas, and read a few times; then press **Run anti-entropy**.
3. Set w=1, r=1 (w + r ≤ n) and repeat: reads can now return stale data even with all nodes up.
4. Set n=5, w=3, r=3 and take two replicas down: everything still works. Take a third down.
5. Set w=n=3 and take one replica down: writes fail.
:::

:::details Catching up, and choosing n, w, r (pp. 172–175)
**How does a returning node catch up?** Two mechanisms in Dynamo-style stores:
- **Read repair** — when a read sees a stale response, the client writes the newer value back to that replica. Works well for values that are read frequently.
- **Anti-entropy** — a background process constantly looks for differences between replicas and copies missing data. Unlike a replication log, it copies writes in **no particular order**, possibly with significant delay.

Not all systems do both (Voldemort, then, had no anti-entropy). Without anti-entropy, **rarely read values** may be missing from some replicas — reduced durability, because read repair only happens on reads.

**Configuring quorums.** n, w and r are usually configurable. Common: n odd (3 or 5), w = r = (n + 1) / 2 rounded up. But you can tune: few writes and many reads → w = n, r = 1: fast reads, but one failed node makes all writes fail. (There may be more nodes in the cluster than n; any given value is stored on n of them — that's partitioning, Chapter 6.)

With w + r > n:
- w < n → writes still work with a node unavailable;
- r < n → reads still work with a node unavailable;
- n=3, w=2, r=2 tolerates **one** unavailable node; n=5, w=3, r=3 tolerates **two**.
- Requests are normally sent to **all n** replicas in parallel; w and r say how many to **wait for**.

If fewer than w or r nodes respond, the operation returns an error. Why a node didn't respond doesn't matter — crashed, disk full, network interrupted: only success counts.
:::

:::quiz
### mcq
In a leaderless database, a replica is down while a write happens. How is the write handled?
- [ ] A failover promotes another replica
- [x] The client sends the write to all replicas; it succeeds if at least w replicas acknowledge, and the down replica simply misses it
- [ ] All writes are blocked until the replica returns
- [ ] The write is queued at the coordinator until all replicas are up
>>>
"Failover does not exist" in a leaderless configuration (p. 171).

### predict
n = 5, w = 3, r = 3. Two replicas are down. Can you still read and write? What about three down?
- [x] Two down: yes, both (3 remain ≥ w and ≥ r). Three down: no, both fail
- [ ] Two down: only reads work
- [ ] Two down: neither works
- [ ] Three down: reads still work
>>>
With two down, three replicas remain — enough for both w = 3 and r = 3. With three down, only two respond, fewer than w or r, so both operations return errors (p. 174, Figure 5-11).

### mcq
What does read repair do?
- [ ] Repairs corrupted disks
- [x] When a read sees a stale value on some replica, the client writes the newer value back to it
- [ ] Re-runs failed writes
- [ ] Merges conflicting siblings
>>>
p. 172. It only helps values that get read; anti-entropy covers the rest.

### tradeoff
A product catalogue is written rarely and read constantly. Someone proposes n = 3, w = 3, r = 1. What's the trade-off?
- [x] Reads are fast (any single replica is up to date), but if any one replica is down, all writes fail
- [ ] Reads may be stale
- [ ] It tolerates two failed nodes for writes
- [ ] It's the same as w = r = 2
>>>
The book's example (p. 173): w = n, r = 1 makes reads faster at the cost of write availability.

### mcq
Why might rarely read values have reduced durability in a system that uses only read repair?
- [ ] They're stored on fewer disks by design
- [x] Read repair only fixes stale replicas when a value is read, so a rarely read value may stay missing on some replicas for a long time
- [ ] They expire automatically
- [ ] Anti-entropy deletes them
>>>
Read repair is triggered by reads. A value that is almost never read may never be repaired on the replicas that missed it, so fewer copies exist than intended — that's why anti-entropy processes matter (p. 173).

### explain
Explain, using a small drawing in words, why w + r > n guarantees that a read sees the latest successful write (ignoring edge cases).
>>>
A successful write is stored on at least w of the n replicas. A read asks at least r replicas. If w + r > n, the two sets can't be disjoint: there aren't enough replicas for the r read replicas to avoid all w written ones (pigeonhole principle). E.g. n = 5, w = 3: replicas {1,2,3} have the write; a read of r = 3 must include at least one of 1, 2, 3 because only two (4, 5) are outside. The read takes the response with the highest version number, which is the latest write.
:::

:::connect Where this goes next
Tomorrow: the edge cases that break the w + r > n promise, sloppy quorums, and how stale reads really are — you'll measure it. Quorums return in Chapter 9 when we ask whether they give linearizability (they don't, quite).
:::
