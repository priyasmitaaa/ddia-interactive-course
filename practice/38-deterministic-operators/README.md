---
title: Deterministic operators, recomputation, and pipelining
chapter: 10
topic: Fault tolerance by recomputation, sources of non-determinism, materialization vs pipelined execution
minutes: 40
---

## Objective

Dataflow engines (Spark, Flink, Tez) avoid writing intermediate state to HDFS. When a machine dies,
they **recompute** the lost data from its inputs (p. 410). That's only safe if operators are
**deterministic**: the same input must always produce the same output. You'll see three classic
sources of non-determinism break recomputation, fix each one, and verify the fixes by "recomputing"
each operator in fresh processes. Then you'll measure what pipelining buys over materializing every
stage (pp. 407–408, 411).

## Setup

Python 3.10+, standard library only. Open `practice/38-deterministic-operators/operators.py`.
The harness runs each operator in five fresh Python processes, each with a different `PYTHONHASHSEED`.
That's a real effect: CPython randomizes string hashing per process, so the iteration order of a
`set` or `dict` of strings built in a different order can change from run to run.

## Predict first

1. `list(some_set_of_strings)[:5]`: same answer in every process?
2. Which of the three broken operators would still pass the check if you ran it twice within the same minute?
3. Pipelined vs materialized: which gives the first output sooner? Which finishes sooner overall?

## Your task

1. **TODO 1** `first_distinct_fixed`: same intent, independent of set iteration order.
2. **TODO 2** `sample_fixed`: a sample that is reproducible per partition.
3. **TODO 3** `tag_with_batch_fixed`: no clock reads inside the operator.

## Run it

```
python practice/38-deterministic-operators/operators.py
```

## Observe

- `first_distinct_broken` and `sample_broken` give different answers in different processes. If a
  downstream operator had already consumed the first answer, the recomputed partition would
  contradict it, and the engine would have to kill and rerun the downstream operators too (p. 410).
- `tag_with_batch_broken` isn't in the check, because it *would* pass if run twice within the same
  hour. A clock-dependent operator looks deterministic until a recomputation happens just after the
  hour changes. Nasty bugs are usually rare ones.
- Part B: the pipelined chain produces its first record almost immediately and holds almost
  nothing in memory. The materialized chain holds every intermediate list and emits nothing until all
  stages are done. Total time is about the same: pipelining doesn't do less work, it overlaps it and
  avoids storing intermediate state.

## Questions

1. Name the three sources of non-determinism the book lists (p. 410), and a fix for each.
2. Why can't a sort operator be fully pipelined (p. 411)?
3. When is it better to materialize intermediate data than to rely on recomputation (p. 411)?
4. MapReduce mostly avoids this problem. Why?

<details><summary>Discussion</summary>

1. Hash-table iteration order: sort, or use an ordered structure. Random numbers: a pseudo-random
   generator with a fixed seed, for example per job and partition. The system clock or external data
   sources: pass the time or data in as job parameters, or snapshot external data as an input file
   (p. 410). Note that `random.Random("job-42/partition-7")` is reproducible because seeding with a
   string hashes it with SHA-512, not with Python's randomized `hash()`.
2. The very last input record might have the smallest key and need to be output first, so a sort
   must see its whole input before emitting anything. Operators around it can still be pipelined
   (p. 411).
3. When the intermediate data is much smaller than the source data, or when the computation is very
   CPU-intensive. Then writing it out is cheaper than recomputing it after a failure (p. 411).
4. MapReduce materializes the outputs of every completed task to disk (map outputs) or HDFS (job
   outputs). A failed task simply reruns on the same durable input, and the earlier, possibly different,
   output of a failed attempt is discarded, never consumed (p. 410).
</details>
