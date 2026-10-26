---
title: Partitioned Logs — Kafka-Style Message Brokers
kind: lesson
minutes: 95
chapter: 11
objectives:
- Explain why transient messaging makes derived data hard, and the log-based broker idea
- Describe partitioned logs, offsets and ordering guarantees (Figure 11-3)
- Compare log-based and JMS/AMQP brokers: fan-out, partition assignment, head-of-line blocking
- Explain consumer offsets and their analogy with replication log sequence numbers
- Explain retention, the ring-buffer view, consumer lag, and replaying old messages
reading:
- Partitioned logs | 432-433
- Using logs for message storage | 433-434
- Logs compared to traditional messaging | 434-435
- Consumer offsets | 435-435
- Disk space usage | 435-436
- Replaying old messages | 436-436
complete:
- In the log broker visualization, you produced reprocessing by crashing before a commit, and replayed from the start
- Exercise 40 (log broker) is done
- You answered the quiz
---

:::problem Receiving a message shouldn't destroy it
Sending a packet or making a request is normally **transient**: it leaves no permanent trace. Even brokers that write messages to disk **delete them after delivery**, because they're built around a transient-messaging mindset. Databases and filesystems are the opposite: everything written is expected to stay until someone deletes it (p. 432).

That mindset matters for **derived data**. Batch jobs can be rerun as often as you like without damaging their read-only input. With AMQP/JMS, **receiving is destructive**: processing deletes the message, so you can't run the same consumer again and get the same result. A **new consumer** only receives messages from when it registered, because earlier ones are gone. With files and databases, a new client can read data written arbitrarily far in the past (p. 433).

"Why can we not have a hybrid, combining the durable storage approach of databases with the low-latency notification facilities of messaging?" That's the **log-based message broker**.
:::

:::intuition An append-only log, partitioned
**Logs for message storage** (pp. 433–434). A log is an **append-only sequence of records on disk** (Chapter 3's log-structured storage and WALs, and Chapter 5's replication logs). A producer **appends** a message to the end, and a consumer **reads sequentially**, waiting for a notification at the end of the log, like `tail -f`. To scale beyond one disk, the log is **partitioned** (Chapter 6). Partitions live on different machines, and a **topic** is a group of partitions (Figure 11-3). Within a partition, every message gets a monotonically increasing **offset**, so messages **within a partition are totally ordered**, and **across partitions there is no ordering guarantee**. **Apache Kafka**, **Amazon Kinesis Streams** and **Twitter's DistributedLog** work this way. Although they write everything to disk, they reach **millions of messages per second** by partitioning, and gain fault tolerance by replicating.

**Logs vs traditional messaging** (pp. 434–435). **Fan-out is trivial**: several consumers read the log independently. **Load balancing** works differently. Instead of assigning individual messages, the broker assigns **whole partitions** to consumers in a group, and each consumer reads its partitions sequentially, single-threaded. The downsides:
- **Parallelism is capped at the number of partitions**, since one partition goes to one node. (Footnote i: you could have two consumers read the full partition and process even and odd offsets, or use a thread pool, but that complicates offset management. Single-threaded per partition is preferable.)
- **Head-of-line blocking**: one slow message holds up the rest of its partition.

So JMS/AMQP suits **expensive messages, per-message parallelism, and unimportant ordering**. Logs suit **high throughput, fast messages, and important ordering**.

**Consumer offsets** (p. 435). Sequential consumption makes progress easy to describe: all messages below a consumer's current offset are processed, and none above it. The broker needn't track per-message acks, only **periodically record consumer offsets**. Less bookkeeping plus batching and pipelining means more throughput. It's just like a **log sequence number** in single-leader replication: the broker is the leader, the consumer a follower that can reconnect and resume without skipping. If a consumer fails, another in the group takes over its partitions **at the last recorded offset**. Messages processed after that offset but not yet recorded are **processed a second time**.
:::

:::visual LogBrokerSim | Partitions, offsets, crashes and replay
**Try this:**
1. **Consume** twice without committing, then **Crash consumer 2**. Its partitions move to consumer 1, which starts at the last *committed* offset. Watch "processed twice".
2. **Reset by reloading the page**, then Consume, **Commit offsets**, Crash. No duplicates.
3. Produce a lot, set retention to 3, **Apply retention**, then consume. Offsets keep increasing, but old ones are gone.
4. **Replay from the start**: a fresh consumer copy re-reads everything without changing the log.
:::

