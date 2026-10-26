---
title: MapReduce vs Distributed Databases — Storage, Processing Models and Faults
kind: lesson
minutes: 85
chapter: 10
objectives:
- Explain what MPP databases already did before MapReduce, and the key difference in focus
- Explain diversity of storage: dumping raw data, the data lake, schema-on-read and the "sushi principle"
- Explain diversity of processing models: arbitrary code, many models on one shared cluster
- Explain MapReduce's fault-handling and memory/disk choices and the preemption environment behind them
reading:
- Comparing MapReduce to distributed databases | 402-403
- Diversity of storage | 403-404
- Diversity of processing models | 404-405
- Designing for frequent faults | 405-406
complete:
- You reproduced the book's ">50% risk" figure in the preemption calculator
- You can explain why MapReduce's design "makes less sense" on clusters without preemption
- You answered the quiz
---

:::problem Wasn't this all done before?
At the most abstract level, databases, Hadoop and operating systems all **store data and let you process and query it**. A database stores records in a data model, and a filesystem stores files, but both are "information management" systems. **Hadoop is somewhat like a distributed Unix**: HDFS is the filesystem, and MapReduce is "a quirky implementation of a Unix process (which happens to always run the sort utility between the map phase and the reduce phase)" (p. 402).

When the MapReduce paper appeared, it was in some sense **not new at all**. Its parallel processing and join algorithms had been implemented in **massively parallel processing (MPP) databases** more than a decade earlier: the Gamma database machine, Teradata, Tandem NonStop SQL. The difference is focus. **MPP databases** run analytic **SQL** queries in parallel on a cluster, while **MapReduce plus a distributed filesystem** is more like a **general-purpose operating system that can run arbitrary programs** (p. 403).
:::

:::intuition Raw files, any code, constant interruptions
**Diversity of storage** (pp. 403–404). Databases require data structured in a model. Files in a DFS are just bytes: database records, but also images, video, sensor readings, sparse matrices, feature vectors, genome sequences. "Hadoop opened up the possibility of **indiscriminately dumping data into HDFS**, and only later figuring out how to process it further." MPP databases need **careful up-front modeling** of data and query patterns before import into their proprietary format. In practice, **making data available quickly, even in a quirky raw format, is often more valuable** than deciding the ideal model up front. This is the **data lake** or "enterprise data hub", like a data warehouse in bringing data together, but without the slow schema design. Interpretation becomes the **consumer's** problem (**schema-on-read**, Chapter 2), which helps when producers and consumers are different teams. There may not even be one ideal model, only different views. This is the **sushi principle**: "raw data is better". So Hadoop is often used for **ETL**: dump raw data, clean and transform it with MapReduce, and load it into an MPP warehouse. Modeling still happens, but decoupled from collection.

**Diversity of processing models** (pp. 404–405). MPP databases are monolithic and tightly integrated (storage layout, query planning, scheduling, execution), so they perform very well on the queries they're designed for, and SQL is accessible to tools like Tableau. But **not all processing is SQL**: machine learning and recommendations, full-text indexes with relevance ranking, image analysis, feature engineering, translation models, fraud risk functions all **require code**. MapReduce let engineers run their own code over large datasets. You can build SQL on it (**Hive**), but also much more. When MapReduce proved too limiting and too slow, other models were built on Hadoop. Crucially, they **run on one shared cluster, accessing the same files on HDFS**, with no need to import data into separate specialized systems. The ecosystem includes random-access **HBase** and MPP-style **Impala**, neither using MapReduce, both using HDFS.

**Designing for frequent faults** (pp. 405–406). Batch jobs are less sensitive to faults: they don't immediately affect users, and they can be rerun. If a node crashes during a query, most MPP databases **abort the whole query** and rerun it. That's fine for queries of seconds or minutes. They also keep as much as possible **in memory** (hash joins). **MapReduce** instead tolerates a failed map or reduce task by **retrying just that task**, and is **eager to write to disk**, partly for fault tolerance and partly assuming the data won't fit in memory anyway. That suits **larger, longer jobs** likely to hit at least one task failure. But machine failures aren't that frequent. Is the overhead worth it?
:::

