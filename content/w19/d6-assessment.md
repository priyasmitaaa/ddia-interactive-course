---
title: Review — Chapter 10 Checkpoint
kind: assessment
minutes: 70
chapter: 10
objectives:
- Retrieve all of Chapter 10 from memory
- Choose join algorithms and execution engines for unfamiliar workloads
- Explain batch processing's fault-tolerance contract
reading:
- Chapter 10 Summary | 416-418
complete:
- You did today's spaced review
- You answered the checkpoint without notes
- Exercises 36–39 are done (or consciously skipped)
---

:::review Today's spaced review
Scheduled questions from Weeks 1–19.
:::

:::task Join algorithm decision tree, from memory
Draw a decision tree for choosing a join algorithm in batch processing. Start with "is one input small enough for memory?", then "are both inputs partitioned the same way?", then "…and sorted?". End each branch with: broadcast hash join, partitioned hash join, map-side merge join, or reduce-side sort-merge join. Add a branch for skewed keys. Check against pp. 393–398 and the summary.
:::

:::quiz Chapter 10 checkpoint
### scenario
A company builds a "related products" table nightly with a Spark job and loads it into its production MySQL by doing `INSERT ... ON DUPLICATE KEY UPDATE` from every executor. Some mornings, product pages show a mix of old and new recommendations, and MySQL latency spikes at 3 a.m. Explain both symptoms and redesign.
>>>
Writing to a production database from inside the job (p. 400): thousands of parallel tasks writing at batch rates overload MySQL, hence the latency spike that hurts the online queries. The job's all-or-nothing output contract is lost, because writes are external side effects. If tasks fail and retry, speculative copies run, or the job dies halfway, the database holds a partial mix of old and new rows, hence the mixed recommendations. Redesign: have the job write a complete new dataset of immutable files to its output directory (HDFS or S3), then bulk-load it into a read-only serving store that serves the old version until the new one is fully loaded and atomically switches (Voldemort-style, p. 401), or swap a MySQL table via rename after a bulk load. Keep the previous version, so a bad job can be rolled back by switching back (human fault tolerance, p. 401).

### mcq
Which join fits a 3 TB fact table joined with a 200 MB dimension table?
- [ ] Reduce-side sort-merge join
- [x] Broadcast hash join
- [ ] Map-side merge join, without preparation
- [ ] Nested loop with remote lookups
>>>
The small side fits in every mapper's memory, so there's no shuffle of 3 TB (pp. 396–397).

### mcq
Why must operators in Spark or Flink jobs be deterministic for efficient recovery?
- [ ] For security
- [x] Lost partitions are recomputed; if recomputed data differs from what downstream already consumed, downstream operators must be rerun too
- [ ] Because HDFS requires it
- [ ] For better compression
>>>
Recomputing a lost partition must reproduce exactly what downstream operators already consumed. Otherwise the framework has to kill and rerun those operators as well (p. 410).

### tradeoff
A 20-stage pipeline has one stage whose output is 1/1000 the size of its input and takes 3 hours of CPU to compute. In a dataflow engine, should you materialize that stage's output?
- [x] Yes: it's small and expensive to recompute, so checkpointing it to durable storage is cheaper than recomputing it after a failure
- [ ] No, never materialize in dataflow engines
- [ ] Only if it's sorted
- [ ] It doesn't matter
>>>
That's the book's exception to recomputation: small intermediate data, or very CPU-intensive steps, are cheaper to materialize than to redo after a failure (p. 411).

### explain
Explain why MapReduce writes eagerly to disk and retries at task granularity, and why the same design "makes less sense" elsewhere.
>>>
MapReduce was designed for Google's mixed-use datacenters, where low-priority batch tasks share machines with production services and are frequently preempted: about a 5% chance per task-hour, more than ten times the hardware failure rate. A job with 100 ten-minute tasks has a better than 50% chance of losing at least one (pp. 405–406). Restarting whole jobs, MPP-style, would waste enormous work, so MapReduce materializes outputs and retries just the failed task. Being preemptable enables over-commitment and better utilization. On clusters without such preemption, where task failures are rare, those overheads (eager disk writes, materializing all intermediate state) buy little, which is why dataflow engines that keep more in memory and recompute on rare failures are often much faster (pp. 406–410).

### design
Design a batch workflow that computes, per article, "readers also read" recommendations from a week of page-view logs (5 TB) and serves them to the website. Name each stage, the join or grouping algorithm, how skew is handled, and how output reaches production.
>>>
(1) Sessionize: group page views by user ID (reduce-side grouping, or dataflow partition-by-user) to get each user's set of articles read this week (p. 395). Skew: bots or heavy readers can be capped or two-stage grouped. (2) Co-occurrence: for each user's set, emit pairs (article_a, article_b), then group by article_a and count article_b. Very popular articles are linchpin keys, so use two-stage aggregation (random pre-aggregation, then combine, p. 396). (3) Enrich with article metadata (title, category) via a broadcast hash join, since the article table is small (p. 397). (4) Rank top-N per article and build key-value store files keyed by article ID (sort by key, then write immutable files, p. 401). (5) Bulk-load into read-only serving nodes that switch atomically, and keep last week's version to roll back (p. 401). Run it on a dataflow engine (Spark or Flink) so intermediate stages aren't materialized to HDFS, keep operators deterministic (seeded sampling, sorted tie-breaks) so recovery by recomputation is safe (p. 410), and schedule it with Airflow or similar. All inputs stay immutable, so a buggy run is fixed by rerunning it.
:::
