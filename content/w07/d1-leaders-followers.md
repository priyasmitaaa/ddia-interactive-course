---
title: Distributing Data, and Leader-Based Replication
kind: lesson
minutes: 85
chapter: 5
objectives:
- Give the three reasons to distribute a database (scalability, fault tolerance, latency)
- Compare shared-memory, shared-disk and shared-nothing architectures
- Distinguish replication from partitioning
- Explain leader-based replication and the trade-off between synchronous and asynchronous followers
reading:
- Part II introduction — scaling, shared-nothing, replication vs partitioning | 141-143
- Chapter 5 opening; Leaders and Followers | 145-147
- Synchronous vs. asynchronous replication | 147-149
complete:
- You can draw Figure 5-2 and explain what each arrow waits for
- You used the simulator to block writes with an offline synchronous follower
- You answered the quiz
---

:::problem One machine is not enough — for three different reasons
Part I assumed one machine. Part II asks: what if several machines store and serve the data? There are three reasons you might want that (p. 141):

- **Scalability** — data, reads or writes grow beyond what one machine handles.
- **Fault tolerance / high availability** — the service must keep running if a machine, the network, or a whole datacenter goes down.
- **Latency** — users around the world should be served from a nearby datacenter.

But "just add machines" hides a lot. How do the machines share work? How do they stay consistent when the network between them is slow or broken?
:::

:::intuition Three architectures, two mechanisms
**Shared-memory** (scale up): many CPUs, RAM and disks under one operating system. Simple, but cost grows *super-linearly* (twice the size costs much more than twice as much), a machine twice as big can't necessarily handle twice the load, and it's limited to one location. (Even inside one big machine, memory is non-uniform — NUMA — so work must be partitioned anyway.)

**Shared-disk**: independent machines sharing an array of disks over a fast network (NAS/SAN). Used for some warehouses, but contention and locking overhead limit scaling.

**Shared-nothing** (scale out): each **node** has its own CPUs, RAM and disks; all coordination happens in software over an ordinary network. No special hardware; can span regions to cut latency and survive a datacenter loss. Part II focuses on it — not because it's always best (a simple single-threaded program can outperform a 100-core cluster, p. 143), but because it demands the most care from application developers.

Data is spread across nodes in two ways, usually combined (Figure II-1):

- **Replication** — the *same* data copied onto several nodes: redundancy, and more capacity for reads. (This week and next.)
- **Partitioning** (sharding) — *different* subsets of data on different nodes. (Week 9.)

This chapter assumes every node can hold the whole dataset. And replicating data that never changes is trivial: **all of the difficulty is in handling changes.**
:::

:::details Leaders, followers, sync and async
Every write must be processed by every replica. The most common solution is **leader-based replication** (active/passive, master–slave) (pp. 146–147):

1. One replica is the **leader** (master, primary). Clients send **writes** to it; it writes locally first.
2. The others are **followers** (read replicas, slaves, hot standbys). The leader sends each data change to them as a **replication log** or change stream; each follower applies the writes **in the same order** as the leader.
3. **Reads** can go to the leader or any follower; followers are read-only for clients.

Built into PostgreSQL (since 9.0), MySQL, Oracle Data Guard, SQL Server AlwaysOn; MongoDB, RethinkDB, Espresso; and also message brokers like Kafka and RabbitMQ's highly available queues; DRBD for block devices.

**Synchronous vs asynchronous** (Figure 5-2). With a **synchronous** follower, the leader waits for its confirmation before telling the client "success" and before making the write visible. With an **asynchronous** follower, it sends the change and doesn't wait.

