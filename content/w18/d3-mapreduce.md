---
title: MapReduce and Distributed Filesystems
kind: lesson
minutes: 95
chapter: 10
objectives:
- Explain how HDFS provides a shared-nothing distributed filesystem, and contrast it with NAS/SAN and object stores
- Map the four steps of the log pipeline onto map, sort and reduce
- Explain distributed execution: input splits, putting the computation near the data, hash-partitioned reducers, and the shuffle
- Explain MapReduce workflows, why outputs are only valid after a job completes, and the role of workflow schedulers
reading:
- MapReduce and distributed filesystems; HDFS | 385-386
- MapReduce job execution | 387-388
- Distributed execution of MapReduce | 388-390
- MapReduce workflows | 390-391
complete:
- You stepped through all four phases in the MapReduce visualization with 1, 2 and 3 reducers
- You can explain the shuffle without saying "random"
- You answered the quiz
---

:::problem Unix tools, but on thousands of machines
MapReduce is "a bit like Unix tools, but distributed across potentially thousands of machines". It's similarly **blunt, brute-force, but surprisingly effective**. A single MapReduce job is comparable to a single Unix process: one or more inputs and one or more outputs. Running a job normally **doesn't modify its input** and has **no side effects** other than producing output. Output files are written **once, sequentially**. Where Unix tools use stdin and stdout, MapReduce jobs read and write files on a **distributed filesystem**, which in Hadoop is **HDFS**, an open-source reimplementation of Google's GFS (pp. 385–386).
:::

:::intuition Map, sort, reduce
**HDFS** (p. 386) is **shared-nothing**. Every machine's attached disks are pooled into one big filesystem. A daemon on each machine serves its blocks over the network, and a central **NameNode** tracks which blocks are where. To tolerate failures, blocks are **replicated**, as full copies or with **erasure coding** (Reed–Solomon), which recovers lost data with less storage overhead, like RAID but over an ordinary datacenter network. This contrasts with **NAS/SAN**, which provide shared storage from a central appliance with custom hardware such as Fibre Channel. The largest deployments run on tens of thousands of machines with hundreds of petabytes, made viable by cheap commodity hardware and open source. Others: GlusterFS, Quantcast File System. **Object stores** (Amazon S3, Azure Blob Storage, OpenStack Swift) are similar in many ways. (Footnote iv: HDFS can schedule computation on the machine that stores the data, while object stores usually separate storage and compute. With erasure coding, that locality advantage is lost.)

**Job execution** (pp. 387–388). The pattern is the log pipeline's:
1. Read input files and break them into **records** (lines).
2. **Extract a key and value** from each record (`awk '{print $7}'`). This is the **mapper**.
3. **Sort** all key-value pairs by key (the first `sort`). **This step is implicit**, because mapper output is always sorted before the reducer sees it. It's "arguably the most important aspect of MapReduce".
4. **Iterate** over sorted pairs, combining adjacent values with the same key (`uniq -c`). This is the **reducer**, called with a key and an iterator over its values.

A mapper may emit zero or more pairs per record. A second sort, like ranking by count, needs **a second MapReduce job** that takes the first job's output. The mapper prepares data for sorting, and the reducer processes sorted data.
:::

:::visual MapReduceViz | Figure 10-1, phase by phase
**Try this:**
1. **Map**: each of the three mappers turns its block's URLs into `(url, 1)` pairs.
2. **Partition + sort**: each mapper splits its output into one sorted file per reducer, using `hash(key) mod R`.
3. **Shuffle + merge**: reducer *r* downloads file *r* from every mapper and merges them. All `/favicon.ico` pairs end up together on one reducer.
4. **Reduce**: one call per key.

Change the number of reducers. The output files change, but the counts never do.
:::

:::details Distributed execution and workflows (pp. 388–391)
**Parallelism without parallel code.** Map and reduce functions see one record or one key at a time and don't know where their input came from or where their output goes, so the framework handles moving data between machines. Standard Unix tools *can* be mappers and reducers, but usually they're functions in a conventional language: a Java class in Hadoop, JavaScript in MongoDB and CouchDB.

**Figure 10-1.** Parallelization is based on **partitioning** (Chapter 6). The job's input is an HDFS directory, and each file or block is a partition processed by a separate **map task**. Files are typically hundreds of megabytes. The scheduler tries to run each mapper on a machine that stores a replica of its input, if that machine has spare RAM and CPU. This is **putting the computation near the data**, which saves network transfer and increases locality. The framework first copies the code (for example JAR files) to the machines.

