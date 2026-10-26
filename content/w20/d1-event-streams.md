---
title: Transmitting Event Streams — Events, Messaging Systems and Brokers
kind: lesson
minutes: 85
chapter: 11
objectives:
- Explain why unbounded data leads from daily batches to stream processing
- Define events, producers, consumers and topics, and why polling a database doesn't scale
- Use the two questions (overload and crashes) to classify messaging systems
- Describe direct messaging (UDP multicast, ZeroMQ, StatsD, webhooks) and its limits
- Compare message brokers with databases
reading:
- Chapter 11 opening | 425-426
- Transmitting event streams | 426-427
- Messaging systems | 427-428
- Direct messaging from producers to consumers | 428-429
- Message brokers; message brokers compared to databases | 429-430
complete:
- You tried all three overload policies in the broker visualization
- You can answer the two classification questions for a system you use
- You answered the quiz
---

:::problem Data that never ends
Chapter 10's big assumption was **bounded** input of known size, so a job knows when it's done. Sorting even requires the whole input, since the last record might come first. But much data is **unbounded**. Users produced data yesterday, produce it today, and will tomorrow. "Unless you go out of business, this process never ends." Batch processors therefore chop it into fixed-duration chunks: a day's data at the end of each day, or an hour's at the end of each hour. Changes then show up in the output only a day later, which is too slow for impatient users. Running more often, every second or **continuously**, processing every event as it happens, is **stream processing** (pp. 425–426).

A **stream** is data made available incrementally over time. It appears in Unix stdin/stdout, lazy lists, Java's FileInputStream, TCP connections and audio/video delivery. This chapter treats **event streams** as a data-management mechanism, the unbounded, incrementally processed counterpart of batch data.
:::

:::intuition Events, and two questions to ask any messaging system
**Events** (pp. 426–427). The streaming equivalent of a record is an **event**: a small, self-contained, **immutable** object with the details of something that happened at some point in time, usually with a **timestamp**. Examples are a user action (a page view or purchase), a sensor reading, a CPU metric, or a line of a web-server log. Events are encoded as text, JSON or binary (Chapter 4), so they can be stored or sent over the network. An event is generated once by a **producer** (publisher, sender) and processed by possibly many **consumers** (subscribers, recipients). Related events are grouped into a **topic** or **stream**, the way a filename groups related records.

You *could* connect producers and consumers with a file or database: producers write events, and consumers **poll** for new ones, which is essentially daily batch processing. But for continual low-latency processing, polling gets expensive: the more often you poll, the fewer requests return anything. It's better to **notify** consumers. Databases have traditionally supported this poorly. Triggers are limited and "somewhat of an afterthought", so specialized tools appeared.

**Messaging systems** (pp. 427–428). A producer sends a message containing the event, and it's pushed to consumers. A Unix pipe or TCP connection is the simplest version, but it's one sender to one recipient. Messaging systems let **many producers** send to a topic and **many consumers** receive from it: the **publish/subscribe** model. Two questions distinguish them:
1. **What if producers send faster than consumers can process?** There are three options: **drop** messages, **buffer** them in a queue, or apply **backpressure** (block the producer). Unix pipes and TCP use backpressure with a small fixed buffer. If you buffer, what happens as the queue grows? Does the system crash when it no longer fits in memory, or spill to disk, and with what performance?
2. **What if nodes crash or go offline?** Are messages lost? Durability costs disk writes and/or replication. If you can afford occasional loss, you get higher throughput and lower latency on the same hardware.

