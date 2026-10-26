---
title: Fault Tolerance in Stream Processing — Exactly-Once Semantics
kind: lesson
minutes: 95
chapter: 11
objectives:
- Explain exactly-once semantics in batch and why it's harder for streams
- Explain microbatching (Spark Streaming) and checkpointing with barriers (Flink), and where they stop helping
- Explain atomic commit of all outputs, state changes and offsets, and why restricted environments can do it efficiently
- Explain idempotence, how offsets make writes idempotent, and the assumptions this relies on
- Explain the options for rebuilding operator state after a failure, and summarize Chapter 11
reading:
- Fault tolerance | 460-460
- Microbatching and checkpointing | 460-461
- Atomic commit revisited | 461-461
- Idempotence | 461-462
- Rebuilding state after a failure | 462-462
- Summary | 462-464
complete:
- In the exactly-once visualization, you made each strategy fail or succeed at every crash point
- You can state the three assumptions behind idempotent writes
- You answered the quiz
---

:::problem A job that never finishes can't wait until it's finished
Batch frameworks tolerate faults easily. A failed MapReduce task is restarted elsewhere and its output discarded. That works because inputs are immutable, each task writes to its own HDFS file, and output becomes visible only when a task completes. The **output is the same as if nothing had gone wrong**: it appears as though every record was processed **exactly once**, none skipped and none twice. Records may in fact be processed multiple times, but the visible effect is as if once. These are **exactly-once semantics** (p. 460).

Streams have the same issue, but "waiting until a task is finished before making its output visible is not an option, because a stream is infinite and so you can never finish processing it."
:::

:::intuition Smaller units, atomic effects, or idempotent writes
**Microbatching and checkpointing** (pp. 460–461):
- **Microbatching** (**Spark Streaming**) breaks the stream into small blocks, each treated like a miniature batch process. Batches are typically about **1 second**, a compromise: smaller batches mean more scheduling and coordination overhead, larger ones a longer delay before results are visible. It also implicitly gives a **tumbling window equal to the batch size**, windowed by *processing* time, not event time. Larger windows must explicitly carry state from one microbatch to the next.
- **Checkpointing** (**Apache Flink**) periodically writes **rolling checkpoints of state** to durable storage. If an operator crashes, it restarts from its latest checkpoint and **discards any output generated since**. Checkpoints are triggered by **barriers** in the message stream, similar to microbatch boundaries but without forcing a window size.

**Within the stream processing framework**, both give the same exactly-once semantics as batch. **But as soon as output leaves the processor**, by writing to a database, sending to an external broker, or sending emails, the framework can no longer discard the output of a failed batch. Restarting a failed task makes the **external side effect happen twice**, and microbatching or checkpointing alone can't prevent it.

**Atomic commit revisited** (p. 461). For exactly-once effects despite faults, **all outputs and side effects of processing an event must take effect if and only if processing succeeds**. That includes messages to downstream operators or external systems (email, push notifications), database writes, changes to operator state, and the **acknowledgment of input**, including **moving the consumer offset forward**. All of these must happen atomically or not at all. That's exactly-once message processing via distributed transactions (Chapter 9). XA has problems, but **in more restricted environments atomic commit can be implemented efficiently**. **Google Cloud Dataflow** does it, and there were plans to add it to **Kafka**. The approach writes **the transaction commit as a single object to a fault-tolerant datastore**, since a single-object write is easy to make atomic.
:::

:::visual ExactlyOnceSim | Where the crash lands decides everything
**Try this:** for each strategy, try every crash point.
1. **Commit, then write**: a crash in between **loses** an event.
2. **Write, then commit**: a crash in between **applies an event twice**.
3. **Idempotent**: the offset stored with the value makes the replayed event a no-op.
4. **Atomic**: value and offset commit together, so a crash rolls both back.
:::

:::details Idempotence, rebuilding state, and the chapter summary (pp. 461–464)
**Idempotence** (pp. 461–462). The goal is to discard the partial output of failed tasks so they can be retried without effect. Distributed transactions are one way, and **idempotence** is another. An idempotent operation can be performed several times with the same effect as once. Setting a key to a fixed value is idempotent, while incrementing a counter isn't. Even a non-idempotent operation can often be **made idempotent with a bit of extra metadata**. Kafka messages have a persistent, monotonically increasing **offset**, so **store the offset of the message that triggered the last write together with the value** in the external database, and you can tell whether an update was already applied. **Storm's Trident** state handling uses a similar idea. Idempotence relies on assumptions:
- restarting a failed task must **replay the same messages in the same order** (log-based brokers do);
- processing must be **deterministic**;
- **no other node may concurrently update the same value**.

When failing over from one node to another, **fencing** may be needed to stop a node thought dead but still alive (Chapter 8). With these caveats, idempotent operations are an effective way to get exactly-once semantics with little overhead.

**Rebuilding state after a failure** (p. 462). Stateful processes (windowed aggregations such as counters, averages and histograms, and tables and indexes for joins) must recover their state. One option is to keep state in a **remote replicated datastore**, but querying it per message is slow. Better to keep **state local and replicate it periodically**, so a recovering task reads the replicated state and resumes without loss. **Flink** snapshots operator state to durable storage such as HDFS. **Samza** and **Kafka Streams** send state changes to a dedicated **Kafka topic with log compaction**, similar to CDC. Sometimes replication isn't even necessary: a **short-window aggregation** can be rebuilt by replaying that window's input events, and a **local database replica maintained by CDC** can be rebuilt from the log-compacted change stream.

