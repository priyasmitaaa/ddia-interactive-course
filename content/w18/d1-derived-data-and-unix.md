---
title: Derived Data, Batch Processing and the Unix Log Pipeline
kind: lesson
minutes: 85
chapter: 10
objectives:
- Distinguish systems of record from derived data systems, and explain why the distinction clarifies dataflow
- Distinguish services, batch processing systems and stream processors by their performance measure
- Read and modify the Unix log-analysis pipeline, and explain each stage
- Explain when in-memory aggregation works and when sorting is better, by working-set size
reading:
- Part III introduction; systems of record and derived data | 375-376
- Batch processing; three kinds of systems | 377-379
- Batch processing with Unix tools; simple log analysis | 379-381
- Sorting vs in-memory aggregation | 381-382
complete:
- You stepped through every stage of the pipeline in the visualization and changed what it counts
- You can say when the Ruby script beats the Unix pipeline, and when it doesn't
- You answered the quiz
---

:::problem One database is never enough
Parts I and II assumed **one database** in the application. In reality, a large application needs to access and process data in many ways, and no single database satisfies all those needs at once. Applications combine several datastores, indexes, caches and analytics systems, with mechanisms that move data from one to another. Vendors who claim their product can satisfy all your needs overlook this, but "integrating disparate systems is one of the most important things that needs to be done in a non-trivial application" (p. 375).
:::

:::intuition Two kinds of data, three kinds of system
**Systems of record and derived data** (p. 376):
- A **system of record** (source of truth) holds the **authoritative** version of your data. New data such as user input is written there first. Each fact is represented exactly once, typically normalized. If another system disagrees, the system of record is by definition correct.
- A **derived data system** holds data produced by transforming data from another system. **If you lose it, you can re-create it.** Examples: caches, denormalized values, indexes, materialized views, and recommendation data derived from usage logs.

Derived data is technically **redundant**, but it's often essential for good read performance, and you can derive several datasets from one source to look at the data from different "points of view". Most databases aren't inherently either kind. **The distinction depends on how you use the tool.** Being explicit about which data is derived from which clarifies dataflow (inputs, outputs, dependencies). That is a running theme of Part III.

**Three kinds of system** (pp. 377–378):
- **Services (online)** wait for a request and respond as quickly as possible. The main measure is **response time**, and availability matters a lot.
- **Batch processing (offline)** takes a large amount of input, runs a **job**, and produces output. Jobs take minutes to days, nobody is waiting, and they're often scheduled (say, daily). The main measure is **throughput**.
- **Stream processing (near-real-time)** sits in between. It consumes inputs and produces outputs like batch, but operates on events **shortly after they happen**, so latency is lower. That's Chapter 11.

**MapReduce** (2004) was called, perhaps over-enthusiastically, "the algorithm that makes Google so massively scalable", and it was implemented in Hadoop, CouchDB and MongoDB. In some ways it's a step *backwards* from the parallel techniques data warehouses had years earlier, and its importance is declining, but it shows clearly why and how batch processing is useful. Batch processing is very old: Hollerith tabulating machines in the 1890 US Census, and IBM card sorters in the 1940s–50s that resemble MapReduce uncannily (p. 378).
:::

:::visual PipelineViz | The log-analysis pipeline, stage by stage
**Try this:**
1. Click the stages from left to right and watch the data change shape: raw lines, then URLs, sorted URLs, `count URL` lines, ranked, then the top 5.
2. Switch to **top client IPs** (`awk '{print $1}'`) and **pages, no CSS** (`$7 !~ /\.css$/`). The book's two modifications (p. 380) change only one stage.
3. In the lower panel, push **distinct URLs** up until the hash table no longer fits in memory. Sorting is unaffected.
:::

:::details The pipeline and the two execution strategies (pp. 379–382)
An nginx access log line records the client IP, time, request (`GET /css/typography.css`), status, response size, referrer and user agent. To find the **five most popular pages**:

```
cat /var/log/nginx/access.log |
  awk '{print $7}' |
  sort             |
  uniq -c          |
  sort -r -n       |
  head -n 5
```