Whether loss is acceptable depends on the application. A periodic sensor reading can be missed, since an update follows soon. But if many messages are dropped, it may not be obvious that the metrics are wrong. **Counting** events needs reliable delivery, because every lost message makes a counter wrong. (Batch processing's guarantee, the same output as if nothing failed, is the bar this chapter will try to reach for streams.)
:::

:::visual BrokerSim | Producer faster than consumer
@props {"initialTab":"overload"}
**Try this:**
1. Producer 12 per tick, consumer 10 per tick, **buffer**: the queue grows without bound.
2. **Drop** with a buffer of 20: nothing grows, but count what's lost.
3. **Backpressure**: nothing is lost and the queue stays small, but the producer is blocked.
4. Set the producer slower than the consumer. Now all three behave the same. The policy only matters under overload.
:::

:::details Direct messaging, and brokers vs databases (pp. 428–430)
**Direct messaging from producers to consumers**, with no intermediary:
- **UDP multicast** in finance for stock-market feeds where low latency matters. Application protocols recover lost packets, so the producer must remember what it sent so it can retransmit.
- **Brokerless libraries** such as **ZeroMQ** and **nanomsg**: pub/sub over TCP or IP multicast.
- **StatsD** and **Brubeck** collect metrics over unreliable UDP. StatsD counters are correct only if every message arrives, so UDP makes them approximate at best.
- **Webhooks**: register a callback URL with another service, which makes an HTTP request to it when an event occurs.

These work in their niches but require the **application to be aware that messages can be lost**, and they tolerate limited faults. They generally assume producers and consumers are **always online**. An offline consumer misses messages, and a producer that crashes loses its buffer of messages still to retry (p. 429).

**Message brokers** (message queues) are essentially **a database optimized for message streams**. The broker is a server, and producers and consumers are clients. Centralizing data there tolerates clients that come and go, and moves **durability** to the broker: some keep messages only in memory, others write them to disk. Faced with slow consumers, they usually **queue without bound**. A consequence is that **consumers are asynchronous**: the producer waits only for the broker to buffer the message, and delivery happens later, usually within a fraction of a second, but much later if there's a backlog (p. 429).

**Brokers vs databases** (p. 430). Some brokers even take part in 2PC (XA/JTA). Practical differences remain:
- Databases keep data **until it's explicitly deleted**, while most brokers **delete a message once it's delivered**, so they're unsuitable for long-term storage.
- So brokers assume a **small working set** (short queues). If they must buffer a lot (for example by spilling to disk), each message takes longer and **throughput can degrade**.
- Databases offer **secondary indexes and search**. Brokers offer subscriptions to **topics matching a pattern**. Both select the data a client is interested in.
- A database query is a **point-in-time snapshot**, and you aren't told when its result changes unless you poll. Brokers don't support arbitrary queries, but they **notify** clients when new data arrives.

That's the traditional view, captured in the **JMS** and **AMQP** standards and implemented in RabbitMQ, ActiveMQ, HornetQ, Qpid, TIBCO EMS, IBM MQ and Azure Service Bus.
:::

:::quiz
### mcq
What is an "event" in stream processing?
- [ ] A mutable row in a table
- [x] A small, self-contained, immutable record of something that happened at some point in time, usually with a timestamp
- [ ] A database trigger
- [ ] A batch job
>>>
It's essentially the same thing as a record in batch processing (p. 426).

### mcq
Why don't consumers simply poll a database for new events?
- [ ] Databases can't store events
- [x] For low-latency continual processing, frequent polling is expensive: most polls return nothing, so overhead rises the more often you poll
- [ ] Polling loses events
- [ ] Polling requires 2PC
>>>
It's better for consumers to be notified (p. 427).

### mcq
Which three options does a messaging system have when producers outpace consumers?
- [ ] Encrypt, compress, or replicate
- [x] Drop messages, buffer them in a queue, or apply backpressure to block the producer
- [ ] Partition, shard, or index
- [ ] Retry, abort, or commit
>>>
Unix pipes and TCP use backpressure with a small fixed buffer (pp. 427–428).

### predict
A metrics agent sends StatsD counter increments over UDP. During a network blip, 5% of packets are lost. What happens to the dashboards?
- [ ] Nothing: StatsD retransmits
- [x] Counters are silently too low; nothing reports an error, so it may not be obvious the metrics are wrong
- [ ] The agent blocks until the network recovers
- [ ] The dashboard shows an error
>>>
StatsD counters are correct only if all messages arrive, and UDP makes them approximate at best (p. 428).

### tradeoff
How does a message broker differ from a database, in the traditional view?
- [x] Brokers usually delete messages once delivered, assume short queues, support topic subscriptions rather than queries, and notify clients of new data, while databases keep data until deleted and answer arbitrary point-in-time queries
- [ ] Brokers support secondary indexes
- [ ] Databases push changes to clients by default
- [ ] There's no difference
>>>
That's p. 430. Log-based brokers, tomorrow and on Day 3, blur this line.

### explain
Answer the book's two classification questions for webhooks, and explain the consequence.
>>>
(1) Producer faster than consumer: a webhook producer makes an HTTP request to the consumer's URL per event. If the consumer is slow, requests time out or pile up, and there's no buffering in between unless the producer implements its own queue and retries, which is effectively backpressure or dropping, depending on the implementation. (2) Crashes: if the consumer is offline, it misses events unless the producer retries; if the producer crashes, it loses its buffer of events still to retry (p. 429). The consequence is that direct messaging requires the application to be aware of possible message loss, and assumes producer and consumer are constantly online. That's why brokers, which centralize buffering and durability, are widely used instead.
:::

:::connect Where this goes next
Tomorrow: several consumers on one topic. Load balancing vs fan-out, and why acknowledgments plus redelivery inevitably reorder messages.
:::
