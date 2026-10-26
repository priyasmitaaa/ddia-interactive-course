---
title: Logical clocks — Lamport timestamps, vector clocks and broken sequence generators
chapter: 9
topic: Causality, happened-before, sequence number ordering, Lamport timestamps
minutes: 45
---

## Objective

Implement the two classic logical clocks and use them to score the "obvious" ways of numbering
events in a system without a single leader (pp. 334–337). **Vector clocks** give the exact
happened-before relation, so they can tell you when two events are concurrent. **Lamport
timestamps** give a total order that never contradicts causality, but they can't tell you which events
were concurrent. Per-node counters, block allocation and physical clocks all produce unique,
roughly increasing numbers, and all of them break causality.

## Setup

Python 3.10+, standard library only. Open `practice/32-logical-clocks/clocks.py`. The trace is a
random but reproducible exchange of about 400 events between 4 nodes.

## Predict first

1. Of the three non-causal generators, which do you expect to violate causality most often, and why?
2. Physical clocks skewed by ±1.5 time units, with message delays of 0.5–8 units: many or few violations?
3. How many of about 74,000 causally ordered pairs will Lamport timestamps get wrong?

## Your task

1. **TODO 1** `assign_lamport`: the rule from p. 337. Every node and message carries the maximum
   counter seen, and a node receiving a larger one jumps forward.
2. **TODO 2** `assign_vectors` and `happened_before`: the generalized version vectors of p. 334.

## Run it

```
python practice/32-logical-clocks/clocks.py
```

## Observe

- **Block allocation** is the worst, at roughly 14%. A causally later event can draw from an older,
  lower block (p. 336).
- **Per-node counters** fail whenever a busy node's counter has raced ahead of a quiet one's, and
  the quiet node then reacts to a message from the busy one (p. 335).
- **Physical clocks** get only a few pairs wrong *in this setup*, because the skew is small compared
  with the message delays. Make the skew comparable to the delays and watch it grow. That's
  Figure 8-3 again.
- **Lamport** gets zero wrong. But the last line shows two concurrent events that Lamport still
  orders, and from the timestamps alone you can't tell they were concurrent (p. 337).

## Questions

1. Why is "0 violations" for Lamport guaranteed and not just luck?
2. A system uses Lamport timestamps to decide which of two concurrent writes to the same key wins.
   Is that LWW? What's still lost?
3. Why do vector clocks need one entry per node, and why is that a problem for systems with many
   clients?
4. Why aren't Lamport timestamps enough to enforce a unique username at the moment a request
   arrives (p. 338)?

<details><summary>Discussion</summary>

1. Every causal dependency is a chain of same-node steps and messages. A node's counter increases
   at each step, and a message carries its sender's counter, which the receiver then exceeds. So the
   counter strictly increases along any causal chain (p. 337).
2. Yes, it's last-write-wins with a causally consistent timestamp. It never lets an older write
   overwrite one that causally followed it, which fixes the Figure 8-3 problem, but it still silently
   discards one of two *concurrent* writes. To keep both, you need to detect concurrency (version
   vectors and siblings) or use commutative merges (CRDTs).
3. Each entry records how many events from that node are known, so happened-before can be decided
   by element-wise comparison. With thousands of clients, vectors become large. That's why systems
   like Riak use version vectors per *replica*, not per client (Chapter 5).
4. The total order only emerges once you have seen everyone's operations. When a request arrives, a
   node doesn't know whether another node is concurrently assigning a *lower* timestamp to a claim for
   the same name. It would have to ask every node, which blocks if one is unreachable. You also need
   to know when the order is *final*, which is what total order broadcast provides (pp. 337–338).
</details>
