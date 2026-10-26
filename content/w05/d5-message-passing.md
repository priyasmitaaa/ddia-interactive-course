---
title: Message Passing, Actors — and Part I in One Picture
kind: lesson
minutes: 80
chapter: 4
objectives:
- Explain how message brokers sit between RPC and databases, and list their five advantages
- Explain the one-way, asynchronous nature of messaging, topics/queues and consumers
- Explain distributed actor frameworks and why location transparency works better for actors than RPC
- Summarise Chapter 4 and connect the four chapters of Part I
reading:
- Message passing data flow, message brokers | 132-134
- Distributed actor frameworks | 134-135
- Summary | 135-136
complete:
- You can list the five advantages of a message broker over direct RPC
- You drew the Part I concept map
- You answered the quiz
---

:::problem When the receiver isn't ready
An order is placed, and five things must happen: charge the card, email a receipt, update inventory, notify the warehouse, update recommendations. If the web server calls each service directly (RPC) and the email service is down, does the order fail? Do you retry forever while the customer waits? What if the warehouse system moved to a new machine with a new IP address?
:::

:::intuition Somewhere between RPC and a database
**Asynchronous message passing** is in between (p. 132):

- like RPC, a client's request (a **message**) reaches another process with **low latency**;
- like a database, it doesn't go over a direct connection but via an intermediary — a **message broker** (message queue, message-oriented middleware) — that **stores it temporarily**.

Advantages of a broker over direct RPC (p. 133):

1. It **buffers** messages if the recipient is unavailable or overloaded → better reliability.
2. It can **redeliver** messages to a process that crashed → messages aren't lost.
3. The sender doesn't need the recipient's **IP address and port** — handy in the cloud where VMs come and go.
4. One message can go to **several recipients**.
5. It **decouples** sender and recipient logically: the sender publishes and doesn't care who consumes.

The difference from RPC: messaging is usually **one-way**. The sender doesn't wait for a reply (a response, if any, comes on a separate channel). That's what makes it **asynchronous**: send and forget.

<div class="figure">
<svg class="dg" viewBox="0 0 640 170" role="img" aria-label="Producers publish to a topic in a broker; several consumers receive messages">
  <rect class="boxa" x="20" y="25" width="120" height="40" rx="8"/><text x="80" y="50" text-anchor="middle">Order service</text>
  <rect class="boxa" x="20" y="100" width="120" height="40" rx="8"/><text x="80" y="125" text-anchor="middle">Refund service</text>
  <rect class="boxc" x="230" y="45" width="170" height="80" rx="10"/><text x="315" y="75" text-anchor="middle" font-weight="700">Broker</text><text x="315" y="95" text-anchor="middle" class="sub">topic "orders"</text><text x="315" y="110" text-anchor="middle" class="sub">stores messages</text>
  <rect class="boxb" x="490" y="10" width="130" height="36" rx="8"/><text x="555" y="33" text-anchor="middle">Email</text>
  <rect class="boxb" x="490" y="66" width="130" height="36" rx="8"/><text x="555" y="89" text-anchor="middle">Inventory</text>
  <rect class="boxb" x="490" y="122" width="130" height="36" rx="8"/><text x="555" y="145" text-anchor="middle">Warehouse</text>
  <path class="lna" d="M140 45 L230 75 M140 120 L230 100"/>
  <path class="ln" d="M400 70 L490 28 M400 85 L490 84 M400 100 L490 140"/>
  <text x="185" y="160" text-anchor="middle" class="sub">publish (fire and forget)</text>
  <text x="445" y="165" text-anchor="middle" class="sub">deliver to consumers</text>
</svg>
</div>
:::

:::details Brokers, actors, and the chapter summary
### Message brokers (pp. 133–134)
Once dominated by commercial products (TIBCO, IBM WebSphere, webMethods); more recently open-source **RabbitMQ, ActiveMQ, HornetQ, NATS, Apache Kafka** (compared in Chapter 11). Typically: a process sends a message to a named **queue** or **topic**; the broker delivers it to one or more **consumers/subscribers**; there can be many producers and consumers per topic. A topic is one-way, but a consumer can publish to another topic (chains — Chapter 11) or to a **reply queue** for request/response.

Brokers don't enforce a data model — a message is bytes plus metadata — so use any encoding. **Backward and forward compatible encodings** give the most freedom to change publishers and consumers independently and deploy in any order. And beware Figure 4-7 again: a consumer that **republishes** to another topic must preserve unknown fields.

### Distributed actor frameworks (pp. 134–135)
The **actor model** is a concurrency model within one process: instead of threads, locks and race conditions, logic lives in **actors** that communicate only by asynchronous messages. Delivery isn't guaranteed (messages can be lost in some error cases). Each actor handles one message at a time, so it needn't worry about threads, and the framework schedules actors independently.

**Distributed** actor frameworks use the same model across nodes: if sender and recipient are on different nodes, the message is transparently encoded, sent and decoded. **Location transparency works better here than in RPC**, because the actor model *already assumes* messages may be lost, even locally — less fundamental mismatch between local and remote. It's essentially a message broker plus the actor model in one framework.

