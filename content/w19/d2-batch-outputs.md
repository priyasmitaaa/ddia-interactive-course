---
title: The Output of Batch Workflows — Indexes, Key-Value Stores and Human Fault Tolerance
kind: lesson
minutes: 80
chapter: 10
objectives:
- Explain why batch processing is neither OLTP nor analytics, and what it typically outputs
- Explain how batch jobs build search indexes, and full rebuilds vs incremental updates
- Explain why writing to a production database from inside a job is a bad idea, and the bulk-load alternative
- Explain the philosophy of batch outputs: immutable inputs, replaceable outputs, human fault tolerance
reading:
- The output of batch workflows | 398-399
- Building search indexes | 399-400
- Key-value stores as batch process output | 400-401
- Philosophy of batch process outputs | 401-402
complete:
- You can list three reasons not to write to a database from a mapper or reducer
- You can explain "human fault tolerance" with an example
- You answered the quiz
---

:::problem What's the point of all these jobs?
OLTP queries look up a few records by key, using indexes, to show to a user. Analytic queries scan many records and produce **reports**, graphs or top-10 lists for analysts and managers (Chapter 3). **Batch processing is neither.** It's closer to analytics, in that it scans large portions of a dataset, but a MapReduce workflow isn't the same as an analytic SQL query, and **its output is often not a report but some other kind of structure** (pp. 398–399).
:::

:::intuition Build the thing, then swap it in
**Search indexes** (pp. 399–400). Google's original use of MapReduce was building its search index, a workflow of **5–10 MapReduce jobs**. Google later moved away from MapReduce for this, but Hadoop MapReduce "remains a good way of building indexes for Lucene/Solr". A full-text index (Chapter 3) is, simplified, a **term dictionary** plus **postings lists** of document IDs, along with ranking, spelling and synonym data. For a fixed document set: mappers partition the documents, each reducer builds the index for its partition, and the index files are written to HDFS. Document-partitioned indexes (Chapter 6) **parallelize very well**. Querying by keyword is read-only, so the files are **immutable once created**. When documents change, one option is to **rerun the whole workflow** periodically and **replace** the old index files wholesale. That's expensive if little has changed, but very easy to reason about: "documents in, indexes out". The alternative is incremental updates, the way Lucene writes new segments and merges them in the background (Chapter 11).

**Key-value stores as output** (pp. 400–401). Machine-learning systems (spam filters, anomaly detection, image recognition) and **recommendation systems** (people you may know, related products) produce **databases** queried by the web app, for example by user ID. How does that output get from Hadoop into a database the web app can query?

**The obvious way is a bad idea.** Calling your database's client library from inside a mapper or reducer, writing one record at a time:
- A network request per record is **orders of magnitude slower** than a batch task's normal throughput, even with client batching.
- Many parallel tasks writing at batch rates can **overwhelm the database** and hurt its query performance, causing operational problems elsewhere.
- It breaks MapReduce's **all-or-nothing** output guarantee. A successful job's result is the output of running every task exactly once, even if some failed and were retried, and a failed job produces no output. External writes are **side effects that can't be hidden**: partial results become visible, and task retries and speculative execution make it messier still.

**The better way:** **build a brand-new database inside the batch job**, write it as files to the job's output directory in HDFS, and **bulk load** it into read-only serving nodes. Voldemort, Terrapin, ElephantDB and HBase bulk loading support this. Extracting a key and sorting by it is already most of the work of building an index. Read-only files are simple: **no WAL** is needed. Voldemort keeps serving the old files while copying the new ones, then **atomically switches**, and can switch back if anything goes wrong.
:::

