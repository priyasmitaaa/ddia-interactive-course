---
title: Review — Unix, MapReduce and Joins
kind: review
minutes: 60
chapter: 10
objectives:
- Retrieve the MapReduce dataflow from memory
- Choose between hash aggregation and sorting, and spot skew
- Catch up on Exercise 36 and Lab 37
reading:
- Re-read the first half of the Chapter 10 summary | 416-417
complete:
- You did today's spaced review
- You drew Figure 10-1 from memory
- Exercise 36 and Lab 37 are done (or consciously skipped)
---

:::review Today's spaced review
Scheduled questions from Weeks 1–18.
:::

:::task Draw Figure 10-1 from memory
Draw three input blocks, three mappers, three reducers and the output. Label: where the mapper runs and why; what `hash(key) mod R` decides; what's written on mapper local disks; what the shuffle copies; what the reducer merges; where the output goes. Then add a sort-merge join on top: what each mapper emits, and the order each reducer sees records in. Check against pp. 389–394.
:::

:::quiz Week 18 checkpoint
### mcq
What is "arguably the most important aspect of MapReduce", according to the book?
- [ ] The map function
- [x] The implicit sort step between map and reduce
- [ ] HDFS replication
- [ ] Java
>>>
Sorting brings equal keys together, which is what makes reducers simple (p. 387).

### scenario
A team's job joins 2 TB of page views with a 50 MB table of page categories using a reduce-side join, and it's slow. Suggest a better approach, and say why.
>>>
The categories table is small enough to fit in every mapper's memory, so use a broadcast hash join (map-side, next week). Each mapper loads the 50 MB table into a hash table and streams its block of page views, looking up each category. There are no reducers, no sort and no shuffle of 2 TB (pp. 396–397). The reduce-side join works, but it sorts, copies and merges all 2 TB, possibly writing to disk several times (p. 396).

### mcq
Which statement about HDFS is correct?
- [ ] It requires a SAN with Fibre Channel
- [x] It pools the disks of shared-nothing machines into one filesystem, with a NameNode tracking block locations and blocks replicated or erasure-coded across machines
- [ ] It stores each file on exactly one machine
- [ ] It's a relational database
>>>
HDFS is shared-nothing: daemons on ordinary machines serve their local blocks, the NameNode tracks where blocks live, and replication or erasure coding tolerates machine and disk failures (p. 386).

### explain
Explain how "bringing related data together in the same place" also helps with fault tolerance.
>>>
Because mappers address data by key and the framework does all network communication, the application code (map and reduce functions) never talks to other machines directly. If a node crashes, the framework re-runs the affected tasks on the same immutable input and discards any partial output, without the application logic having to handle partial failures (p. 394). The code processes data that has already been lined up for it, so it can be simple, single-threaded and oblivious to the cluster.
:::
