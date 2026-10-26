---
title: Data Integration — Combining Tools by Deriving Data
kind: supplement
minutes: 80
objectives:
- Explain why no single tool serves every access pattern, and why total ordering of writes is the key to integration
- Contrast distributed transactions with log-based derived data as ways to keep systems consistent
- Explain how batch and stream processing combine, the lambda architecture and why it has been criticised
- Explain reprocessing as a tool for schema evolution and gradual migration
complete:
- You can explain why "derived data via an ordered log" beats dual writes and XA for integration
- You can sketch a gradual migration using reprocessing
- You answered the quiz
---

:::note This week goes beyond your PDF
Your PDF (the Sixth Early Release) stops after Chapter 11. The **published edition** of the book adds a final chapter, *The Future of Data Systems*. These supplementary lessons summarize its main themes **in our own words, from general knowledge of the published book and the wider literature**, so there are no page references. Nothing here is quoted from your PDF. To go deeper, read that final chapter in the published edition, which is well worth it.
:::

:::problem Every system is a combination
Throughout the book, one theme recurs: **no single tool can efficiently serve every access pattern**. A real application combines an OLTP database, a cache, a search index, a warehouse, stream processors and machine-learning pipelines. Each was designed for its own job, so the hard part is no longer choosing a tool. It's **integrating** the tools so the data in all of them stays consistent and the dataflow stays understandable (Chapter 11's dual-writes problem, and the Part III introduction's systems of record vs derived data).
:::

:::intuition Derived data through an ordered log
Combine the ideas from Parts II and III:
- **Decide which system is the system of record** for each kind of data, and treat everything else as **derived**: indexes, caches, views and models (Part III introduction).
- **Get a total order of writes** into the system of record, a log, and derive every other system from it by **deterministic, retryable** processing. This is Chapter 11's CDC and event sourcing, and Chapter 9's state machine replication. If two systems apply the same changes in the same order, they converge. That removes the race conditions and partial failures of dual writes.
- **Derived data vs distributed transactions.** Both try to keep several systems consistent. Distributed transactions (2PC/XA) decide an ordering with locks and atomic commit, and they give linearizable reads and read-your-writes, but they amplify failures and work poorly across heterogeneous systems (Chapter 9). Log-based derivation decides order with a log, uses deterministic retry and idempotence instead of atomic commit, and is usually **asynchronous**, so it gives up some timeliness but is far more robust and loosely coupled. For integrating heterogeneous systems, the log-based approach is the more promising one.
- **Limits of total ordering.** One leader that orders every event doesn't scale forever, doesn't span geo-distributed datacenters without cost, and doesn't easily cover microservices that each own their state, or offline clients. Often you need **causal** ordering across partitions rather than a single global order (Chapter 9), and that remains an area of active research and engineering.
:::

:::extra Batch, streams and reprocessing
- **Combining batch and stream.** Batch reprocesses large historical inputs, and streams process changes with low latency. Both are ways of deriving data, and Chapter 10's principles (immutable inputs, deterministic functions, replaceable outputs) apply to both.
- **The lambda architecture**, a name popularized around 2011–2014, runs a batch layer (accurate, slow) and a speed layer (approximate, fast) side by side and merges their outputs. Its main criticism is that you implement the same logic **twice**, in two frameworks, and merging is complicated. The alternative, often called the **kappa** architecture, is to use one stream processor for both, replaying the log from the start when you need to reprocess history. Unified batch/stream engines (for example Apache Flink and the Apache Beam model) make this practical.
- **Reprocessing for evolution.** Because inputs are immutable and outputs derived, you can **build a new view of old data alongside the old one** with a new schema, a new index or a new model, check it, gradually move readers over, and retire the old view. That turns a risky schema migration into a reversible, incremental process, like running two versions of a railway gauge side by side during a conversion.
:::

:::details Worked example: migrating a search backend
You want to move product search from engine A to engine B, with a new tokenizer and different ranking fields.
1. The product database is the system of record, and its changes are already in a log (CDC).
2. Start a **new consumer** that builds engine B's index from the **log-compacted** change topic, starting at offset 0 (Chapter 11), while engine A keeps serving.
3. When B has caught up, **shadow traffic**: send some queries to both, compare results and latency, and fix B's configuration. Because B is derived, rebuild it as often as needed.
4. Shift a growing percentage of users to B. If something goes wrong, shift back. A is still being kept up to date.
5. Retire A.

At no point did you need a distributed transaction or a "big bang" migration. Everything was derived from one ordered source.
:::

:::quiz
### mcq
Why is a total order of writes so useful for integrating several data systems?
- [ ] It makes writes faster
- [x] If every derived system applies the same changes in the same order deterministically, they all converge to consistent states, which avoids dual-write races
- [ ] It removes the need for storage
- [ ] It guarantees linearizable reads everywhere
>>>
It's state machine replication (Chapter 9) applied across different technologies (Chapter 11).

### mcq
What's the main criticism of the lambda architecture?
- [ ] It's too accurate
- [x] The same logic must be implemented and maintained twice, in a batch layer and a speed layer, and merging their results is complex
- [ ] It can't handle streams
- [ ] It requires 2PC
>>>
Unified engines that treat batch as replaying a stream avoid the duplication.

### tradeoff
Distributed transactions vs log-based derived data for keeping systems consistent: what's the trade-off?
- [x] Transactions give timeliness (read-your-writes, linearizable reads) but amplify failures and work poorly across heterogeneous systems; logs are robust and loosely coupled but usually asynchronous, so derived views lag
- [ ] Logs are always strongly consistent
- [ ] Transactions never fail
- [ ] They're identical
>>>
That's Chapter 9's XA limitations versus Chapter 11's CDC and event sourcing.

### predict
You need to add a "price history" feature over three years of product data, and your product changes are in an event log from day one. What does adding the feature require?
- [ ] A schema migration of the live table, with downtime
- [x] A new consumer that replays the log from the beginning to build a new view, running alongside existing systems
- [ ] Copying the database to a new server
- [ ] Nothing, since it's already there
>>>
Reprocessing immutable history to derive new views is what makes evolution gradual and reversible.

### explain
Explain why a single global total order of events doesn't scale indefinitely, and what you might use instead.
>>>
A total order needs a single sequencer, typically one leader or one log partition, so every event passes through one place. That limits throughput to one node or partition, adds cross-datacenter latency for geo-distributed deployments, and conflicts with services and offline clients that each own their state and can't wait for a central order (Chapter 9's linearizability costs). Instead, partition the data so each partition has its own total order, which is enough when events don't cross partitions, and capture causal dependencies between partitions with techniques like version vectors or Lamport-style timestamps. Accept that concurrent events in different partitions have no defined order, and design operations to be commutative or conflict-resolvable where they meet.
:::

:::connect Where this goes next
Tomorrow: "unbundling the database". What if a whole application were designed as derivation functions over logs, with the database's internal features (indexes, views, replication) turned inside out?
:::
