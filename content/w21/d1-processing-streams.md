---
title: Processing Streams — CEP, Analytics, Materialized Views and Search
kind: lesson
minutes: 80
chapter: 11
objectives:
- Name the three things you can do with a stream, and how stream operators relate to batch jobs
- Explain why sorting, sort-merge joins and restart-from-scratch don't carry over to streams
- Explain complex event processing and how it inverts queries and data
- Explain stream analytics, windows and probabilistic algorithms, and why streams aren't inherently approximate
- Explain maintaining materialized views and search on streams, and how stream processing differs from actor-style messaging
reading:
- Processing streams | 448-449
- Uses of stream processing; complex event processing | 449-450
- Stream analytics | 450-451
- Maintaining materialized views; search on streams | 451-452
- Message passing and RPC | 452-452
complete:
- You can classify five example applications as CEP, analytics, materialized view, or search on streams
- You can explain why "a stream never ends" changes fault tolerance
- You answered the quiz
---

:::problem You have a stream. Now what?
We've covered where streams come from (user activity, sensors, database writes) and how they're transported (direct messaging, brokers, event logs). Broadly, there are **three things you can do** with one (p. 448):
1. **Write it to a storage system** (database, cache, search index) for others to query, which keeps it in sync with the rest of the system (Figure 11-5), especially if the stream consumer is the only writer. This is the streaming equivalent of batch outputs (Chapter 10).
2. **Push it to users**: email alerts, push notifications, a real-time dashboard. A human is the final consumer.
3. **Process one or more input streams into one or more output streams**, possibly through a pipeline of stages, ending eventually at option 1 or 2.

This lesson is about option 3. A piece of code that processes streams is an **operator** or **job**. It's closely related to Unix processes and MapReduce jobs: it reads input streams **read-only** and writes output **append-only** somewhere else. Partitioning and parallelization patterns are very similar to MapReduce and dataflow engines, and mapping and filtering work the same (pp. 448–449).
:::

:::intuition The crucial difference: it never ends
"**The one crucial difference to batch jobs is that a stream never ends**" (p. 449). That has consequences:
- **Sorting** doesn't make sense on an unbounded dataset, so **sort-merge joins don't apply**.
- **Fault tolerance** must change. A batch task that's been running a few minutes can simply restart from the beginning, but a stream job running for **several years** can't.

**Uses of stream processing** (pp. 449–452):
- **Monitoring and alerting**, the long-standing use. Fraud detection notices that a card's usage pattern has changed and blocks it. Trading systems examine price changes and execute trades by rule. Manufacturing monitors machine status, and military and intelligence systems watch for signs of attack. These need sophisticated pattern-matching and correlation.
- **Complex event processing (CEP)**, from the 1990s, searches for **patterns of events**, the way a regular expression finds patterns of characters. Patterns are described in a declarative language (SQL-like) or a GUI. The engine keeps a **state machine** and emits a **complex event** when a pattern matches. **CEP reverses the relationship between queries and data**: a database stores data persistently and treats queries as transient, while a CEP engine **stores queries long-term** and lets events flow past them. Implementations: Esper, IBM InfoSphere Streams, Apama, TIBCO StreamBase, SQLstream.
- **Stream analytics** is less about specific sequences and more about **aggregations and statistics**: the rate of an event type per interval, a **rolling average**, or comparing with previous periods to spot trends or alert on unusual values, such as "average QPS and p99 response time over the last 5 minutes". The interval is a **window**. Averaging over a few minutes smooths out irrelevant second-to-second fluctuations while staying timely. **Probabilistic algorithms** help: Bloom filters for set membership, **HyperLogLog** for cardinality, and percentile estimators. They give approximate results with much less memory, which makes some people believe stream processing is always lossy. That's wrong: "**there is nothing inherently approximate about stream processing**". Frameworks: Apache Storm, Spark Streaming, Flink, Concord, Samza, Kafka Streams. Hosted: Google Cloud Dataflow, Azure Stream Analytics.
:::

:::visual StreamTimeViz | A taste of tomorrow: windows depend on time
@props {"initialTab":"windows"}
Stream analytics aggregates over **windows**. Click through the four window types on the same events. Tomorrow's lesson explains why deciding *which* time to use for these windows is surprisingly hard.
:::