Read the log, extract the 7th whitespace-separated field (the URL), sort alphabetically so repeats become adjacent, collapse adjacent repeats into a count (`uniq -c`), sort numerically descending, and keep the first 5. (Footnote i: `cat` is unnecessary, but it makes the linear pipeline clearer.) It processes **gigabytes in seconds** and is easy to adapt. Surprisingly many analyses can be done in minutes with awk, sed, grep, sort, uniq and xargs, and they perform surprisingly well.

**A custom program** (p. 381): a Ruby script with a hash table `counts[url] += 1`, then sorting the table by count. It's less concise but readable. The real difference is the **execution flow**.

**Sorting vs in-memory aggregation.** The Ruby script keeps a hash table of URLs to counts. The pipeline has no hash table and relies on sorting repeated URLs. Which is better depends on **how many distinct URLs** there are. The script's **working set** (memory needing random access) depends only on the number of *distinct* URLs: a million hits on one URL still take one entry. For most small and mid-sized sites, that fits in about 1 GB, even on a laptop. If the working set is **larger than memory**, sorting wins. It can make efficient use of disks: sort chunks in memory, write them out as segment files, and merge the sorted segments, the same principle as SSTables and LSM-trees (Chapter 3). Mergesort's sequential access performs well on disks. **GNU sort** spills to disk automatically and parallelizes across CPU cores, so the simple pipeline scales to large datasets. The bottleneck is likely reading the input from disk (p. 382).
:::

:::quiz
### mcq
Which statement about derived data is correct?
- [ ] Derived data is the authoritative source of truth
- [x] Derived data can be re-created from its source if lost; caches, indexes and materialized views are examples
- [ ] A database is either a system of record or derived, by its design
- [ ] Derived data must always be normalized
>>>
Whether a store is a system of record or derived depends on how you use it, not on the tool (p. 376).

### mcq
What is the primary performance measure of a batch job?
- [ ] Response time
- [ ] Availability
- [x] Throughput: how long it takes to process an input dataset of a given size
- [ ] Number of concurrent users
>>>
No user is waiting for a batch job, so the question is how fast it gets through the data (p. 378).

### predict
A log has 10 billion lines but only 5,000 distinct URLs. Which approach is the better fit, and why?
- [ ] Sorting, since the input is huge
- [x] The in-memory hash table, since the working set is just 5,000 entries however long the log is
- [ ] Neither works
- [ ] Both need 10 billion entries in memory
>>>
The working set depends only on the number of distinct keys (p. 381).

### mcq
Why does `uniq -c` need its input to be sorted?
- [ ] It doesn't
- [x] It only compares adjacent lines, so repeated URLs must be next to each other to be counted together
- [ ] Because it uses binary search
- [ ] To remove whitespace
>>>
Sorting brings equal keys together, the same idea MapReduce relies on (pp. 380, 387).

### tradeoff
Why does GNU sort scale to datasets larger than memory?
- [x] It sorts chunks in memory, spills them to disk as sorted segments, and merges them with sequential I/O, using multiple cores
- [ ] It compresses everything in memory
- [ ] It uses a hash table
- [ ] It sends data to a cluster
>>>
The same principle as SSTables and LSM-trees (pp. 381–382).

### explain
Explain, with an example from your own work or studies, the difference between a system of record and a derived data system, and why making it explicit helps.
>>>
A good answer names an authoritative store where data is first written, for example the orders table in PostgreSQL. It then names something derived from it: a search index of products, a cache of order summaries, a nightly sales aggregate, or a recommendations table. The derived data can be rebuilt from the source if it's lost or corrupted, and if the two disagree, the system of record wins. Making this explicit clarifies which components are inputs and outputs and how they depend on each other, tells you what to back up and what can be rebuilt, and shows what must be updated or recomputed when source data changes (p. 376). This is the running theme of Part III.
:::

:::connect Where this goes next
Tomorrow: why this little pipeline works so well. The Unix philosophy, uniform interfaces, separating logic from wiring, and immutable inputs, all of which carry straight over to MapReduce.
:::