:::details The philosophy of batch outputs (pp. 401–402)
Like Unix, batch jobs are explicit about dataflow. A program reads its input and writes its output, the **input is left unchanged**, the previous output is **completely replaced**, and there are **no other side effects**. Treating inputs as immutable and avoiding side effects gives good performance and makes jobs much easier to maintain:
- **Rolling back bad code fixes bad data.** If a bug corrupts the output, roll back the code and rerun the job, or simply switch back to the old output kept in another directory. A read/write database doesn't have this property: rolling back buggy code doesn't fix the bad data it wrote. This is **human fault tolerance**.
- **Faster feature development.** Mistakes aren't irreversible, so you can move faster. **Minimizing irreversibility** benefits agile development.
- **Automatic retries are safe.** A failed task is rescheduled on the same input. A bug fails the job after a few attempts, while a transient issue is tolerated. That's only safe because inputs are immutable and failed tasks' outputs are discarded.
- **Reuse.** The same files feed many jobs, including **monitoring jobs** that compare output with the previous run.
- **Separation of logic and wiring.** One team writes a job that "does one thing well", and other teams decide where and when to run it.

**Where Hadoop differs from Unix**: Unix tools assume untyped text, so everything parses input (`{print $7}`). Hadoop eliminates some of these low-value conversions with structured formats such as **Avro** and **Parquet** (Chapters 3 and 4), which give efficient schema-based encoding and schema evolution.
:::

:::quiz
### mcq
How does the book suggest getting a recommendation job's output into a database the web app can query?
- [ ] Have each reducer write to the production database with the client library
- [x] Build the database files inside the job, write them to HDFS, then bulk load them into read-only serving nodes that atomically switch to the new files
- [ ] Email the files to the operations team
- [ ] Use two-phase commit between Hadoop and the database
>>>
Voldemort, Terrapin, ElephantDB and HBase bulk loading work this way (pp. 400–401).

### mcq
Why is writing to an external database from inside a mapper risky for correctness, not just performance?
- [ ] Databases reject batch writes
- [x] External writes are side effects that MapReduce's all-or-nothing output guarantee can't hide, so partial results of failed or retried tasks and speculative execution become visible
- [ ] Mappers can't open network connections
- [ ] It makes the job deterministic
>>>
Job output is normally the result of running every task exactly once, which external side effects break (p. 400).

### predict
You deploy a bug that makes a nightly job produce garbage recommendations for a day. You roll back the code. What fixes the data?
- [ ] Nothing; the bad data is permanent
- [x] Rerunning the job with the old code, or switching back to the previous day's output directory, since inputs are immutable and outputs are replaced wholesale
- [ ] Restoring the production database from backup
- [ ] Manually deleting bad rows
>>>
That's human fault tolerance (p. 401).

### mcq
Why don't read-only key-value files built by batch jobs need a write-ahead log?
- [ ] They're always in memory
- [x] They're written once by the batch job and are immutable afterwards, so there are no in-place updates to make crash-safe
- [ ] Because HDFS has its own WAL
- [ ] They do need one
>>>
The data structures are simple (p. 401).

### tradeoff
Rebuilding a search index from scratch every night vs incremental updates: what's the trade-off?
- [x] A full rebuild is computationally expensive if only a few documents changed, but very easy to reason about ("documents in, indexes out"); incremental updates are cheaper but more complex (new segments plus background merging)
- [ ] Full rebuilds are always cheaper
- [ ] Incremental updates are impossible with Lucene
- [ ] There's no difference
>>>
Incremental processing is developed further in Chapter 11 (pp. 399–400).

### explain
Explain "human fault tolerance" and why read/write databases lack it.
>>>
Human fault tolerance means the system can recover from human mistakes, especially buggy code, not just from hardware faults (p. 401). In batch processing, inputs are immutable and outputs are derived and replaced wholesale. If buggy code produces wrong output, you roll back the code and rerun the job, or switch back to a previous output version you kept, and the result is correct again. Nothing irreversible happened to the source data. In a read/write database, buggy code *mutates* the stored data. Rolling back the code stops new damage but does nothing to repair rows already overwritten or deleted. You'd need backups, audit logs or manual repair. Minimizing irreversibility like this also lets teams develop features faster (pp. 401–402).
:::

:::connect Where this goes next
Tomorrow: Hadoop vs the MPP databases that came a decade earlier, and the surprising reason MapReduce writes so eagerly to disk: Google's datacenters preempt low-priority tasks all the time.
:::
