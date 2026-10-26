---
title: Beyond MapReduce — Materialization and Dataflow Engines
kind: lesson
minutes: 95
chapter: 10
objectives:
- Explain why raw MapReduce is hard to use and what higher-level tools (Pig, Hive, Cascading, Crunch) add
- Explain the downsides of fully materializing intermediate state (stragglers, redundant mappers, replication)
- Explain how dataflow engines (Spark, Tez, Flink) connect operators and the advantages that follow
- Explain fault tolerance by recomputation (RDD lineage, Flink checkpoints) and why operators must be deterministic
- Explain when materialization is still the right choice, and why sorts can't be pipelined
reading:
- Beyond MapReduce | 406-407
- Materialization of intermediate state | 407-408
- Dataflow engines | 408-410
- Fault tolerance | 410-411
- Discussion of materialization | 411-411
complete:
- In the dataflow visualization, you found settings where pipelining saves the most
- Exercise 38 (deterministic operators) is done
- You answered the quiz
---

:::problem Robust, but slow
MapReduce got a lot of hype in the late 2000s, but it's just one of many programming models. The book spent so long on it because it's a **clear and simple abstraction** on top of a distributed filesystem, "simple in the sense of being able to understand what it is doing, not in the sense of being easy to use". Implementing complex jobs with raw MapReduce is hard and laborious. You'd write the join algorithms from scratch. **Pig, Hive, Cascading and Crunch** add higher-level constructs on top (pp. 406–407).

But some problems are in the **execution model itself**, and another layer of abstraction doesn't fix them. MapReduce is very robust: it processes almost arbitrarily large data on an unreliable multi-tenant system with frequent task terminations, and it gets the job done, slowly. Other tools are **orders of magnitude faster** for some kinds of processing (p. 407).
:::

:::intuition Stop writing every intermediate step to HDFS
**Materialization of intermediate state** (pp. 407–408). Every MapReduce job is independent. Its contact points with the world are its HDFS input and output directories, and an external scheduler starts a job when its inputs are complete. That's reasonable when an output is a **dataset you want to publish** widely, reusable by other teams and loosely coupled. But often the output of one job is only ever input to **one other job by the same team**. Then the HDFS files are just **intermediate state**, and in 50–100-job recommendation workflows there's a lot of it. Writing it out is **materialization** (as in materialized views: compute eagerly and write it out). Unix pipes instead **stream** output to the next input through a small buffer.

**Downsides of full materialization:**
- A job can start only when **all** tasks of the jobs producing its input have finished, while piped processes run concurrently. Skew and uneven load create **straggler** tasks, and waiting for them slows the whole workflow.
- **Mappers are often redundant**: they just read back what a reducer wrote and prepare it for the next partitioning and sort. If the reducer's output were partitioned and sorted the same way, reducers could be **chained directly**.
- And, as p. 409 adds, intermediate state written to HDFS **must be replicated to several machines and written to disk on each replica**. That's a lot of I/O for temporary data.

**Dataflow engines** (pp. 408–410): **Spark, Tez and Flink** handle **an entire workflow as one job**. They explicitly model the flow of data through stages, which gives them their name. Like MapReduce, they call a user function on one record at a time on a single thread, parallelize by partitioning, and copy one function's output over the network as another's input. But these **operators** needn't alternate strictly between map and reduce. Ways to connect them:
- **repartition and sort by key**, like the shuffle (for sort-merge joins and grouping);
- **partition without sorting**, enough for partitioned hash joins, where building the hash table randomizes order anyway;
- **broadcast** one operator's output to all partitions of a join (for broadcast hash joins).

(This style is based on the research systems **Dryad** and **Nephele**.)
:::

:::visual BatchFaultsViz | Materialized vs pipelined
@props {"initialTab":"dataflow"}
**Try this:**
1. Straggler slowdown 1× and HDFS cost 0. How much does pipelining save with no stragglers?
2. Raise the straggler slowdown. In chained MapReduce every stage waits for its slowest task. In the pipelined version only the chains behind that task are delayed.
3. Raise the HDFS write+read cost. Each MapReduce stage boundary pays it, and the dataflow engine doesn't.
:::

:::details Advantages, fault tolerance, and when to materialize (pp. 409–411)
**Advantages over MapReduce** (p. 409):
- Expensive work such as **sorting happens only where required**, not by default between every map and reduce.
- **No unnecessary map tasks**: a mapper's work can often be folded into the previous reduce operator, since mapping doesn't change partitioning.
- With all joins and dependencies declared, the **scheduler can optimize locality**, placing consumer and producer on the same machine so data passes through a shared memory buffer.
- Intermediate state stays **in memory or on local disk**, which needs less I/O than replicated HDFS. MapReduce already does this for mapper output, and dataflow engines generalize it.
- **Operators start as soon as their input is ready**, with no waiting for the whole previous stage.
- Existing **JVM processes are reused**, cutting startup overhead.

