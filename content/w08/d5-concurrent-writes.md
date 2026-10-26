---
title: Detecting Concurrent Writes — Happens-Before and Version Vectors
kind: lesson
minutes: 110
chapter: 5
objectives:
- Explain why replicas diverge when nodes simply overwrite on every write
- Explain last write wins, its data loss, and when it's safe (immutable keys)
- Define "happens-before" and concurrency without reference to physical time
- Execute the version-number algorithm of Figure 5-13 and explain siblings, merging and tombstones
- Explain version vectors for multiple replicas
reading:
- Detecting concurrent writes; last write wins | 178-180
- The happens-before relationship and concurrency | 180-181
- Tracking happens-before, merging concurrently written values | 181-185
- Version vectors; Summary | 185-187
complete:
- You stepped through Figure 5-13 in the visualization and predicted each step
- Version-vector exercise tests pass
- You answered the quiz
---

:::problem Every node sees a different order
In Figure 5-12, clients A and B both write key X at about the same time to a three-node store. Node 1 gets A's write but never B's (a transient outage); node 2 gets A then B; node 3 gets B then A. If each node just overwrites the value whenever it receives a write, they end up **permanently inconsistent**: node 2 says B, the others say A. To be *eventually* consistent, replicas must converge — and most implementations are, the book says, "quite poor" at it: to avoid losing data, *you* must understand your database's conflict handling (p. 179).
:::

:::intuition "Before" means "knew about"
One option: **last write wins (LWW)** — keep only the most "recent" value, by attaching a timestamp to each write and discarding lower ones. It converges, but the scare quotes matter: in Figure 5-12 neither client knew about the other, so it's meaningless to say one happened "first" — the writes are **concurrent**, their order undefined. LWW imposes an arbitrary order and **silently discards** all but one of several writes that were each reported as successful (and, as Chapter 8 shows, can even drop non-concurrent writes because of clock skew). It's the only conflict resolution in Cassandra and optional in Riak. Acceptable for caching, perhaps; otherwise, the only safe way to use LWW is to write each key **once** and treat it as immutable — e.g. a UUID per write as the key.

So what *is* concurrency? (p. 180)

- **A happens before B** if B knows about A, depends on A, or builds upon A. (In Figure 5-9, B's increment builds on A's insert — not concurrent; B is **causally dependent** on A.)
- **A and B are concurrent** if neither happens before the other — neither knows about the other.

For any two operations: A before B, B before A, or concurrent. If one happened before the other, the later should **overwrite** the earlier; if concurrent, there's a **conflict to resolve**.

Physical time doesn't matter here (sidebar "Concurrency, time, and relativity"): two operations can be hours apart and still concurrent if the network prevented one from knowing about the other. It's like relativity: events that can't influence each other have no meaningful order.
:::

:::visual CartVersionSim | Figure 5-13, step by step
Before each step, predict what the server will keep and what it will overwrite. Then use **Free play**: add an item from client 1, remove it from client 2 without reading first, and look at the merged result.
:::

:::details The algorithm, siblings, and version vectors (pp. 181–185)
### Tracking happens-before with version numbers (single replica)
The shopping cart (Figure 5-13): client 1 adds milk (v1); client 2 adds eggs not knowing about milk (v2 — server keeps **both** values); client 1 adds flour based on v1 → [milk, flour] v3 overwrites [milk] but keeps [eggs]; client 2 merges [milk] and [eggs], adds ham based on v2 → v4 overwrites [eggs], keeps [milk, flour]; client 1 adds bacon based on v3 → v5, keeping [eggs, milk, ham]. Old versions get overwritten, **no write is lost**, and the server never looks inside the values. The rules (p. 184):

