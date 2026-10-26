---
title: Review — Consolidating the Whole Book
kind: review
minutes: 60
objectives:
- Turn final-exam mistakes into targeted review
- Build a one-page concept map of the whole book
- Plan the capstone
reading:
complete:
- You did today's spaced review, including your exam misses
- You drew the whole-book concept map
- You read the capstone overview for Week 23
---

:::review Today's spaced review
Scheduled questions from all 22 weeks, including every final-exam question you missed.
:::

:::task The whole book on one page
Draw three bands: **Foundations** (Chapters 1–4), **Distributed data** (5–9) and **Derived data** (10–11). In each band, write each chapter's central question in one line, such as "how is data laid out on disk so it can be found again?" or "how do replicas agree?". Then draw at least eight arrows across bands, each labeled with the idea that connects them. Examples: *log* (Ch 3 WAL → Ch 5 replication log → Ch 9 total order broadcast → Ch 11 log-based broker), *immutability* (Ch 3 SSTables → Ch 10 batch inputs → Ch 11 event sourcing), *determinism* (Ch 7 serial execution → Ch 10 recomputation → Ch 11 idempotence), *partitioning*, *fencing and epochs*, *derived data*. Keep it. It's your index to the book.
:::

:::quiz Whole-book review
### mcq
Which single idea links write-ahead logs, replication logs, total order broadcast and Kafka?
- [ ] Hash indexes
- [x] An append-only, ordered log of changes from which state can be derived or replicated
- [ ] Two-phase locking
- [ ] B-trees
>>>
The log is the thread running through Chapters 3, 5, 9 and 11.

### mcq
Determinism shows up in serial execution (Ch 7), recomputation in dataflow engines (Ch 10) and idempotent replay (Ch 11). Why does it matter in all three?
- [ ] It makes code faster
- [x] Replicas or retries must produce the same result from the same input in the same order; otherwise replicas diverge, or recomputed and replayed output contradicts what was already used
- [ ] It removes the need for logs
- [ ] It guarantees linearizability
>>>
Deterministic processing over an ordered input is the basis of state machine replication and safe retries.

### explain
In a short paragraph, explain to a new engineer the most important thing this book changed about how you'll design data systems.
>>>
A strong answer is personal but grounded. For example: "Every guarantee has a cost and a precise meaning. I'll name the exact guarantee each part of a system needs (linearizable, serializable, causal, eventual, exactly-once effects), choose the weakest one that's correct, and know what happens under each failure mode: network faults, pauses, clock skew and crashes. I'll make one system the source of truth, feed everything else from its ordered log with deterministic, retryable derivation, and use consensus only where uniqueness or a single leader is required, with fencing wherever a lease or lock protects a resource."
:::