:::details Materialized views, search on streams, and actors (pp. 451–452)
**Maintaining materialized views** (p. 451). Change streams that keep caches, search indexes and warehouses up to date are specific cases of **maintaining materialized views** (Chapter 3's data cubes and materialized views): deriving an alternative, efficiently queryable view of a dataset and updating it whenever the underlying data changes. Event-sourced application state is also a materialized view. Unlike analytics, you usually can't look only at events in a time window. Building the view needs **all events ever**, perhaps after log compaction. "In effect, you need a window that stretches all the way back to the beginning of time." Any stream processor could do it in principle, but keeping events forever runs counter to the assumptions of some analytics-oriented frameworks. **Samza** and **Kafka Streams** support it, building on Kafka's log compaction.

**Search on streams** (pp. 451–452). Besides CEP's multi-event patterns, you sometimes need to match **individual events against complex criteria**, such as full-text queries. Media monitoring subscribes to news feeds and searches for mentions of companies, products or topics. Real-estate sites notify users when a new property matching their saved search appears. Conventional search engines index documents and run queries over the index. Searching a stream **turns this on its head**: **the queries are stored, and the documents run past them**. Testing every document against every query gets slow with many queries, so you can **index the queries** as well, to narrow down which ones may match.

**Message passing and RPC** (p. 452). Actor frameworks and message-passing systems also use messages and events, but we don't usually call them stream processors:
- Actors are mainly a mechanism for **managing concurrency and distributed execution** of communicating modules, while stream processing is mainly a **data management** mechanism.
- Actor communication is often **ephemeral and one-to-one**, while event logs are **durable and multi-subscriber**.
- Actors can communicate in arbitrary ways, including **cyclic** request/response, while stream processors are usually **acyclic pipelines**, with each stream the output of one job derived from well-defined inputs.

There's some crossover. **Apache Storm's distributed RPC** farms user queries out to nodes that also process event streams, interleaving queries with events and aggregating results back to the user. You can build stream processors on actor frameworks, but examine the fault-tolerance guarantees carefully.
:::

:::quiz
### mcq
Why don't sort-merge joins apply to stream processing?
- [ ] Streams have no keys
- [x] Sorting requires the whole input, and a stream never ends
- [ ] Streams are always small
- [ ] Sort-merge joins need HDFS
>>>
The unbounded nature of streams rules out operations that need all the input (p. 449).

### mcq
How does complex event processing invert the relationship between queries and data?
- [ ] It stores data forever and discards queries
- [x] Queries (patterns) are stored long-term, and events flow past them in search of matches, the opposite of a database, which stores data and treats queries as transient
- [ ] It runs queries in batch
- [ ] It doesn't use queries
>>>
A CEP engine keeps patterns registered for a long time and matches each passing event against them, the reverse of a database (p. 450).

### predict
A team says: "Our stream processor uses HyperLogLog for unique visitors, so stream processing is inherently approximate." Is that right?
- [ ] Yes, streams can never be exact
- [x] No: probabilistic algorithms are an optional memory-saving choice, and there's nothing inherently approximate about stream processing
- [ ] Yes, because of network delays
- [ ] Only for windows longer than a day
>>>
Approximation is a memory-saving choice for some analytics, not a property of streams, which can be processed exactly (pp. 450–451).

### mcq
Which use of stream processing needs a "window that stretches all the way back to the beginning of time"?
- [ ] Rolling averages over 5 minutes
- [ ] Fraud detection on recent transactions
- [x] Maintaining a materialized view or event-sourced state, which needs all events ever (perhaps after compaction)
- [ ] CEP pattern matching
>>>
That's p. 451. Samza and Kafka Streams support it via Kafka log compaction.

### tradeoff
A real-estate site has 2 million saved searches, and 50,000 new listings arrive per day. How should "notify me of matching listings" work?
- [x] Search on streams: store the saved queries, run each new listing past them, and index the queries themselves so each listing is only tested against plausible matches
- [ ] Re-run all 2 million searches over the full index every minute
- [ ] Email every user every listing
- [ ] Use a batch job once a month
>>>
"The queries are stored, and the documents run past the queries", and indexing the queries optimizes it (pp. 451–452).

### explain
Give three ways stream processors differ from actor frameworks, and one area of overlap.
>>>
(1) Purpose: actor frameworks manage concurrency and distributed execution of communicating modules, while stream processing is a data management mechanism. (2) Durability and audience: actor messages are often ephemeral and one-to-one, while event logs are durable and multi-subscriber. (3) Topology: actors can communicate in arbitrary, even cyclic request/response patterns, while stream processors are usually acyclic pipelines in which each stream is the output of a particular job derived from well-defined inputs (p. 452). Overlap: Storm's distributed RPC interleaves user queries with event streams on the same nodes and aggregates results back, and stream processors can be built on actor frameworks, though their fault-tolerance guarantees need checking (p. 452).
:::

:::connect Where this goes next
Tomorrow: "the last five minutes" sounds simple until you ask *whose* five minutes. Event time vs processing time, stragglers, watermarks, and untrustworthy device clocks.
:::