:::visual BatchFaultsViz | Why retry individual tasks?
@props {"initialTab":"preempt"}
**Try this:**
1. Defaults: 5% preemption risk per task-hour (Google's figure), 100 tasks of 10 minutes. More than 50% of jobs lose at least one task, matching the book.
2. Compare the two "expected lost work" lines: restarting the whole job vs retrying one task.
3. Set the risk to 0.1%, roughly hardware failures only. Does task-level recovery still pay for itself?
:::

:::details Google's environment: preemption, not flaky hardware (pp. 405–406)
MapReduce was designed for Google's **mixed-use datacenters**, where online production services and offline batch jobs share machines. Each task has an enforced **resource allocation** (CPU, RAM, disk, in containers) and a **priority**. If a higher-priority task needs resources, lower-priority tasks on that machine are **terminated (preempted)**. Priority also sets **pricing**: teams pay for resources, and high priority costs more.

That lets non-production resources be **over-committed**, since the system can reclaim them, which gives better utilization and efficiency than segregating production and non-production machines. But batch jobs run at **low priority** and "pick up the scraps under the table", so they can be preempted at any time.

At Google, an hour-long MapReduce task has about a **5% risk** of being terminated for a higher-priority process, **more than an order of magnitude higher** than failures from hardware issues, reboots and so on. So with **100 tasks of 10 minutes**, there's a **greater than 50%** risk that at least one is killed. **MapReduce tolerates frequent unexpected task termination not because the hardware is unreliable, but because the freedom to terminate processes arbitrarily enables better resource utilization.**

Among open-source schedulers, **preemption is less widely used**. YARN's CapacityScheduler supports preemption to balance queues, but general priority preemption wasn't supported in YARN, Mesos or Kubernetes at the time of writing (2016). **Where tasks aren't often terminated, MapReduce's design decisions make less sense**, which motivates the alternatives in the next lesson.
:::

:::extra Beyond the 2016 text
**Not from the book.** Kubernetes has since added Pod priority and preemption (stable since v1.14, 2019), and cloud providers sell deeply discounted *spot* or *preemptible* VMs that can be reclaimed at short notice. Both bring back the environment MapReduce was designed for: batch frameworks that run on cheap, preemptible capacity again benefit from fine-grained, task-level recovery and from checkpointing.
:::

:::quiz
### mcq
What did MPP databases like Teradata and Gamma already have more than a decade before MapReduce?
- [ ] Distributed filesystems for arbitrary files
- [x] The parallel processing and join algorithms, applied to analytic SQL queries
- [ ] Machine-learning libraries
- [ ] Preemption-based scheduling
>>>
MapReduce's novelty was being more like a general-purpose OS for arbitrary code over arbitrary files (p. 403).

### mcq
What is the "sushi principle"?
- [ ] Process data while it's fresh
- [x] "Raw data is better": dump data in raw form and decide how to interpret it later, allowing several different transformations
- [ ] Partition data into small pieces
- [ ] Always use columnar formats
>>>
It's related to data lakes and schema-on-read (pp. 403–404).

### predict
In Google's environment, a job has 100 tasks of 10 minutes each, with a 5% preemption risk per task-hour. Roughly how likely is it that at least one task is killed?
- [ ] About 5%
- [ ] About 10%
- [x] More than 50%
- [ ] About 100%
>>>
1 − (0.95^(1/6))^100 ≈ 57% (p. 406).

### mcq
Why does MapReduce write so eagerly to disk and retry individual tasks?
- [ ] Because commodity hardware fails constantly
- [x] Because in Google's mixed-use datacenters, low-priority batch tasks are frequently preempted, so task-level recovery saves rerunning whole jobs
- [ ] Because HDFS requires it
- [ ] Because memory is unreliable
>>>
Preemption risk was over an order of magnitude higher than hardware failure (p. 406).

### tradeoff
A team runs Hadoop on a dedicated cluster with no preemption and few failures. What does the book imply?
- [x] MapReduce's overhead (eager disk writes, task-level recovery) buys little there; engines that keep more in memory and recompute on rare failures are likely faster
- [ ] MapReduce is still optimal
- [ ] They should turn off HDFS replication
- [ ] They should switch to MPP databases only
>>>
"In an environment where tasks are not so often terminated, the design decisions of MapReduce make less sense" (p. 406).

### explain
Explain why "making data available quickly in a raw format is often more valuable than deciding on the ideal data model up front", and one risk of that approach.
>>>
Bringing data from across an organization into one place enables joins between previously disconnected datasets, and that's where much of the value lies (as with data warehouses). Careful up-front schema design for an MPP database slows down that collection, and there may be no single ideal model anyway, only different views for different purposes. Dumping raw data into HDFS (a data lake) gets it there fast and lets each consumer interpret it as needed (schema-on-read, the sushi principle), with modeling as a separate later ETL step (pp. 403–404). The risk is that interpreting the data becomes the consumers' problem. Without documentation or schemas, each team may parse the raw data differently and inconsistently, and an undisciplined lake can become a swamp of undocumented formats. Structured formats like Avro or Parquet with schemas reduce this (p. 402).
:::

:::connect Where this goes next
Tomorrow: beyond MapReduce. The costs of materializing every intermediate step, and dataflow engines (Spark, Tez, Flink) that pipeline operators and recover by recomputation, which only works if operators are deterministic.
:::
