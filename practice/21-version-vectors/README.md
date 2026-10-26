---
title: Detecting concurrent writes — version numbers and version vectors
chapter: 5
topic: Happens-before, siblings, merging, version vectors
minutes: 50
---

## Objective

Implement the algorithm the book uses to tell "overwrote" from "concurrent" (pp. 181–185):
first with a single version counter (Figure 5-13's shopping cart), then with **version vectors**
across several replicas — so that no write is silently lost, unlike last-write-wins.

## Setup

Python 3.10+. Files: `practice/21-version-vectors/versions.py` (TODOs 1–4) and `test_versions.py`.
The Cart visualization in today's lesson runs the same single-replica algorithm step by step.

## Predict first

1. After the five writes of Figure 5-13, how many sibling values does the server hold? Is any item lost?
2. Are `{A: 2, B: 1}` and `{A: 1, B: 2}` ordered or concurrent?
3. A client reads from replica A and writes to replica B. Why does a single counter per key break here, but a version vector doesn't?

## Your task

1. **TODO 1** `SingleReplicaStore.write` → T1 (Figure 5-13 replayed exactly).
2. **TODO 2** `compare` → T2.
3. **TODO 3–4** `VVReplica.write` and `receive` → T3.

## Run it

```
python practice/21-version-vectors/test_versions.py
```

## Observe

- The server never interprets values — only version numbers — yet it knows exactly which values were superseded and which are concurrent.
- Clients do extra work: they must merge siblings (here: union) before writing.
- With version vectors, reading from one replica and writing to another is safe: the write's vector says what it was based on.

## Questions

1. Why does the server keep the concurrent siblings instead of picking one? What would LWW do here?
2. Union works for adding items. What goes wrong when users can also *remove* items, and how do tombstones fix it?
3. Why can't you decide "concurrent or not" by comparing timestamps?
4. What is the subtle difference the book mentions between version vectors and vector clocks?

<details><summary>Discussion</summary>

1. Neither write knew about the other, so neither should win; keeping both lets the application merge without data loss. LWW would keep one cart and silently discard the other client's additions (p. 180).
2. If one sibling removed an item and another still has it, the union brings it back (Amazon's reappearing cart items, p. 167). The removal must be recorded as a tombstone with a version, so merging knows the item was deleted (p. 185) — or use CRDTs that handle this automatically.
3. Concurrency is about causality — whether one operation knew about the other — not about wall-clock overlap; and clocks on different machines are not reliably synchronized (sidebar p. 181, Chapter 8).
4. Version vectors are used in client–server systems (replicas track versions of a value, passed to and from clients); vector clocks are for peer-to-peer systems tracking causality between processes (p. 185).
</details>
