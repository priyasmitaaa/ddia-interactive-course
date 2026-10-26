---
title: Lab — build a tiny MapReduce engine, chain jobs, and join
chapter: 10
topic: Map, partition, sort, shuffle, merge, reduce; task retries; workflows; sort-merge join with secondary sort
minutes: 110
---

## Objective

Implement the dataflow of Figure 10-1 yourself. **Map tasks** partition their output by reducer
using a hash of the key and write each partition as a **sorted** file. **Reduce tasks** fetch their
partition from every mapper and **merge** the sorted files (not re-sort them), then call the reducer
once per key. Add MapReduce's fault-tolerance contract: task attempts write privately, failed attempts
are discarded and retried, and only successful output is committed (p. 418). Then use the engine as
the book does: two **chained jobs** for "top URLs", and a **reduce-side sort-merge join** with a
**secondary sort** (Figure 10-3, pp. 393–394).

## Setup

Python 3.10+, standard library only. Files: `practice/37-mapreduce/minimr.py` (TODOs 1–4) and
`test_minimr.py` (T1–T5). Tasks run sequentially in one process, but the files, partitions and
attempt semantics mirror a real cluster. The **MapReduce** and **Join** visualizations this week
show the same steps.

## Predict first

1. Why does `stable_hash` exist? What would break if the partitioner used Python's built-in `hash()`?
2. A map task crashes after emitting half its output. What must happen to that half?
3. For the join, how do you make sure the reducer sees the user's record before their events?

## Your task

1. **TODO 1** `run_map_task` → T1.
2. **TODO 2** `run_reduce_task` → T2.
3. **TODO 3** `_attempt` → T3.
4. T4 (`top_urls`) is written for you. Read it: job 2 sorts by `(-count, url)` into a single reducer,
   just like the second `sort -r -n`.
5. **TODO 4** `join_events_with_users` → T5.

## Run it

```
python practice/37-mapreduce/test_minimr.py
```

## Observe

- The results don't depend on the number of reducers. Partitioning only decides *where* each key is
  reduced, never *whether* or *how often*.
- With injected crashes, the final output is identical and no `*.attempt*` files remain. That's
  why MapReduce can retry tasks freely: inputs are immutable and outputs of failed tasks are
  thrown away (pp. 401–402).
- The join never makes a network request per record. Partitioning and sorting by user ID bring
  each user's record and events into one reduce call, which holds one date of birth in memory
  (p. 394). An event for an unknown user simply produces no output (an inner join).
- "Top URLs" needs two jobs, because a single MapReduce job only gives you one round of sorting
  (p. 390).

## Questions

1. Why merge the sorted mapper files on the reduce side instead of concatenating and sorting them?
2. What exactly does "the key is like a destination address" mean (p. 394)?
3. What would happen to T3 if a reducer wrote directly to an external database instead of a file?
4. How would you change `join_events_with_users` to handle a celebrity user with millions of events?

<details><summary>Discussion</summary>

1. Each file is already sorted, so a k-way merge streams through them in one sequential pass with
   memory proportional to the number of files, not the data. Re-sorting would need all the data in
   memory or another external sort (pp. 389–390).
2. Every pair with the same key reaches the same reduce call, wherever and whenever it was emitted.
   The mapper "sends a message" addressed by key, and the framework does the routing. This separates
   network communication from the application logic (p. 394).
3. A failed attempt's writes would already be visible externally and couldn't be discarded, and the
   retry would write them again, so you'd get duplicates and partial results. Speculative execution
   would make it worse. That's why the book recommends building output files and bulk-loading them
   instead (p. 400).
4. Use a skew join: for the linchpin key, send its events to random reducers and replicate its user
   record to all reducers, or group in two stages (pp. 395–396). The Join visualization's Skew tab
   shows the effect on reducer load.
</details>
