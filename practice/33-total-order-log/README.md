---
title: Total order broadcast — a username registry on a log
chapter: 9
topic: Total order broadcast, linearizable compare-and-set from a log, sequential vs linearizable reads
minutes: 45
---

## Objective

Build the construction from pp. 340–341: a **uniqueness constraint** (each username has exactly one
owner) on top of **total order broadcast**, which is an append-only log that every node receives in
the same order. Compare it with check-then-write against a local replica. Then make reads
linearizable by sequencing them through the log.

## Setup

Python 3.10+, standard library only. Open `practice/33-total-order-log/registry.py`. `Log` is a
single in-process sequencer. Each `Node` has a background thread that applies log entries in order,
with a random lag of a few milliseconds. In a real system the log itself is replicated with a
consensus algorithm, as in ZooKeeper or etcd (pp. 356–357), but the ordering logic is the same.

## Predict first

1. Two users claim the same name at the same moment on different nodes, using `claim_naive`. How
   often will both be told "success"?
2. With `claim_via_log`, can both succeed? Can *neither* succeed?
3. Alice was told "success" via node 0, and she immediately reads the name via node 2's local state.
   What might she see?

## Your task

1. **TODO 1** `claim_via_log`: append, wait until your claim is delivered back to you, then win only
   if the first claim for the name in the log is yours.
2. **TODO 2** `read_synced`: append a marker, wait for it, then read. This is the first option on
   p. 341, similar to how etcd's quorum reads work.

## Run it

```
python practice/33-total-order-log/registry.py
```

## Observe

- `claim_naive` hands out nearly every contested name twice. Each node checks a state that doesn't
  yet contain the other claim. Both appends land in the log, and only the first one actually wins,
  so one user was told a lie.
- `claim_via_log` never does. Every node applies the same entries in the same order, so every node
  agrees on which claim came first, and each user is told the truth.
- Exactly one user wins each contest. Neither *both* nor *neither* is possible, because exactly one
  claim is first.
- Local reads right after a successful claim are often stale: the log gives a fixed order, but each
  node receives it at its own pace. The claim procedure on its own gives *sequential* consistency.
  Sequencing the read through the log makes it linearizable (p. 341).

## Questions

1. Why must the node wait for its *own* message to come back before deciding? What breaks if it
   decides right after appending?
2. How is this different from Lamport timestamps, which also give a total order (p. 340)?
3. Our `Log` is one in-memory sequencer. What happens when it crashes, and what would you need instead?
4. What does ZooKeeper's `sync()` do, in terms of this exercise (p. 341)?

<details><summary>Discussion</summary>

1. Until your message is delivered, you don't know whether someone else's claim was sequenced ahead
   of yours. Deciding early is check-then-write again. Waiting until delivery means you've seen
   every message ordered before yours, so the decision is final (p. 341, footnote xi).
2. With total order broadcast the order is **fixed at delivery time**. No message can later be
   inserted earlier in the order. With Lamport timestamps, an operation with a smaller timestamp
   could still show up from another node, so you only know the final order once you've heard from
   everyone (pp. 338, 340).
3. A single sequencer is a single point of failure. If it crashes, nobody can claim anything, and if
   it loses its state, the order is lost. A fault-tolerant log needs a consensus algorithm: total
   order broadcast is equivalent to repeated rounds of consensus (pp. 342, 357).
4. It fetches the latest log position in a linearizable way and waits until the local replica has
   applied everything up to that position, so a following read is up to date. That's the second
   option on p. 341, a variant of `read_synced` that doesn't append a marker.
</details>
