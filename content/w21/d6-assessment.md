---
title: Review — Chapter 11 Checkpoint
kind: assessment
minutes: 70
chapter: 11
objectives:
- Retrieve all of Chapter 11 from memory
- Design streaming pipelines with explicit choices about brokers, time, joins and fault tolerance
- Diagnose exactly-once failures
reading:
- Chapter 11 Summary | 462-464
complete:
- You did today's spaced review
- You answered the checkpoint without notes
- Exercises 40–44 are done (or consciously skipped)
---

:::review Today's spaced review
Scheduled questions from Weeks 1–21.
:::

:::task Pipeline sketch, from memory
Sketch a pipeline that keeps a product search index and a "revenue per category per hour" dashboard up to date from an orders database. Label: the CDC source and log, topic partitioning (by what key, and why), the consumers, the window type and timestamp used for the dashboard, how stragglers are handled, where each consumer's state lives, and how each consumer gets exactly-once effects. Check against the summary on pp. 462–464.
:::

:::quiz Chapter 11 checkpoint
### scenario
A fraud team's stream job computes "number of transactions per card in the last 10 minutes" and blocks cards above 20. After every deployment, a few honest customers get blocked. Explain, and fix.
>>>
The job almost certainly windows by processing time. When it's redeployed, it's down briefly and then processes the backlog in a burst, so a card's transactions from a longer real period get counted in the same 10 processing-time minutes: the artificial spike of Figure 11-7 (pp. 453–454). Fix: window by event time (the timestamp in the transaction event), using sliding windows of 10 minutes per card (p. 456), with a watermark or lateness allowance. Decide what to do with stragglers: for fraud, possibly evaluate late events as well and alert on them rather than block (p. 455). Keep per-card window state local and checkpointed, so a restart resumes correctly instead of rebuilding from a partial view (p. 462).

### mcq
Which broker design best suits a task queue of independent, slow image-processing jobs?
- [x] AMQP/JMS-style, with per-message acknowledgments and load balancing
- [ ] A log-based broker with one partition
- [ ] UDP multicast
- [ ] A log-compacted topic
>>>
That's an asynchronous form of RPC where order doesn't matter and old messages needn't be reread (p. 463).

### mcq
What does log compaction make possible?
- [ ] Lower latency
- [x] Retaining a full copy of a database's current contents in a stream, so new derived systems can be built from offset 0 without a new snapshot of the source
- [ ] Exactly-once semantics
- [ ] Cross-partition ordering
>>>
A compacted log keeps the latest value for every key, so reading it from offset 0 reconstructs the current database (pp. 441, 463).

### tradeoff
A team wants exactly-once updates to an external Elasticsearch index from Kafka. Which approach fits best?
- [x] Idempotent writes: use the document ID as the key with full-document upserts (setting a value is idempotent), plus the Kafka offset or a version for conditional writes, with fencing on consumer failover
- [ ] Rely on Flink checkpoints alone
- [ ] Use XA between Kafka and Elasticsearch
- [ ] Use processing-time windows
>>>
Checkpoints don't cover external side effects. Idempotent writes are effective with little overhead (pp. 460–462).

### explain
Explain why stream-table joins are non-deterministic without care, and give one way to make them deterministic.
>>>
The processor keeps state from one input (the table, updated by its changelog) and queries it with events from the other stream. In a partitioned log, there's no ordering guarantee across streams or partitions, so whether an activity event is processed before or after a related profile update depends on how the two streams happen to interleave. Rerunning the job can interleave them differently and produce different joined output (p. 459). One way to make it deterministic is to version the table and join each event with the version valid at the event's timestamp (as-of join, Exercise 43). Then the result depends only on the data, not on arrival order. Logging the interleaving isn't enough by itself for fault recovery (pp. 459–460).

### design
Design how an event-sourced checkout service (events in Kafka) maintains an "orders per customer" view in a key-value store and sends exactly one confirmation email per order, surviving consumer crashes.
>>>
Partition the order-event topic by customer ID, so all of a customer's events are totally ordered in one partition and one consumer owns them (p. 433). The view consumer keeps the view in the key-value store, and each record stores the offset of the last event applied for that customer. On replay it skips events whose offset isn't newer, which makes the writes idempotent (pp. 461–462). Alternatively it writes the view update and its consumer offset in one transaction if the store supports it (p. 461). Use fencing (an epoch per consumer generation) to stop a zombie consumer after a rebalance (p. 462). The email consumer records "email sent for order X" keyed by order ID before or after sending and passes the order ID as an idempotency key to the email provider, so a retried send is deduplicated by the provider. Without provider support, choose at-most-once (record first) or at-least-once (send first) deliberately. State for both consumers can be rebuilt by replaying the log, or from a log-compacted changelog of the view (p. 462).
:::