**Chapter 11 summary** (pp. 462–464):
- Stream processing is batch processing done **continuously on unbounded input**, and **message brokers and event logs are the streaming equivalent of a filesystem**.
- **AMQP/JMS-style brokers** assign individual messages to consumers, which acknowledge each one, and messages are deleted after acknowledgment. They suit an **asynchronous form of RPC**, such as a task queue where order doesn't matter and old messages needn't be reread.
- **Log-based brokers** assign all messages of a partition to one consumer, always in the same order. They get parallelism by partitioning, consumers checkpoint offsets, and messages are retained on disk, so old ones can be reread. They're similar to database replication logs and log-structured storage, and especially suited to **deriving state or output streams from input streams**.
- Streams come from user activity, sensors, data feeds (market data) and **database writes**: the changelog, captured implicitly by **CDC** or explicitly by **event sourcing**. **Log compaction** lets a stream retain a full copy of a database. That enables powerful integration: keep search indexes, caches and analytics continually up to date, or **build fresh views from scratch** by consuming the log from the beginning.
- Uses: **CEP** (event patterns), **stream analytics** (windowed aggregations), **materialized views** (derived data kept up to date).
- Time is hard: **processing time vs event timestamps**, and **stragglers** after a window was thought complete.
- Joins: **stream-stream** (two events within a window, for example the same user within 30 minutes), **stream-table** (activity events enriched from a local copy of a database kept current by its changelog), and **table-table** (both inputs are changelogs, and every change on one side joins with the latest state of the other, producing a stream of changes to a materialized view).
- **Fault tolerance and exactly-once**: as in batch, discard the partial output of failed tasks. But a stream process is long-running and outputs continuously, so you can't discard everything. Use finer-grained recovery: **microbatching, checkpointing, transactions or idempotent writes**.
:::

:::quiz
### mcq
What does "exactly-once semantics" actually promise?
- [ ] Each record is physically processed once
- [x] The visible effect is as if every record were processed exactly once, though records may in fact be processed several times after failures
- [ ] Messages are never redelivered
- [ ] Only one consumer exists
>>>
Retries may process a record several times, but discarding failed output makes the result look as if each record was processed once (p. 460).

### mcq
Why don't microbatching and checkpointing alone prevent duplicate emails?
- [ ] They're too slow
- [x] Within the framework, a failed batch's output can be discarded, but an email (or external database write) has already left the processor, so a restart repeats the side effect
- [ ] Emails aren't events
- [ ] They only work in Flink
>>>
Once an effect has left the processor, a restart can't undo it, so the effect happens again (pp. 460–461).

### predict
A consumer adds each payment's amount to a balance in Postgres, then commits its Kafka offset. It crashes between the two steps. With no other precautions, what happens after restart?
- [ ] The payment is lost
- [x] The payment is applied twice: the offset wasn't committed, so the event is replayed, and the increment isn't idempotent
- [ ] Postgres rejects the duplicate
- [ ] Nothing, since Kafka deduplicates
>>>
That's p. 461. Fix it by storing the offset with the balance (idempotence), or committing both atomically.

### mcq
Which assumption is NOT required for idempotent writes keyed by offset to give exactly-once effects?
- [ ] Replays deliver the same messages in the same order
- [ ] Processing is deterministic
- [ ] No other node concurrently updates the same value
- [x] The network never drops messages
>>>
The book lists the other three, plus fencing on failover (p. 462).

### tradeoff
Where should a stream processor's large join table (100 GB of user profiles) live so it can recover after a crash?
- [x] Locally on the processing node for fast lookups, with changes replicated to durable storage (for example a log-compacted changelog topic, Samza/Kafka Streams style) so a replacement can rebuild it
- [ ] In a remote database queried for every event
- [ ] Only in memory, with no replication
- [ ] Recomputed from scratch from all history on every restart
>>>
Local state, periodically replicated. If maintained by CDC, it can be rebuilt from the compacted change stream (p. 462).

### explain
Compare the transactional (atomic commit) and idempotent approaches to exactly-once stream processing.
>>>
Atomic commit makes every effect of processing an event (output messages, database writes, state changes and the input offset) take effect together or not at all. It's general and works even for non-idempotent operations, but it needs a transaction mechanism spanning all the systems involved. Heterogeneous XA is problematic, but restricted environments such as Google Cloud Dataflow implement it efficiently by writing the commit as a single object to a fault-tolerant store (p. 461). Idempotence instead lets effects be repeated harmlessly, for example by storing the triggering message's offset with each written value and skipping updates already applied. The overhead is small, but it relies on deterministic replay of the same messages in the same order, deterministic processing, a single writer per value, and fencing on failover (pp. 461–462). Neither makes arbitrary external side effects like emails exactly-once unless the external system cooperates, for example by accepting an idempotency key.
:::

:::connect Where this goes next
Tomorrow's lab: build an exactly-once processor. Watch at-least-once double-count, then make it correct both ways, and deduplicate an external side effect.
:::
