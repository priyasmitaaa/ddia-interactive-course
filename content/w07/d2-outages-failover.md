---
title: New Followers, Node Outages, and the Perils of Failover
kind: lesson
minutes: 85
chapter: 5
objectives:
- Describe how to set up a new follower without downtime (snapshot + log position)
- Explain follower catch-up recovery
- Describe the steps of automatic failover
- Explain four ways failover goes wrong (lost writes, external inconsistency, split brain, timeouts)
reading:
- Setting up new followers | 149-150
- Handling node outages — catch-up recovery and failover | 150-152
complete:
- You reproduced lost writes and the primary-key reuse problem in the simulator
- You can explain split brain and STONITH
- You answered the quiz
---

:::problem Machines are always being replaced
Nodes go down unexpectedly (faults) and just as often on purpose (rebooting to install a kernel security patch). Being able to reboot individual nodes **without downtime** is a huge operational advantage (p. 150). So we need answers to three questions: how do you add a new replica while writes keep flowing? How does a follower that was down catch up? And what do you do when the *leader* dies?
:::

:::intuition Snapshots and positions
**New follower** (pp. 149–150). Copying data files isn't enough — they change while you copy, so you'd see different parts at different times. Locking the database for writes defeats high availability. Instead:

1. Take a **consistent snapshot** of the leader at some point in time, ideally without locking everything (also needed for backups; sometimes via tools like `innobackupex` for MySQL).
2. Copy the snapshot to the new node.
3. The follower connects to the leader and requests every change since the snapshot. That requires the snapshot to be tied to an **exact position in the replication log** — PostgreSQL's **log sequence number (LSN)**, MySQL's **binlog coordinates**.
4. Once it has processed the backlog, it has **caught up** and follows the live stream.

**Follower failure — catch-up recovery** (p. 150). Each follower keeps a log of received changes on disk. After a crash, restart or network interruption, it knows its last processed transaction, asks the leader for everything since, applies it, and continues. (You saw this in yesterday's simulator, and it's what you built in Project 1's "snapshot + log" pattern.)

**Leader failure — failover.** One follower must be promoted, clients must send writes to it, other followers must follow it. Manual or automatic. Automatic failover usually:

1. **Determines that the leader has failed** — no foolproof way; most systems use a **timeout** (e.g. no response for 30 s).
2. **Chooses a new leader** — by election among the remaining replicas or appointment by a previously elected controller; best candidate: the replica with the most up-to-date data. Getting all nodes to agree is a **consensus** problem (Chapter 9).
3. **Reconfigures the system** — clients write to the new leader; if the old leader comes back, it must step down and become a follower.
:::

:::visual FailoverSim | Things that go wrong in failover
Each insert gets an **auto-incrementing id** from the current leader, and an external cache (think GitHub's Redis) stores data under that id.

**Try this sequence:** Insert ×4 → Replicate → Insert ×2 → Crash leader → Promote → Insert ×2. Watch:
1. which acknowledged inserts the new leader doesn't have;
2. the new leader **reusing ids** the old leader already handed out — and the cache now pointing to the wrong user;
3. then try "Old leader returns still thinking it leads": two leaders accept writes (**split brain**).
:::

:::details Why failover is "fraught" (pp. 151–152)
1. **Lost writes with async replication.** The new leader may not have received all of the old leader's writes. If the old leader rejoins, what happens to them? The new leader may already have accepted conflicting writes. Most commonly they're **discarded** — violating clients' durability expectations.
2. **Discarding is especially dangerous when other systems depend on the database.** At GitHub, an out-of-date MySQL follower was promoted. Its auto-increment counter lagged, so it **reused primary keys** the old leader had assigned. Those keys were also used in Redis, so MySQL and Redis disagreed — and some private data was shown to the wrong users.
3. **Split brain.** In some fault scenarios two nodes both believe they're leader. If both accept writes without conflict resolution, data is lost or corrupted. Safety catch: shut one down if two leaders are detected — **fencing**, or emphatically **STONITH** ("Shoot The Other Node In The Head"). Done badly, both get shut down.
4. **The right timeout.** Longer → slower recovery after a real failure. Shorter → unnecessary failovers: a load spike or a network glitch makes a healthy leader look dead, and failing over while already overloaded makes things worse.

No easy solutions — so some teams prefer **manual** failover even when automatic is supported. These issues — node failures, unreliable networks, trade-offs between consistency, durability, availability and latency — are the fundamental problems of distributed systems, studied in Chapters 8 and 9.
:::

:::quiz
### mcq
To set up a new follower without downtime, what must the leader's snapshot be associated with?
- [ ] The current wall-clock time
- [x] An exact position in the leader's replication log (e.g. PostgreSQL's LSN or MySQL's binlog coordinates)
- [ ] The number of rows in each table
- [ ] A lock on the whole database
>>>
The follower then requests every change after that position, so nothing is missed or applied twice (p. 149).

### predict
In the simulator, the old leader assigned id 5 to "erin" before crashing; the promoted follower only had ids 1–4. After failover, a new user "gina" is inserted. What id does she get, and why is that a problem if a cache stores data by id?
- [ ] Id 7; no problem
- [x] Id 5 — the new leader's counter lags, so it reuses an id that the cache already associates with erin
- [ ] Id 1
- [ ] The insert fails
>>>
That's the GitHub incident (p. 151): reused primary keys made MySQL and Redis inconsistent and exposed private data to the wrong users.

### mcq
What is "split brain"?
- [ ] A follower that's split across two disks
- [ ] A partitioned database
- [x] Two nodes both believing they are the leader and accepting writes
- [ ] A leader that applies writes in two different orders
>>>
Without conflict resolution, writes on both sides are likely to be lost or corrupted (p. 151). Chapter 8's fencing tokens are a principled defence.

### tradeoff
Your failure-detection timeout is 2 seconds. During a traffic spike the leader's response time rises to 3 seconds. What happens, and what's the trade-off?
- [x] An unnecessary failover is triggered on an overloaded system, likely making things worse; a longer timeout avoids that but means slower recovery from real failures
- [ ] Nothing — timeouts only apply to crashed nodes
- [ ] The leader speeds up
- [ ] Clients switch to synchronous replication
>>>
The book: too short → unnecessary failovers, especially harmful under load or network problems; too long → longer time to recovery (pp. 151–152).

### explain
Why do some operations teams prefer manual failover even when the database supports automatic failover?
>>>
Because every automatic decision can go wrong: the failure detector can't distinguish a dead leader from a slow one or a network glitch, so it may fail over unnecessarily under load; promoting an async follower can discard acknowledged writes and cause inconsistency with external systems (reused IDs); and in some faults two nodes may both act as leader (split brain). A human can look at the wider situation, check what would be lost, and make sure the old leader is really stopped — trading recovery time for fewer disasters.

### scenario
A follower was offline for 3 hours for maintenance. Describe precisely how it catches up, and what information makes this possible.
>>>
On restart, the follower reads its own local log to find the last change it applied (its position in the replication log). It connects to the leader and requests all data changes after that position. It applies the backlog in order until it reaches the leader's current position — it has caught up — and then keeps applying the live stream. This works because the replication log is an ordered sequence with positions (LSNs), and the leader retains the log long enough (if it doesn't, the follower would need a fresh snapshot).
:::

:::connect Where this goes next
Notice that "choosing a new leader that everyone agrees on" and "making sure the old leader really stops" are exactly the problems Chapter 9 solves with consensus and Chapter 8 with fencing tokens. Tomorrow: what exactly is in the replication log?
:::