1. The server keeps a **version number per key**, incremented on every write, stored with the value.
2. A **read** returns all values not yet overwritten, plus the latest version. A client must read before writing.
3. A **write** includes the version from the prior read and must **merge all values** received in that read.
4. On a write with version v, the server **overwrites all values with version ≤ v** (they've been merged) and **keeps values with higher versions** (concurrent with this write). A write without a version is concurrent with everything and overwrites nothing.

### Merging siblings (pp. 184–185)
Riak calls concurrent values **siblings**. Merging them is the same problem as multi-leader conflict resolution. Picking one (LWW) loses data. For a cart, a reasonable merge is the **union**: [milk, flour, eggs, bacon] ∪ [eggs, milk, ham] → [milk, flour, eggs, bacon, ham]. But if users can **remove** items, union resurrects removed ones — so a removal must leave a **tombstone** with a version number, telling the merge the item was deleted. Because this is error-prone, CRDTs (e.g. Riak's datatypes) merge siblings automatically and sensibly, including deletions.

### Version vectors (p. 185)
One version number isn't enough when **several replicas accept writes concurrently**. Use a version number **per replica as well as per key**: each replica increments its own number when processing a write and tracks the numbers it has seen from others. The collection is a **version vector**; the most interesting variant is the **dotted version vector** (Riak 2.0). Like the single version number, version vectors go to clients on reads and come back with writes, letting the database distinguish overwrites from concurrent writes — and making it safe to **read from one replica and write back to another** (siblings may appear, but no data is lost if they're merged correctly). Version vectors vs vector clocks: subtle difference — roughly, version vectors for client–server, vector clocks for peer-to-peer.

### Chapter 5 summary (pp. 186–187)
Replication serves **high availability**, **disconnected operation**, **latency** and **read scalability**. Three approaches: **single-leader** (simple, no conflicts; follower reads may be stale), **multi-leader** and **leaderless** (more robust to faulty nodes, network interruptions and latency spikes, but harder to reason about and with very weak consistency). Sync vs async replication profoundly affects behaviour under faults; promoting an async follower can lose committed data. Consistency models for lag: **read-after-write**, **monotonic reads**, **consistent prefix reads**. Multi-leader and leaderless allow concurrent writes, hence conflicts; we can detect concurrency (happens-before) and resolve by merging.
:::

:::practice 21-version-vectors | Implement it
Replay Figure 5-13 exactly, then generalise to version vectors across two replicas — including reading from one and writing to the other.
:::

:::quiz
### mcq
Two clients write the same key without either having read the other's value. In the book's terms, these writes are:
- [ ] Ordered by their timestamps
- [x] Concurrent, because neither knew about the other — regardless of when they physically happened
- [ ] Sequential, because the server processed one first
- [ ] Causally dependent
>>>
Concurrency is defined by knowledge, not by clock time (p. 180–181).

### predict
Figure 5-13, step 3: the server holds [milk] (v1) and [eggs] (v2). Client 1 writes [milk, flour] with version 1. What does the server keep?
- [ ] Only [milk, flour]
- [x] [eggs] (v2) and [milk, flour] (v3)
- [ ] All three values
- [ ] [milk] and [milk, flour]
>>>
Values with version ≤ 1 are overwritten (merged into the new value); v2 is concurrent and kept (p. 182).

### mcq
When is last write wins safe?
- [ ] Whenever clocks are synchronized with NTP
- [ ] Whenever w + r > n
- [x] When each key is written only once and treated as immutable (e.g. a UUID per write), so there are no concurrent updates to lose
- [ ] Never
>>>
p. 180. (For caches, losing writes may also be acceptable.)

### mcq
Why does merging cart siblings by union fail when items can be removed?
- [ ] Union is too slow
- [x] An item removed in one sibling but still present in another reappears in the union; removals need tombstones
- [ ] Removed items can't be stored
- [ ] Union loses added items
>>>
The Amazon cart anecdote (p. 167) and the tombstone fix (p. 185).

### mcq
What problem do version vectors solve that a single per-key version number doesn't?
- [ ] They compress values
- [x] They track versions per replica, so concurrent writes accepted by different replicas can be distinguished from overwrites — e.g. reading from one replica and writing to another is safe
- [ ] They replace the need for merging
- [ ] They make writes synchronous
>>>
With several replicas each assigning versions independently, one counter can't express "I've seen replica A's write 3 but not replica B's write 2". A vector with one entry per replica can, so concurrent writes on different replicas are detected rather than silently overwritten (p. 185).

### explain
Explain why the server in Figure 5-13 can decide what to overwrite "without interpreting the value itself", and why that's valuable.
>>>
The decision depends only on version numbers: the version a write is based on tells the server which earlier values the client had seen (and merged); anything with a higher version is something the client didn't know about, so it's concurrent and must be kept. The value could be any data structure — the database stays generic, and the application owns the meaning (how to merge siblings). This separation lets the same database support carts, documents or counters while guaranteeing no write is silently dropped (p. 183).
:::

:::connect Where this goes next
Happens-before and version vectors are the foundations of Chapter 9's **causal consistency** and **Lamport timestamps**. And Chapter 8 will show exactly why LWW's timestamps are unsafe (clock skew). Tomorrow: Chapter 5 checkpoint.
:::
