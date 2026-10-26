---
title: Lab — Build a Partitioned Key-Value Store
kind: lab
minutes: 105
chapter: 6
objectives:
- Implement hash partitioning with a fixed number of partitions
- Implement rebalancing that moves whole partitions and their indexes
- Implement a routing tier that detects stale routing information and refreshes it
- Implement local secondary indexes with scatter/gather, and hot-key salting
reading:
- Re-read rebalancing strategies | 201-203
- Re-read request routing | 205-207
complete:
- All tests T1–T5 pass
- You answered the README questions in your own words
- You answered the quiz
---

:::note Today is a building day
One system, all of Chapter 6. About 90 minutes. The structure mirrors Figure 6-8: `Metadata` plays ZooKeeper (authoritative assignment + epoch), `Node`s hold partitions with local indexes, `Router` is a routing tier with a cached map.
:::

:::intuition The epoch: knowing your information is old
Every change to the assignment bumps the **epoch** in the metadata service. A node asked about a partition it no longer owns raises `WrongNode(epoch)`. The router then knows its cached map is older than reality, fetches a fresh snapshot, and retries.

<div class="figure">
<svg class="dg" viewBox="0 0 640 150" role="img" aria-label="Router retries after a WrongNode error">
  <rect class="boxe" x="20" y="50" width="120" height="44" rx="8"/><text x="80" y="70" text-anchor="middle">Router</text><text x="80" y="86" text-anchor="middle" class="sub">cache: epoch 1</text>
  <rect class="box" x="260" y="10" width="120" height="40" rx="8"/><text x="320" y="35" text-anchor="middle">node n1 (old owner)</text>
  <rect class="boxb" x="260" y="96" width="120" height="40" rx="8"/><text x="320" y="121" text-anchor="middle">node n3 (new owner)</text>
  <rect class="boxc" x="490" y="50" width="130" height="44" rx="8"/><text x="555" y="70" text-anchor="middle">Metadata</text><text x="555" y="86" text-anchor="middle" class="sub">epoch 5</text>
  <path class="lnd" d="M140 60 L260 30"/><text x="190" y="30" text-anchor="middle" class="sub">1. get</text>
  <path class="ln dash" d="M260 40 L140 70"/><text x="210" y="62" class="sub">2. WrongNode</text>
  <path class="ln" d="M140 72 C 300 72, 400 72, 490 72"/><text x="420" y="66" class="sub">3. refresh</text>
  <path class="lna" d="M140 86 L260 116"/><text x="180" y="118" class="sub">4. retry ✓</text>
</svg>
</div>

Real systems use the same idea in many places: Kafka's controller epoch, ZooKeeper's zxid, Raft's term — and Chapter 8's fencing tokens.
:::

:::practice 23-partitioned-kv | Build it
TODOs 1–6. Read each test before writing the code it checks.
:::

:::quiz
### mcq
In your design, what never changes when a node is added?
- [ ] The partition-to-node assignment
- [x] Which partition a key belongs to
- [ ] The metadata epoch
- [ ] The number of nodes contacted by scatter/gather
>>>
partition = h(key) % n_partitions with a fixed partition count; only ownership of partitions changes.

### predict
After `add_node()`, an old Router calls `get("car:7")`, whose partition moved. What sequence happens?
- [ ] It returns stale data from the old node
- [x] The old owner raises WrongNode; the router refreshes its cached assignment and retries against the new owner
- [ ] The request fails permanently
- [ ] The metadata service forwards the request
>>>
That's T3: one failure, one refresh, then success.

### mcq
Why must `add_node()` copy each partition's secondary index along with its data?
- [ ] For compression
- [x] Because the index is local (document-partitioned): it covers only that partition's documents and must live with them, or scatter/gather results would be missing entries
- [ ] Because the router needs it
- [ ] It doesn't need to
>>>
T4 checks that query results are unchanged after rebalancing.

### explain
Your rebalancing copies data and then switches ownership instantly. Explain why a real database can't do it this simply, and sketch a safer procedure.
>>>
In a real system, copying a partition takes time while clients keep writing to the old owner. Writes that arrive after the copy began but before the switch would be missing on the new owner — lost updates. A safer procedure: copy a consistent snapshot of the partition tagged with a log position; stream all changes since that position to the new node until it's caught up (like setting up a new follower, Chapter 5); then briefly pause writes to that partition (or use a fencing epoch), apply the last changes, switch ownership in the metadata service, and make the old owner reject requests with the new epoch.
:::

:::connect Where this goes next
Chapter 6's summary ends with a question: what if a write touching several partitions half succeeds? Next week begins Chapter 7, **transactions** — the abstraction that makes "all or nothing" and "no interference from concurrent clients" possible.
:::
