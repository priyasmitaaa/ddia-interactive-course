---
title: A log-based message broker on your disk
chapter: 11
topic: Partitioned append-only logs, offsets, segments, consumer groups, retention, replay
minutes: 50
---

## Objective

Build the essence of Kafka's storage model (Figure 11-3, pp. 433–436) with plain files. Each topic
**partition** is an append-only log split into **segment files**. Every message has a monotonically
increasing **offset**. The same key always goes to the same partition, so per-key order is kept.
Consumers in a **group** record one committed offset per partition instead of acknowledging every
message. **Retention** deletes whole old segments, turning the log into a huge on-disk ring buffer.
Then see the consequences the book describes: reprocessing after a crash before a commit, independent
fan-out across groups, and consumers that fall behind retention.

## Setup

Python 3.10+, standard library only. Files: `practice/40-log-broker/logbroker.py` (TODOs 1–4) and
`test_logbroker.py` (T1–T4). `SEGMENT_SIZE` is 4 messages so you can see segments rolling over. Real
brokers use segments of hundreds of megabytes. The **Log broker** visualization this week runs the same
model in the browser.

## Predict first

1. You append 40 messages with 7 different keys to 3 partitions. Will the partitions be equally long?
2. A consumer reads 3 messages, doesn't commit, and restarts. What does it read next?
3. After retention deletes the first segments, what happens to a consumer group that has never committed?

## Your task

1. **TODO 1** `append`: roll to a new segment file, named after its first offset, when the current one is full.
2. **TODO 2** `read`: skip whole segments that end before the requested offset.
3. **TODO 3** `commit` / `committed`: one small JSON file per group, written atomically.
4. **TODO 4** `apply_retention`: delete whole segments only, never individual messages.

## Run it

```
python practice/40-log-broker/test_logbroker.py
python practice/40-log-broker/logbroker.py
```

## Observe

- Partitions are **not** equally loaded: a few keys determine where all the data goes. That's the hot
  partition problem from Chapter 6, and it caps parallelism at the number of partitions (p. 434).
- A consumer that crashes before committing reads the same messages again. The broker only knows the
  last committed offset, and everything after it is processed a second time (p. 435). Exercise 44 deals with
  that.
- Two groups reading the same partition see identical messages and don't affect each other. Reading
  is non-destructive, unlike AMQP/JMS brokers that delete messages after acknowledgment (p. 436).
- Retention deletes old segments. A consumer whose offset falls before the oldest retained segment gets
  `OffsetOutOfRange`, which means it has missed data. Real brokers let you configure whether to reset to the oldest or
  newest offset. Monitor consumer lag so a human can intervene before this happens (p. 436).

## Questions

1. Why does recording one offset per partition need so much less bookkeeping than per-message acks?
2. What's the analogy between a consumer offset and a database replication log sequence number (p. 435)?
3. The book's back-of-the-envelope: a 6 TB disk at 150 MB/s fills in about 11 hours. What does that
   mean for how long a consumer can be down?
4. When would you prefer a JMS/AMQP-style broker over a log (pp. 434–435)?

<details><summary>Discussion</summary>

1. Messages in a partition are consumed sequentially, so "everything before offset N is done" fully
   describes progress. That allows batching and pipelining, and it raises throughput (p. 435).
2. The broker is like a leader and the consumer like a follower. The offset lets a disconnected consumer
   resume exactly where it left off without skipping anything, just as a follower uses the log sequence
   number to catch up after reconnecting (p. 435).
3. If messages were written at the disk's full speed, the log would hold about 11 hours of history.
   Real deployments rarely write at full bandwidth, so the buffer typically covers days or weeks. A
   consumer can be down or slow for that long before it misses messages, and a lagging consumer only hurts
   itself (p. 436).
4. When messages are expensive to process and you want to parallelize message by message, and
   ordering doesn't matter much, as in task queues. Logs give at most one consumer per partition and
   head-of-line blocking if one message is slow (pp. 434–435).
</details>