- Replication is usually fast (well under a second) — but there's **no guarantee**: during recovery from a failure, near capacity, or with network problems, followers can fall minutes behind.
- **Sync pro:** the follower is guaranteed up to date — if the leader dies, the data is there. **Sync con:** if the synchronous follower doesn't respond (crashed, network fault, anything), **the write can't be processed**; the leader must block all writes.
- So making *all* followers synchronous is impractical: any one outage halts the system. In practice "synchronous" means **one** synchronous follower and the rest asynchronous; if the synchronous one is slow or down, an asynchronous one is promoted to synchronous. That guarantees an up-to-date copy on at least two nodes — **semi-synchronous**.
- Often replication is **fully asynchronous**: if the leader fails unrecoverably, writes not yet replicated are **lost, even though they were confirmed to the client**. The upside: the leader keeps accepting writes even if every follower has fallen behind. Weakened durability sounds bad, but async is nearly unavoidable with many followers or geographic distribution.
:::

:::visual ReplicationSim | A leader and two followers
**Try this:**
1. Write a few times with follower 1 **synchronous** (300 ms away) and follower 2 **asynchronous** (1.5 s away). The client waits only for follower 1.
2. **Take follower 1 offline** and write: the write is blocked — that's the price of synchrony.
3. Make follower 1 asynchronous: writes are acknowledged instantly; bring follower 2's delay to 5 s and write fast: watch the lag grow.
4. Bring an offline follower back: it catches up from where it stopped.
:::

:::quiz
### mcq
Which is the main problem with the shared-memory (scale-up) approach, according to the book?
- [ ] It can't run SQL
- [x] Cost grows super-linearly, twice the hardware doesn't guarantee twice the throughput, and it's limited to one location
- [ ] It requires a fast network between machines
- [ ] It loses data on every restart
>>>
Pages 141–142. Shared-nothing avoids special hardware and allows geographic distribution, at the cost of software complexity.

### mcq
What is the difference between replication and partitioning?
- [ ] Replication splits data; partitioning copies it
- [x] Replication keeps copies of the same data on several nodes; partitioning splits the data into subsets stored on different nodes
- [ ] They are two names for the same thing
- [ ] Partitioning is only for analytics
>>>
They're separate mechanisms that are often combined: each partition is replicated (Figure II-1).

### predict
The leader has one synchronous follower, which suddenly loses its network connection. What happens to new writes?
- [ ] They are accepted and replicated later
- [x] They block: the leader can't confirm them without the synchronous follower (until another follower is made synchronous)
- [ ] They are sent to the follower directly
- [ ] They're accepted but marked as unreplicated
>>>
That's why systems use semi-synchronous replication: if the synchronous follower is unavailable, one of the asynchronous followers is made synchronous (p. 148).

### mcq
With fully asynchronous replication, the leader confirms a write and then crashes permanently before sending it to any follower. What is true?
- [ ] The write is safe on disk on a follower
- [x] The write is lost even though the client was told it succeeded
- [ ] The client is automatically notified of the failure
- [ ] Followers detect and replay it
>>>
Durability is weakened: confirmation doesn't mean the write exists anywhere but the failed leader (p. 149).

### tradeoff
A company has 12 read replicas across 4 continents. Why is asynchronous replication almost unavoidable here?
- [ ] Synchronous replication can't cross oceans
- [x] Waiting for many distant followers on every write would make writes slow, and any single unavailable follower would block all writes
- [ ] Asynchronous replication is always more durable
- [ ] Read replicas can't be synchronous
>>>
The more followers and the farther away, the slower synchronous writes become and the more likely that one of them is unreachable (p. 149, p. 155).

### explain
In your own words, explain why "there is no guarantee how long replication takes" is such an important sentence (p. 148).
>>>
Normally followers are less than a second behind, so it's tempting to treat them as up to date. But lag is unbounded: when a follower recovers from a failure, the system is near capacity, or the network has problems, followers may be minutes behind. Any design that silently assumes followers are fresh — reading your own writes, failover without data loss, showing consistent data — will break exactly when the system is already under stress. You have to design for arbitrary lag.
:::

:::connect Where this goes next
Tomorrow: how to add a new follower without downtime, what happens when followers and leaders fail, and why automatic failover is full of traps. The unbounded network delays mentioned today are the heart of Chapter 8.
:::
