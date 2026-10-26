---
title: Review — Ordering, Causality and Total Order Broadcast
kind: review
minutes: 60
chapter: 9
objectives:
- Retrieve the ordering chain of ideas from memory
- Distinguish partial order, total order, and finalized total order
- Catch up on Exercises 32 and 33
reading:
- Re-read the Chapter 9 summary on causality and reducibility | 363-364
complete:
- You did today's spaced review
- You wrote the "ordering ladder" from memory
- Exercises 32 and 33 are done (or consciously skipped)
---

:::review Today's spaced review
Scheduled questions from Weeks 1–15.
:::

:::task The ordering ladder, from memory
Write each rung with one sentence and an example, from weakest to strongest:
1. **No order** (eventual convergence).
2. **Causal order**, a partial order (version vectors).
3. **Total order consistent with causality** (Lamport timestamps).
4. **Finalized total order** (total order broadcast).
5. **Total order + recency** (linearizability).

For each rung, add one thing it **can't** do that the next rung can. Check against pp. 330–342.
:::

:::quiz Week 15 checkpoint
### mcq
Which mechanism tells you that two operations were concurrent?
- [ ] Lamport timestamps
- [x] Version vectors
- [ ] A single leader's sequence numbers
- [ ] Physical timestamps
>>>
Lamport timestamps impose a total order that hides concurrency (p. 337).

### mcq
Which is the strongest consistency model that doesn't slow down due to network delays and remains available during network failures?
- [ ] Linearizability
- [ ] Sequential consistency
- [x] Causal consistency
- [ ] Strict serializability
>>>
That's the claim on p. 333, supported by references 2 and 43.

### scenario
A distributed job scheduler assigns job IDs using block allocation (each worker grabs 1,000 IDs at a time) and processes jobs "in ID order" to respect dependencies between jobs. Jobs occasionally run before the jobs they depend on. Explain why, and suggest a fix.
>>>
Block allocation gives unique, roughly increasing IDs that aren't consistent with causality (p. 336). A job created *after* (and depending on) another may come from a worker holding a lower block, so its ID is smaller and it runs first. Fixes: generate IDs with Lamport timestamps, carrying the maximum seen (including the parent job's ID) when creating dependent jobs, so dependencies always get larger IDs (p. 337). Or, if a final order that everyone agrees on is needed, append jobs to a totally ordered log (total order broadcast) and process them in log order (p. 340). Or track dependencies explicitly and wait for parents to finish.

### explain
Summarize why a linearizable compare-and-set and total order broadcast are interchangeable, in two short paragraphs, one for each direction.
>>>
From total order broadcast to cas: append a message representing the cas attempt, wait until it's delivered back to you, then determine the outcome from the log. The first claim for a key wins, and every node computes the same answer because every node sees the same order. For linearizable reads, also sequence reads through the log or sync to the latest position (pp. 340–342).

From a linearizable increment-and-get (or cas) to total order broadcast: for each message, atomically increment-and-get the register and attach the number. Send the message to everyone, and deliver messages in number order. Because the numbers are gapless, a recipient knows exactly which message to wait for next. Either direction relies on the other, and both are equivalent to consensus (p. 342).
:::