Because operators generalize map and reduce, the same code can run on either engine: Pig, Hive or Cascading workflows can switch from MapReduce to **Tez** with a configuration change. Tez is a thin library relying on YARN's shuffle service. Spark and Flink are big frameworks with their own networking, scheduling and APIs (p. 410).

**Fault tolerance** (pp. 410–411). Materializing to HDFS made recovery easy: restart the task and reread the durable input. Spark, Flink and Tez avoid writing intermediate state to HDFS, so if a machine fails and its intermediate state is lost, it's **recomputed** from data still available: an earlier stage if possible, otherwise the original input on HDFS. The framework must track **how each piece of data was computed**, meaning which input partitions and which operators. **Spark** uses the **RDD** (resilient distributed dataset) abstraction to track ancestry. **Flink checkpoints operator state** so it can resume an operator that hit a fault.

**Determinism matters.** If lost data had already been sent downstream and the recomputation produces *different* data, downstream operators face contradictions. The usual fix for non-deterministic operators is to **kill the downstream operators too** and rerun them, so it's better to make operators deterministic. Non-determinism creeps in easily: **hash-table iteration order**, **random numbers**, the **system clock** and **external data sources**. Remove them, for example by seeding pseudo-random generators with a fixed seed. **Recomputation isn't always right**: if intermediate data is much smaller than the source, or the computation is very CPU-intensive, it's cheaper to **materialize** it.

**Discussion** (p. 411). MapReduce is like writing every command's output to a temporary file, and dataflow engines look much more like Unix pipes. **Flink** in particular is built around **pipelined execution**. A **sort** must consume its entire input before producing output, since the very last record might have the smallest key, so sorting operators accumulate state. Most other parts can be pipelined. The **final output** still goes somewhere durable, usually HDFS, so inputs are immutable and outputs replaced as before. You just avoid writing all the intermediate state to HDFS.
:::

:::practice 38-deterministic-operators | Recompute safely
Watch set iteration order, unseeded randomness and clock reads break "recomputation", fix them, then compare pipelined and materialized chains.
:::

:::quiz
### mcq
Which is NOT a downside of MapReduce's full materialization of intermediate state?
- [ ] A job must wait for all tasks of its input jobs, including stragglers
- [ ] Redundant mappers that just reread a reducer's output
- [ ] Replicating temporary data across several HDFS nodes
- [x] Intermediate data can't be reused by other teams
>>>
Publishing to a well-known HDFS location is an *advantage* when the data really is for wider use (p. 407).

### mcq
How do dataflow engines recover when a machine holding intermediate state fails?
- [ ] They restart the entire workflow from scratch, always
- [x] They recompute the lost data from earlier stages or the original input, tracking lineage (Spark RDDs) or checkpointing operator state (Flink)
- [ ] They read it from HDFS replicas
- [ ] They can't recover
>>>
That's why operators should be deterministic (p. 410).

### predict
An operator deduplicates records by putting them into a hash set and emits "the first 1,000". Its machine crashes after part of its output was consumed downstream, and the engine recomputes it. What can happen?
- [ ] Nothing; recomputation is exact
- [x] The recomputed output may differ (hash iteration order isn't guaranteed), contradicting what downstream already consumed, so downstream operators must be rerun too
- [ ] The engine detects it and fixes the order
- [ ] The job silently skips the operator
>>>
Hash-table iteration order is one of the book's named sources of non-determinism (p. 410).

### mcq
Why can't a sort operator be fully pipelined?
- [ ] Sorting is too slow
- [x] The very last input record might have the smallest key and need to be output first, so a sort must see all its input before emitting anything
- [ ] Sorts need HDFS
- [ ] Sorts are always done by reducers
>>>
Operators around the sort can still be pipelined (p. 411).

### tradeoff
When is it better to materialize intermediate data than rely on recomputation?
- [x] When the intermediate data is much smaller than the source, or the computation is very CPU-intensive, so writing it out costs less than redoing it after a failure
- [ ] Always
- [ ] Never in Spark
- [ ] Only for the final output
>>>
Recomputation is cheap only if the lost data is cheap to rebuild. Small, expensive intermediate results are better written out (p. 411).

### explain
A Hive workflow takes 4 hours on MapReduce and 40 minutes after switching the execution engine to Tez, with no code changes. Explain where the speedup plausibly comes from.
>>>
Hive's workflow is a multi-stage plan of operators. On MapReduce each stage becomes a separate job: the next job waits for every task, stragglers included, intermediate results are written to replicated HDFS and read back, and redundant map phases reread reducer output only to repartition it (pp. 407–408). Tez runs the whole plan as one dataflow job. It sorts only where needed, partitions without sorting for hash joins, folds mapper work into the previous operator, keeps intermediate data in memory or on local disk, starts operators as soon as their input is ready, optimizes placement for locality, and reuses JVMs instead of starting new ones (pp. 409–410). The same operators run on both engines, so no code changes are needed (p. 410).
:::

:::connect Where this goes next
Tomorrow: graphs, where "repeat until done" doesn't fit MapReduce at all, so Pregel lets vertices send each other messages in supersteps. Then high-level declarative APIs, and the summary of Chapter 10.
:::
