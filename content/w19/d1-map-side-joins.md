---
title: Map-Side Joins — Broadcast, Partitioned and Merge
kind: lesson
minutes: 75
chapter: 10
objectives:
- Explain the cost of reduce-side joins and what map-side joins assume instead
- Explain broadcast hash joins, including the on-disk read-only index variant
- Explain partitioned hash joins (bucketed map joins) and their preconditions
- Explain map-side merge joins, and how join choice affects the layout of the output
- Explain why partitioning metadata (HCatalog, Hive metastore) matters
reading:
- Map-side joins; broadcast hash joins | 396-397
- Partitioned hash joins | 397-397
- Map-side merge joins; workflows with map-side joins | 398-398
complete:
- You compared the three join tabs in the visualization and counted the user records loaded
- You can state the precondition for each map-side join
- You answered the quiz
---

:::problem Sorting everything is expensive
Reduce-side joins make **no assumptions about the input**. Whatever its properties and structure, the mappers can prepare it. But all that **sorting, copying to reducers and merging** can be expensive, and data may be written to disk **several times** on its way through MapReduce (p. 396). If you *can* make assumptions about the input, a **map-side join** is faster. It's a cut-down MapReduce job with **no reducers and no sorting**: each mapper reads one input block from HDFS and writes one output file to HDFS.
:::

:::intuition Three map-side joins, three assumptions
**Broadcast hash join** (pp. 396–397). Assumption: one input is **small enough to fit in memory in each mapper**. In Figure 10-2, if the users database is small, each mapper first loads all of it from HDFS into an **in-memory hash table**, then scans its block of activity events and looks up each user ID. There is still one mapper per block of the large input, and each loads the whole small input. "Broadcast" means the small input is sent to every partition of the large input, and "hash" means it uses a hash table. It's supported by Pig ("replicated join"), Hive ("MapJoin"), Cascading and Crunch, and by warehouse engines like Impala. **Variant:** store the small input in a **read-only index on local disk**. The frequently used parts stay in the OS page cache, giving nearly hash-table speed without needing it all in memory. (Footnote vi: in general, the hash table may hold several entries per key, and the join outputs all matches.)

**Partitioned hash join** (p. 397). Assumption: both inputs are **partitioned the same way**: the same number of partitions, by the same key, with the same hash function. For example, partition both events and users by the **last decimal digit of user ID**, giving ten partitions each. Mapper 3 loads only users ending in 3 into its hash table and scans only events of users ending in 3. Each mapper loads a smaller hash table. This often holds when the inputs were produced by **prior MapReduce jobs** that already grouped them that way. Hive calls it a **bucketed map join**.

**Map-side merge join** (p. 398). Assumption: inputs are partitioned the same way **and sorted by the same key**. Then memory doesn't matter. A mapper reads both inputs incrementally in ascending key order and matches records with the same key, doing what a reducer would do. If it's possible, prior jobs probably produced that layout, and the join *could* have been in their reduce stage. A separate map-only job still makes sense if the partitioned, sorted datasets are also needed for other purposes.
:::

:::visual JoinViz | Broadcast and partitioned hash joins
@props {"initialTab":"broadcast"}
**Try this:**
1. **Broadcast**: both mappers hold *all 5* users. Note "user records loaded in total". There is no partitioning, sorting or reducers.
2. **Partitioned hash**: each mapper holds only its half of the users, and the events were partitioned the same way, so every match is local. The total loaded drops to 5.
3. Back to **Sort-merge**: the same joined rows, but every record went through the shuffle.
:::

:::details Map-side joins in workflows (p. 398)
**The output layout differs.** A **reduce-side** join's output is partitioned and sorted **by the join key**. A **map-side** join's output is partitioned and sorted **the same way as the large input**, since one map task runs per block of the large input, whether it's a broadcast or a partitioned join. Downstream jobs that rely on a particular partitioning must take this into account.

**Map-side joins make more assumptions** about the size, sorting and partitioning of their inputs. To optimize join strategies, it's not enough to know a dataset's encoding format and directory name. You also need the **number of partitions** and the **keys it's partitioned and sorted by**. In the Hadoop ecosystem, this metadata is kept in **HCatalog** and the **Hive metastore**. (It's also exactly what a cost-based query optimizer needs to choose a join algorithm automatically, which comes up on Day 5.)
:::

:::quiz
### mcq
What does a broadcast hash join assume?
- [ ] Both inputs are sorted by the join key
- [x] One input is small enough to load entirely into a hash table in every mapper
- [ ] Both inputs have the same number of partitions
- [ ] There's a reducer per key
>>>
The small input is "broadcast" to all mappers of the large input (pp. 396–397).

### mcq
What are the preconditions of a partitioned hash join?
- [ ] One input fits in memory
- [x] Both inputs have the same number of partitions, assigned by the same key and the same hash function
- [ ] Both inputs are sorted
- [ ] The join key is unique
>>>
Often true when prior jobs produced the inputs. Hive calls it a bucketed map join (p. 397).

### predict
A broadcast hash join runs with 400 mappers over the large input, and the small table has 1 million rows. How many small-table rows are loaded in total across the job?
- [ ] 1 million
- [x] 400 million: every mapper loads the whole small table
- [ ] 2,500 per mapper
- [ ] None, since it's streamed
>>>
That's why the small side must be small, or use the on-disk read-only index variant (p. 397).

### mcq
How is the output of a map-side join partitioned?
- [ ] By the join key
- [x] The same way as the large input, since one map task runs per block of the large input
- [ ] Randomly
- [ ] By the small input's key
>>>
This differs from a reduce-side join, whose output is partitioned by join key (p. 398).

### tradeoff
Why not always use map-side joins, since they're faster?
- [x] They require assumptions about input size, partitioning and sorting that may not hold; reduce-side joins work on any input, at the cost of sorting, shuffling and merging
- [ ] Map-side joins give wrong results
- [ ] They don't run on HDFS
- [ ] They need more reducers
>>>
That's the trade-off on pp. 396 and 398.

### explain
Your team keeps both `orders` and `customers` bucketed into 64 partitions by `customer_id` (same hash function), and sorted by it. A new engineer adds a third dataset `payments`, bucketed into 32 partitions by `payment_id`. Which joins can be map-side, and what would you change?
>>>
`orders` ⋈ `customers` on customer_id can be a partitioned hash join, or even a map-side merge join, since both are partitioned the same way and sorted by the same key: partition i of one only needs partition i of the other (pp. 397–398). `payments` is partitioned by a different key and number of partitions, so a join with orders on customer_id (or order_id) can't be map-side unless payments is small enough to broadcast (pp. 396–397). Otherwise it needs a reduce-side join. To enable map-side joins, have the job that produces payments repartition it by customer_id into 64 buckets with the same hash function and sort it, and record that layout in the metastore (HCatalog or Hive) so later jobs and optimizers know (p. 398).
:::

:::connect Where this goes next
Tomorrow: what all these jobs are *for*. Building search indexes and key-value stores as batch outputs, and why immutable inputs plus replaceable outputs make batch jobs easy to fix when you deploy a bug.
:::