**The reduce side is partitioned too.** The number of map tasks is set by the number of input blocks, while the number of reduce tasks is configured by the job author. To get all pairs with the same key to the same reducer, the framework uses a **hash of the key** (Chapter 6). The data is too large to sort on one machine, so sorting happens in **stages**. Each mapper partitions its output by reducer and writes each partition to a **sorted file on its local disk**, SSTable-style. When a mapper finishes, the scheduler tells the reducers, which **connect to each mapper and download** their partition's sorted file. Partitioning by reducer, sorting and copying is called the **shuffle**, a confusing term since there is no randomness. The reducer **merges** the files, preserving sort order, so the same key from different mappers is adjacent. It's called with a key and an iterator, which may be bigger than memory, and writes output to HDFS: one copy on local disk plus replicas (pp. 389–390).

**Workflows** (pp. 390–391). One job is limited. It can count page views per URL, but ranking needs a second sort. Jobs are chained into **workflows**, with one job's output becoming the next job's input. Hadoop has no special support for this. Chaining is done **by directory name**: job 1 writes to a directory, and job 2 is configured to read it. So it's less like a Unix pipe, which uses a small in-memory buffer, and **more like writing each command's output to a temporary file** (the trade-offs come in Week 19). A job's output is valid only when the job completes successfully, since MapReduce discards the partial output of failed jobs. So a job may start only when the jobs producing its inputs have completed. **Workflow schedulers** manage these dependencies: Oozie, Azkaban, Luigi, Airflow, Pinball. Recommendation systems commonly have workflows of **50–100 jobs**, and different teams consume each other's output. Higher-level tools (Pig, Hive, Cascading, Crunch, FlumeJava) set up multi-stage workflows automatically.
:::

:::quiz
### mcq
In the log-analysis analogy, which Unix command corresponds to the mapper?
- [ ] sort
- [x] awk '{print $7}', which extracts a key (and value) from each record
- [ ] uniq -c
- [ ] head
>>>
uniq -c is effectively the reducer, and the first sort is the implicit sort step (p. 387).

### mcq
What decides which reducer receives a given key?
- [ ] The mapper's machine
- [ ] A random choice
- [x] A hash of the key, modulo the number of reduce tasks configured by the job author
- [ ] The order in which keys arrive
>>>
This guarantees that all pairs with the same key reach the same reducer (p. 389).

### predict
A job has 200 input blocks and the author configures 10 reducers. How many map tasks run, and how many sorted files does each mapper write?
- [ ] 10 map tasks, 200 files each
- [x] 200 map tasks (one per block), each writing up to 10 sorted files (one per reducer partition)
- [ ] 200 map tasks, 1 file each
- [ ] 10 map tasks, 10 files each
>>>
Map tasks follow input blocks, and each partitions its output by reducer (pp. 389–390).

### mcq
Why is it called "the shuffle"?
- [ ] Because records are shuffled randomly
- [x] It's the name for partitioning by reducer, sorting, and copying partitions from mappers to reducers; despite the name there's no randomness
- [ ] Because reducers are chosen randomly
- [ ] Because data is encrypted
>>>
The shuffle is deterministic: keys go to reducers by hash, and every reducer fetches its sorted partition from every mapper. Unlike shuffling a deck of cards, nothing is random (p. 390).

### tradeoff
Why does the scheduler try to run each mapper on a machine that holds a replica of its input block?
- [x] Putting the computation near the data avoids copying input over the network, reducing network load and increasing locality
- [ ] Because HDFS forbids remote reads
- [ ] To balance CPU usage
- [ ] For security
>>>
Footnote iv: object stores usually separate compute and storage, which loses this advantage (pp. 386, 389).

### explain
Explain why chained MapReduce jobs are "less like pipelines of Unix commands, and more like a sequence of commands where each command's output is written to a temporary file".
>>>
In a Unix pipeline, processes run concurrently and pass data through a small in-memory buffer, so the next command consumes output as soon as it's produced. In Hadoop, each job in a workflow is independent. Job 1 writes its complete output to a directory in HDFS, replicated and durable, and job 2 is configured to read that directory and can start only after job 1 has completed successfully, because partial output of an unfinished or failed job isn't valid (pp. 390–391). So intermediate state is fully materialized to a "temporary file", in fact a replicated distributed one, between stages. That makes restarts easy and decouples teams, but it adds latency and I/O. Dataflow engines later address this (p. 407).
:::

:::connect Where this goes next
Tomorrow: what MapReduce is actually *for*. Joins and grouping in batch, "bringing related data together in the same place", and how a single celebrity can make one reducer the bottleneck.
:::
