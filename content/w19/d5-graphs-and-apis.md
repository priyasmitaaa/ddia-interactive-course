---
title: Graphs and Pregel, High-Level APIs, and the Chapter 10 Summary
kind: lesson
minutes: 110
chapter: 10
objectives:
- Explain why iterative graph algorithms are inefficient in MapReduce
- Explain the Pregel/BSP model: vertex state, messages, supersteps, fault tolerance and parallel execution
- Explain why distributed graph processing has high communication overhead, and when a single machine wins
- Explain how high-level APIs and declarative features (optimizers, column pruning, vectorization) make batch frameworks resemble MPP databases
- Summarize Chapter 10: partitioning, fault tolerance, join algorithms and bounded inputs
reading:
- Graphs and iterative processing | 411-412
- The Pregel processing model; fault tolerance; parallel execution | 412-414
- High-level APIs and languages | 414-415
- The move towards declarative query languages | 415-416
- Specialization for different domains | 416-416
- Summary | 416-418
complete:
- You ran shortest paths and PageRank to completion in the Pregel visualization
- Exercise 39 (Pregel) is done
- You answered the quiz
---

:::problem "Repeat until done"
Chapter 2 used graphs OLTP-style: quickly find a few vertices. Batch graph processing analyzes the **whole graph**, for recommendation engines, ranking systems, and **PageRank**, which estimates a page's popularity from the pages linking to it (p. 411). (Box, p. 412: dataflow engines arrange *operators* as a DAG, while in graph processing the *data* is a graph. Another unfortunate naming confusion.)

Many graph algorithms **traverse one edge at a time**, joining a vertex with its neighbors to propagate information, **repeating until a condition is met**: no more edges to follow, or a metric converges. Figure 2-6's "all locations in North America" is an example (a **transitive closure**). A graph can be stored in HDFS as files of vertices and edges, but plain MapReduce makes **one pass** over the data. Iteration needs an external scheduler running one batch job per step and checking for completion. That works, but it's **very inefficient**: every iteration reads the entire input and writes an entirely new output, even if only a small part of the graph changed (p. 412).
:::

:::intuition Think like a vertex
The **bulk synchronous parallel (BSP)** model, also called the **Pregel model** after Google's paper, is implemented by **Apache Giraph**, **Spark's GraphX** and **Flink's Gelly** (p. 412).

In MapReduce, mappers "send a message" to a reduce call. In Pregel, **one vertex sends a message to another**, usually along an edge. **In each iteration (superstep), a function is called for each vertex with all the messages sent to it**, much like a reduce call. The difference: **a vertex remembers its state in memory between iterations**, so it only processes new incoming messages, and **if no messages are sent in part of the graph, no work is done there** (pp. 412–413). It's a bit like the actor model, except vertex state and messages are **fault tolerant and durable**, and communication proceeds in **fixed rounds**: each iteration delivers all messages sent in the previous one.

**Fault tolerance** (p. 413). Vertices communicate *only* by messages, which can be batched, so there's little waiting. The only wait is **between iterations**: all messages of one iteration must be delivered before the next begins. Even though the network may drop, duplicate or delay messages, Pregel guarantees messages are **processed exactly once at their destination** in the next iteration. Recovery: **checkpoint all vertex state** at the end of an iteration. On failure, roll the whole computation back to the last checkpoint, or, if the algorithm is deterministic and messages are logged, recover only the lost partition.

**Parallel execution** (pp. 413–414). A vertex sends messages to a vertex ID, and the framework decides placement and routing. Ideally, chatty vertices would be co-located, but finding such a partitioning is hard, so graphs are often just **hash-partitioned by vertex ID**. So there's a lot of **cross-machine communication**, and the intermediate state (messages) is often **bigger than the graph itself**. **If your graph fits in memory on one computer, a single-machine, maybe single-threaded, algorithm will quite likely outperform a distributed batch process.** If it fits on one machine's disks, **GraphChi** is viable. Only if it's too big for one machine is Pregel unavoidable. Efficient parallel graph algorithms are ongoing research.
:::

:::visual PregelViz | Supersteps on a small graph
**Try this:**
1. **Shortest paths from A**: press *Next superstep* repeatedly. Only vertices with messages (red rings) do work, and the job stops when nothing is in flight.
2. Count the cross-machine messages. Orange edges cross between the two hash partitions.
3. **PageRank**: every vertex is active in every superstep. Watch the ranks settle and the sum stay at 1.
:::

:::details High-level APIs, declarative queries, specialization, and the summary (pp. 414–418)
**High-level APIs and languages** (pp. 414–415). Operating batch jobs at petabyte scale on 10,000+ machines is now considered "more or less solved", so attention turned to the programming model, efficiency, and the range of problems. Hive, Pig, Cascading and Crunch made hand-written MapReduce unnecessary, and could move to Tez without rewriting. Spark and Flink have their own high-level dataflow APIs, inspired by **FlumeJava**. They use **relational-style building blocks**: join on a field, group by key, filter, and aggregate (count, sum). These are implemented internally with this chapter's join and grouping algorithms. Besides less code, they allow **interactive use** in a shell, which is reminiscent of the Unix philosophy.