:::details Disk space, consumer lag, and replay (pp. 435–436)
**Disk space** (pp. 435–436). Appending forever would fill the disk, so the log is divided into **segments**, and old segments are deleted or archived. (Log compaction, a smarter alternative, comes tomorrow.) A consumer that falls so far behind that its offset points into a deleted segment **misses messages**. The log is effectively a bounded **circular (ring) buffer**, but on disk, so it's **very large**. Back-of-the-envelope at the time of writing: a 6 TB drive at 150 MB/s sequential write fills in about **11 hours** at full speed, and the ratio holds with many disks and machines. Real deployments rarely use the full write bandwidth, so logs typically hold **days or weeks** of messages.

**Monitor consumer lag** and alert when a consumer falls behind. The buffer is large enough for a human to fix a slow consumer before it misses messages. And a lagging consumer **only affects itself**, not other consumers, which is a big operational advantage over brokers whose queues grow for everyone.

**Replaying old messages** (p. 436). In AMQP/JMS, processing and acknowledging is **destructive**. In a log-based broker, consuming is **read-only**, like reading a file. The only side effect besides the consumer's output is that its **offset moves forward**, and the offset is under the consumer's control. You can start a **copy of a consumer with yesterday's offsets**, write its output somewhere else, and reprocess a day's messages as many times as you like with different code. This makes log-based messaging **like batch processing**: derived data clearly separated from input by a repeatable transformation. That allows more experimentation and easier recovery from bugs, and makes it a good tool for integrating dataflows across an organization.
:::

:::practice 40-log-broker | A log-based broker on your disk
Partitions as segment files, offsets, consumer-group commits, retention and replay, with tests that reproduce reprocessing after a crash.
:::

:::quiz
### mcq
What ordering does a partitioned log guarantee?
- [ ] A total order across all partitions of a topic
- [x] A total order within each partition, and none across partitions
- [ ] No ordering at all
- [ ] Ordering by producer timestamp
>>>
Offsets are per partition, and partitions are independent (p. 433).

### mcq
How does a log-based broker load-balance a topic over a consumer group?
- [ ] It assigns individual messages round-robin
- [x] It assigns whole partitions to consumers, each of which reads its partitions sequentially
- [ ] It copies every message to every consumer
- [ ] It uses acknowledgments per message
>>>
So the number of consumers sharing a topic is at most the number of partitions (p. 434).

### predict
A consumer processes offsets 100–149 of a partition, commits offset 120, then crashes. Where does its replacement start?
- [ ] 150
- [x] 120, so 120–149 are processed again
- [ ] 0
- [ ] 100
>>>
Messages processed after the last recorded offset are processed a second time (p. 435).

### mcq
Why is a lagging consumer less harmful with a log-based broker?
- [ ] It's automatically sped up
- [x] It only affects itself: the log is a huge on-disk buffer shared by all, there's time to alert a human, and other consumers carry on unaffected
- [ ] The broker blocks producers until it catches up
- [ ] Logs never delete messages
>>>
If it falls behind retention it misses messages, but nobody else is disrupted (p. 436).

### tradeoff
A task queue sends image-thumbnail jobs, each taking 2–30 seconds, and ordering doesn't matter. Log-based broker or JMS/AMQP-style?
- [x] JMS/AMQP-style: expensive messages that benefit from per-message parallelism, where order doesn't matter; a log would cap parallelism at the partition count and suffer head-of-line blocking from slow jobs
- [ ] Log-based, always
- [ ] Neither; use UDP
- [ ] Log-based, because it's faster
>>>
That's pp. 434–435 and the summary's "asynchronous form of RPC" (p. 463).

### explain
Explain how a log-based broker makes stream processing "more like batch processing", with an example of using that property.
>>>
In a log-based broker, consuming is a read-only operation. The log isn't changed, and the only state is the consumer's offset, which it controls (p. 436). Like batch input files, the input stays immutable and can be read again. Example: you deploy a buggy version of a consumer that computes per-user statistics. You fix the code, start a new copy of the consumer from offsets of a day ago (or offset 0 if retention allows), write its output to a new table, check it, and switch readers over. The bad output is replaced by rerunning a deterministic transformation over immutable input, the human fault tolerance of Chapter 10 (p. 401), now for streams.
:::

:::connect Where this goes next
Tomorrow: the connection runs deeper. A database's writes are themselves a stream. Change data capture turns a database into a leader that search indexes and caches can follow, and log compaction lets a log hold an entire database.
:::
