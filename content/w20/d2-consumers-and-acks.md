---
title: Multiple Consumers, Acknowledgments and Redelivery
kind: lesson
minutes: 70
chapter: 11
objectives:
- Distinguish load balancing from fan-out (Figure 11-1), and combine them with consumer groups
- Explain acknowledgments, redelivery, and why a lost ack causes duplicate processing
- Explain why load balancing plus redelivery reorders messages (Figure 11-2), and when that matters
reading:
- Multiple consumers | 430-431
- Acknowledgements and redelivery | 431-432
complete:
- You reproduced Figure 11-2's reordering in the visualization
- You can explain why "consumer acknowledged" doesn't mean "processed exactly once"
- You answered the quiz
---

:::problem Two consumers, one topic
When several consumers read the same topic, should each message go to **one** of them, to share the work, or to **all** of them, so independent applications can each see everything? And what happens when a consumer crashes halfway through a message (pp. 430–431)?
:::

:::intuition Share the work, or tune in to the broadcast
**Load balancing** (Figure 11-1a). Each message is delivered to **one** consumer, so they share the processing. The broker may assign messages arbitrarily. This is useful when messages are **expensive to process** and you want to add consumers to parallelize. In AMQP it's several clients consuming from the same queue, and in JMS a **shared subscription**.

**Fan-out** (Figure 11-1b). Each message is delivered to **all** consumers. Independent consumers each "tune in" to the same broadcast without affecting each other, the streaming equivalent of several batch jobs reading the same input file. In JMS it's **topic subscriptions**, and in AMQP **exchange bindings**.

**Combined**: two separate groups each subscribe to a topic. Each group collectively receives all messages, but within a group only one node receives each message. That's the consumer-group pattern.

**Acknowledgments and redelivery** (p. 431). A consumer may crash after receiving a message but before processing it, or partway through. So brokers use **acknowledgments**: a client explicitly tells the broker it has **finished processing** a message, and only then is it removed from the queue. If the connection closes or times out without an ack, the broker assumes the message wasn't processed and **delivers it again to another consumer**. It could happen that the message *was* fully processed and only the ack was lost in the network. Handling that needs an **atomic commit protocol** (Chapter 9).
:::

:::visual BrokerSim | Load balancing, fan-out and redelivery
@props {"initialTab":"consumers"}
**Try this:**
1. **Load balancing**: m1 to m5 alternate between the consumers.
2. Tick **consumer 2 crashes while processing m3**. The broker gets no ack and redelivers m3 to consumer 1, which processes **m4, then m3, then m5** (Figure 11-2).
3. **Fan-out**: both consumers see every message in order, and a crash of one doesn't affect the other.
:::

:::details Why reordering is inevitable here, and when it matters (pp. 431–432)
In Figure 11-2, consumers generally process messages in the order producers sent them. But consumer 2 crashes while processing m3, at the same time as consumer 1 processes m4. The unacknowledged m3 is redelivered to consumer 1, which ends up processing **m4, m3, m5**. So m3 and m4 aren't delivered in the order producer 1 sent them.

Even if the broker otherwise tries to preserve order, as both JMS and AMQP require, **the combination of load balancing with redelivery inevitably reorders messages**. That's harmless if messages are completely independent, but it matters when there are **causal dependencies** between them. For example, "create account" must be processed before "update account" (Chapter 9's "watch your causality"). Two ways around it are a separate queue per consumer, so you don't load-balance, or the log-based approach on Day 3, where a partition is consumed by exactly one consumer, in order.

Note also the other side of redelivery: if the ack is lost after successful processing, the message is processed **twice**. Redelivery gives **at-least-once** processing, not exactly once (p. 431). We'll return to making that safe in Week 21.
:::

:::quiz
### mcq
When is load balancing across consumers useful?
- [ ] When each consumer needs to see every message
- [x] When messages are expensive to process and you want to add consumers to parallelize the work
- [ ] When ordering is critical
- [ ] When there's only one consumer
>>>
That's p. 430. Fan-out is for independent consumers that each need everything.

### mcq
What does a broker do if a consumer's connection closes before it acknowledges a message?
- [ ] Deletes the message
- [x] Assumes it wasn't processed and redelivers it to another consumer
- [ ] Waits forever for the ack
- [ ] Sends it back to the producer
>>>
That's p. 431. If processing actually completed and only the ack was lost, the message is processed twice.

### predict
With load balancing over 3 consumers and redelivery, a producer sends "create user 7" then "rename user 7". Can a consumer process the rename before the create?
- [ ] No, JMS guarantees order
- [x] Yes: if the consumer handling "create" crashes, the message is redelivered later, possibly after another consumer has already processed "rename"
- [ ] Only with fan-out
- [ ] Only if the messages are on different topics
>>>
Load balancing plus redelivery inevitably reorders messages, which matters for causally dependent messages (p. 432).

### tradeoff
Two teams, search indexing and analytics, both need every order event, and each team runs 4 instances. Which delivery pattern?
- [x] Combine them: each team is a separate group subscribed to the topic (fan-out between groups), and load balancing happens within each group
- [ ] Load balancing across all 8 instances
- [ ] Fan-out to all 8 instances
- [ ] A separate producer per team
>>>
Each group collectively receives all messages, but within a group only one node gets each message (p. 431).

### explain
Explain why an acknowledgment-based broker gives at-least-once rather than exactly-once processing, and what would be needed for exactly once.
>>>
The broker removes a message only after it receives the consumer's ack, and redelivers it if the connection drops or times out without one. If a consumer finishes processing (for example, writes to a database) but crashes or loses the network before the ack reaches the broker, the broker can't tell that apart from a consumer that never processed it, so it redelivers, and the message's effects happen twice (p. 431). To get exactly-once effects, the processing side effects and the acknowledgment must commit atomically, all or nothing. That's an atomic commit protocol across consumer state and broker, such as XA (Chapter 9). Alternatively, the processing must be idempotent so a repeat is harmless (pp. 461–462).
:::

:::connect Where this goes next
Tomorrow: a different design. Instead of deleting messages after delivery, keep them in an append-only, partitioned log, as Kafka does, and track progress with one offset per partition.
:::