**The move towards declarative query languages** (pp. 415–416). Specifying joins as relational operators lets the framework **choose the join algorithm automatically**: Hive, Spark and Flink have **cost-based query optimizers** that can also reorder joins to minimize intermediate state. You needn't remember all the join algorithms. But MapReduce and its successors are still built on **function callbacks** that can call arbitrary code, which gives access to huge library ecosystems for parsing, NLP, image analysis and statistics. That freedom long distinguished them from MPP databases, whose UDFs are cumbersome and poorly integrated with package managers like Maven, npm or RubyGems. Declarative features also help elsewhere. If a callback is just a simple filter or field selection, calling it per record costs CPU. Expressed declaratively, the optimizer can use **column-oriented storage** to read only the needed columns, and **vectorized execution** (tight, cache-friendly loops without function calls). Spark generates JVM bytecode and Impala uses LLVM for native code. **Batch frameworks begin to look like MPP databases**, with comparable performance, while keeping their flexibility.

**Specialization for different domains** (p. 416). Common patterns deserve reusable implementations. MPP databases served business intelligence, but **machine learning** needs statistical and numerical algorithms: **Mahout** on MapReduce, Spark and Flink, and **MADlib** inside an MPP database (Greenplum). Also spatial algorithms like **k-nearest neighbors** (similarity search), and approximate string matching for **genome analysis**. As batch systems gain declarative operators and MPP databases become more programmable, "the two are beginning to look more alike: in the end, they are all just systems for storing and processing data".

**Chapter 10 summary** (pp. 416–418):
- Unix design principles carry into MapReduce and dataflow engines: **immutable inputs**, outputs meant as input to another, unknown program, and **composing small tools** that do one thing well. Unix's uniform interface is files and pipes, and MapReduce's is a **distributed filesystem**. Dataflow engines add pipe-like transport for intermediate state, but initial input and final output usually live on HDFS.
- The two main problems are **partitioning** (bringing related data together: mappers by input block, output repartitioned, sorted and merged into reducer partitions, and dataflow engines avoid sorting unless required) and **fault tolerance** (MapReduce writes to disk often for easy task recovery but slower normal execution, while dataflow engines keep more in memory and recompute more on failure, which **deterministic operators** reduce).
- **Join algorithms**: sort-merge, broadcast hash and partitioned hash.
- **A deliberately restricted programming model**: stateless callbacks with no externally visible side effects other than designated output. This lets the framework hide hard distributed-systems problems: retry tasks safely, discard failed tasks' output, and show only one attempt's output when several succeed. The final output is **the same as if no faults had occurred**, "much stronger" semantics than online services that write to databases as a side effect.
- **Bounded input**: a batch job's input has a known, fixed size, so the job knows when it's done. In **stream processing**, the input is **unbounded** and the job is never complete. That's next.
:::

:::practice 39-pregel | Think like a vertex
Build a BSP engine, run shortest paths and connected components on it, check them against Dijkstra and BFS, and measure cross-machine messages under two partitioners.
:::

:::quiz
### mcq
Why is an iterative graph algorithm inefficient as a sequence of MapReduce jobs?
- [ ] MapReduce can't read graphs
- [x] Each iteration is a separate job that reads the entire input and writes an entirely new output, even if only a small part of the graph changed
- [ ] MapReduce has no sort
- [ ] Graphs don't fit in HDFS
>>>
That's p. 412. Pregel keeps vertex state in memory and only processes vertices with messages.

### mcq
What guarantee does Pregel give about messages, even though the network may drop or duplicate them?
- [ ] At most once
- [x] Messages sent in one iteration are processed exactly once at their destination vertex in the next iteration
- [ ] Messages may arrive any time later
- [ ] No guarantees
>>>
The framework hides network faults from the algorithm (p. 413).

### predict
Your social graph has 50 million vertices and 2 billion edges and fits in 256 GB of RAM on one large server. A colleague proposes a 40-node Giraph cluster. What does the book suggest?
- [ ] The cluster will be much faster
- [x] A single-machine algorithm is quite likely to outperform it, because distributed graph processing suffers heavy cross-machine messaging
- [ ] It doesn't matter
- [ ] Graphs must always be distributed
>>>
If the graph fits in memory on one computer, go single-machine (p. 414).

### mcq
Which advantage do declarative APIs give batch frameworks?
- [ ] They remove the need for HDFS
- [x] The optimizer can pick join algorithms and join order, read only the needed columns, and use vectorized execution, which brings performance close to MPP databases
- [ ] They prevent all failures
- [ ] They forbid user-defined functions
>>>
pp. 415–416. Frameworks keep the ability to run arbitrary code too.

### tradeoff
The summary says batch frameworks have "a deliberately restricted programming model". What's restricted, and what does it buy?
- [x] Callbacks must be stateless with no externally visible side effects besides their designated output; in exchange, the framework can retry tasks safely and discard failed output, so the final output is as if no faults had occurred
- [ ] Only SQL is allowed; in exchange, it's faster
- [ ] Only one reducer; in exchange, ordering
- [ ] No joins; in exchange, simplicity
>>>
Those semantics are much stronger than typical online services (p. 418).

### explain
Explain the difference between a batch job's input and a stream processor's input, and why it matters for knowing when a job is done.
>>>
A batch job's input is **bounded**: it has a known, fixed size, such as a set of log files at some point in time or a snapshot of a database. So the job knows when it has read all of its input, and it eventually completes. Its output can then be published as a whole (p. 418). A stream processor's input is **unbounded**: a never-ending stream of events. The job is never complete, since more work may always arrive. That changes how you think about results (they're continuously updated), about operations that need all the data (such as sorting, or "the total" for a period), and about fault tolerance, since you can't just rerun a finished job. Chapter 11 explores these consequences.
:::

:::connect Where this goes next
Tomorrow's Chapter 10 checkpoint. Then Chapter 11: stream processing, which takes these ideas (logs, immutable inputs, derived outputs) and applies them to never-ending data.
:::