Rolling upgrades still need compatibility (messages go between old and new nodes). As of 2016:
- **Akka** uses Java serialization by default (no forward/backward compatibility) but can be switched to e.g. Protocol Buffers.
- **Orleans** uses a custom format that doesn't support rolling upgrades — you set up a new cluster, move traffic, shut down the old one (custom serialization plugins possible).
- **Erlang OTP**: record schema changes are surprisingly hard; rolling upgrades possible but need careful planning; the newer maps datatype may help.

### Chapter 4 summary (pp. 135–136)
Encodings affect not just efficiency but **architecture and deployment options**. Rolling upgrades — gradual deploys without downtime, encouraging frequent small releases and allowing faulty releases to be rolled back early — are hugely beneficial for **evolvability**, and they require all data flowing around to be **backward compatible** (new code reads old data) and **forward compatible** (old code reads new data).

- Language-specific encodings: one language, often no compatibility.
- JSON, XML, CSV: widespread; compatibility depends on how you use them; vague about numbers and binary strings; optional schema languages.
- Thrift, Protocol Buffers, Avro: compact, efficient, clearly defined compatibility, schemas as documentation and for code generation; but must be decoded to be human-readable.

Data flow modes: **databases** (writer encodes, reader decodes), **RPC/REST** (client encodes request, server decodes it and encodes a response, client decodes), **asynchronous messages** (sender encodes, recipient decodes). "May your application's evolution be rapid and your deployments be frequent."
:::

:::task Part I concept map
Take the sheet you've been building since Week 2 (data models, then storage engines). Add Chapter 4 and connect everything on **one page**:

- Chapter 1's three goals at the top (reliability, scalability, maintainability).
- Under them: data models (Ch 2) → storage engines (Ch 3: LSM, B-tree, column store) → encodings (Ch 4).
- Draw arrows for recurring ideas: **derived data / read–write trade-offs** (indexes, timelines, materialized views, denormalization), **logs** (Bitcask, LSM WAL, B-tree WAL), **evolvability** (schema-on-read, schema evolution, rolling upgrades).

15 minutes. You'll use this map in Week 6's Part I review.
:::

:::quiz
### mcq
Which is **not** an advantage of a message broker over direct RPC, according to the book?
- [ ] It buffers messages when the recipient is unavailable or overloaded
- [ ] It can redeliver messages to a process that crashed
- [ ] The sender doesn't need to know the recipient's address
- [x] The sender immediately gets the recipient's reply, so it knows the operation succeeded
>>>
Messaging is usually one-way and asynchronous: the sender doesn't wait for a reply. That's a difference from RPC, not an advantage of brokers in the book's list (p. 133).

### mcq
Why does location transparency work better in the actor model than in RPC?
- [ ] Actors never run on remote nodes
- [x] The actor model already assumes messages may be lost even within one process, so remote messaging fits its assumptions
- [ ] Actors use faster networks
- [ ] Actors use Java serialization
>>>
RPC pretends a remote call is a reliable local call; actors never promised reliable delivery in the first place (p. 134).

### predict
Service A consumes messages from topic `orders`, enriches each with a customer name, and republishes to `orders-enriched`. The producer starts adding a new field `giftWrap`. A was written before that field existed and maps messages into its own class. What happens downstream?
- [ ] Downstream consumers see giftWrap normally
- [x] giftWrap may silently disappear from `orders-enriched`, unless A preserves unknown fields
- [ ] The broker rejects the new messages
- [ ] A crashes
>>>
This is the Figure 4-7 problem in a message-passing setting; the book explicitly warns about republishing consumers (p. 134).

### mcq
Which deployment approach did the book say Orleans required (in 2016) because its default encoding didn't support rolling upgrades?
- [ ] Upgrade one node at a time
- [x] Set up a new cluster, move traffic to it, then shut down the old cluster
- [ ] Stop the whole system for the upgrade
- [ ] Recompile all clients
>>>
Without compatible encodings, mixed old/new nodes can't talk, so you have to swap whole clusters (p. 134).

### explain
In one paragraph, connect the three modes of data flow to the two kinds of compatibility. Which mode needs which, and why?
>>>
**Databases**: the writer is often an old or new version of the reader, and data stays for years — backward compatibility (new code reads old data) is essential, and forward compatibility is needed because during rolling upgrades old code reads new data; plus old code must not drop unknown fields. **RPC/REST**: if servers are upgraded first, requests need backward compatibility and responses forward compatibility; across organisations both must last a long time. **Message passing**: producers and consumers are deployed independently in any order, so messages need both backward and forward compatible encodings, and republishing consumers must preserve unknown fields.
:::

:::connect Where Part I ends and Part II begins
Part I looked at data on a **single machine**: how it's modelled, stored and encoded. Part II (from Week 7) asks what happens when data is spread across **many machines** — for scalability, fault tolerance and latency. The three things you've learned are the foundation: replication ships a **log** of changes (Chapter 3) in some **encoding** (Chapter 4) between nodes that may run **different versions** of the code. Next week is a consolidation week with your first project.
:::
