---
title: Data Flow Through Databases and Services (REST and RPC)
kind: lesson
minutes: 95
chapter: 4
objectives:
- Explain why databases need both backward and forward compatibility, and the "lost unknown field" problem
- Explain "data outlives code" and how databases avoid rewriting old data
- Compare REST and SOAP, and explain service-oriented / microservice architectures
- Explain why RPC's location transparency is fundamentally flawed
- State which compatibility each side of an RPC needs, and how APIs are versioned
reading:
- Modes of Data Flow; Data flow through databases | 124-127
- Data flow through services — REST and RPC | 127-130
- Remote procedure calls, current directions, encoding and evolution for RPC | 129-132
complete:
- You reproduced Figure 4-7 in the simulator and fixed it in the exercise
- You can list four ways a network request differs from a local function call
- You answered the quiz
---

:::problem Who encodes, and who decodes?
Compatibility is a relationship between the process that **encodes** data and the one that **decodes** it (p. 125). But data flows between processes in different ways — and each way creates different compatibility problems:

1. via **databases** (write now, read later — possibly years later),
2. via **service calls** (REST and RPC — request now, response now),
3. via asynchronous **message passing** (tomorrow).
:::

:::intuition A database is a message to your future self
The process that writes to a database encodes; the process that reads decodes. With one process, the reader is just a later version of the writer — storing something is **sending a message to your future self**, so **backward compatibility** is clearly needed.

But usually many processes share a database — different services, or many instances of one service. During a **rolling upgrade**, some run new code and some old. So a value written by **new code** may be read by **old code**: **forward compatibility** is needed too.

And there's a snag (Figure 4-7). New code adds a field and writes it. Old code reads the record, **decodes it into its model object** (which has no attribute for the new field), changes something, re-encodes and writes it back. The new field is **gone**. The encoding formats can preserve unknown fields, but your application layer must not throw them away. Not hard to fix — you just need to be aware of it.
:::

:::visual RollingUpgradeSim | Figure 4-7, live
**Try this:** upgrade one server to v2, set a profile photo from it, then press "Update favoriteNumber" on a v1 server. Watch `photoURL` disappear from the shared record. Reset, tick **v1 code preserves unknown fields**, and repeat.
:::

:::details Databases, services, and RPC
### Different values written at different times (pp. 126–127)
Any value can be updated at any time, so one database holds values written five milliseconds ago and **five years ago**. You can replace all your code in minutes; the five-year-old data stays in its original encoding unless explicitly rewritten: **data outlives code**. Migrating (rewriting) data is expensive on large datasets, so most databases avoid it: e.g. adding a column with a null default doesn't rewrite rows — when an old row is read, missing columns are filled with nulls (MySQL being an exception that often rewrites the table). Espresso uses Avro's evolution rules for storage. Schema evolution lets the whole database **look as if** encoded with one schema, though storage contains many historical versions.

**Archival storage**: a snapshot for backup or for loading into a warehouse is usually encoded with the **latest** schema (you're copying anyway). Since a dump is written once and immutable, Avro object container files fit — or an analytics-friendly columnar format like **Parquet**.

### Services (pp. 127–129)
Clients and servers: the server exposes an **API** over the network — a **service**. The web works this way (browsers, HTTP, URLs, HTML) and so do native apps and JavaScript apps using Ajax, usually receiving JSON rather than HTML. A server can itself be a client of another service — decomposing an application by functionality is **service-oriented architecture (SOA)**, more recently refined and rebranded as **microservices**. A key goal: services are **independently deployable and evolvable**, each owned by one team releasing often without coordinating — so old and new versions of clients and servers run at the same time, and their encodings must be compatible.

When the protocol is HTTP, it's a **web service** — used by apps over the public internet, between services inside one organisation (middleware), and between organisations (public APIs, payments, OAuth).

**REST** is not a protocol but a design philosophy building on HTTP: simple data formats, URLs to identify resources, HTTP features for caching, authentication and content-type negotiation. **SOAP** is an XML-based protocol that tries to be independent of HTTP, with a sprawling set of WS-* standards and APIs described in **WSDL** (enabling code generation; the REST counterpart mentioned is **Swagger**). SOAP relies heavily on tooling, has interoperability problems between vendors, and has fallen out of favour outside large enterprises.

### RPC and why it's flawed (pp. 129–131)
EJB and Java RMI (Java-only), DCOM (Microsoft-only), CORBA (very complex, no backward/forward compatibility) — all based on the **Remote Procedure Call** (since the 1970s): make a remote request look like a local function call (**location transparency**). Convenient at first, but **fundamentally flawed**, because a network request is different:

1. **Unpredictable**: the request or response may be lost, the remote machine slow or down — outside your control. You must anticipate it, e.g. by retrying.
2. **A third outcome: timeout.** A local call returns, throws, or never returns. A network call may return *nothing*, and then **you don't know whether it got through** (Chapter 8).
3. **Retries can duplicate work**: if only responses are lost, retrying performs the action several times — unless you build **deduplication (idempotence)** into the protocol. (You saw this in Week 1's exercise!)
4. **Latency is much higher and wildly variable** — under a millisecond or many seconds for the same call.
5. **Parameters must be encoded** into bytes — fine for numbers and strings, problematic for large objects; no passing pointers.
6. **Different languages**: the framework must translate types (recall JavaScript's 2⁵³ problem).

So there's no point making a remote service look too much like a local object. Part of REST's appeal: it doesn't pretend the network isn't there.

### RPC today (pp. 131–132)
RPC isn't going away: Thrift and Avro include RPC; **gRPC** uses Protocol Buffers; Finagle uses Thrift; Rest.li uses JSON over HTTP. The new generation is more explicit that remote ≠ local: **futures/promises** for asynchronous, failure-prone calls (and combining parallel requests), gRPC **streams** of requests and responses, and **service discovery** (finding which IP/port serves a service — more in Chapter 6). Custom binary RPC can outperform JSON over REST, but REST is great for experimentation and debugging (a browser or `curl` is enough), universally supported, with a huge tool ecosystem. So: **REST dominates public APIs; RPC frameworks dominate requests between services of one organisation, typically within one datacenter.**

**Evolution for RPC**: a reasonable simplifying assumption is that **servers are updated first, clients second** → you need **backward compatibility on requests** (new server reads old clients' requests) and **forward compatibility on responses** (old clients read new servers' responses). Compatibility comes from the encoding: Thrift, gRPC and Avro RPC follow their format's rules; SOAP via XML Schemas (with pitfalls); RESTful JSON APIs treat adding optional request parameters or new response fields as compatible. Across organisations you can't force clients to upgrade, so compatibility must last a long time — perhaps forever — and providers end up running **multiple API versions side by side**. No agreed versioning approach: version in the URL, in the HTTP `Accept` header, or stored per API key on the server.
:::

:::practice 16-rolling-upgrade | Fix the lost field
Reproduce Figure 4-7 in Python with a dataclass model, then write a v1 model that preserves unknown fields.
:::

:::quiz
### mcq
Why do databases often need **forward** compatibility, not just backward?
- [ ] Because databases store data in the future
- [x] Because during a rolling upgrade, old code may read values that new code has already written
- [ ] Because SQL requires it
- [ ] They don't; only backward compatibility matters for databases
>>>
Several processes share the database, and during an upgrade some run old code. Old code reading new data = forward compatibility (p. 125).

### predict
A v2 service adds `photoURL`. A v1 instance reads a record (containing photoURL) into a class without that attribute, increments a counter, and saves it. What's in the database afterwards?
- [ ] The record with photoURL and the new counter
- [x] The new counter, but photoURL is gone
- [ ] An error
- [ ] The old counter and photoURL
>>>
Decoding into a model object that lacks the field, then re-encoding, drops it. That's Figure 4-7 — the encoding format could have preserved it, but the application layer threw it away.

### mcq
Which is the key reason the book calls RPC's location transparency "fundamentally flawed"?
- [ ] RPC is slower than REST
- [ ] RPC can't use JSON
- [x] A network call can fail or time out in ways a local call can't — after a timeout you don't even know whether the request was executed
- [ ] RPC only works within one programming language
>>>
All the differences (lost messages, timeouts, duplicate execution on retry, variable latency, encoding of parameters) come from the network being unreliable and slow. Pretending it's local hides exactly the problems you must handle (pp. 130–131).

### mcq
Assuming servers are upgraded before clients, which compatibility does an RPC API need?
- [ ] Forward on requests, backward on responses
- [x] Backward on requests, forward on responses
- [ ] Only backward compatibility
- [ ] None, if both sides use the same framework
>>>
New servers must understand old clients' requests (backward); old clients must understand new servers' responses (forward) (p. 132).

### tradeoff
You're building a public API for third-party developers and an internal API between two of your own backend services in the same datacenter. Which styles does the book's reasoning suggest?
- [ ] gRPC for both
- [ ] SOAP for both
- [x] REST/JSON for the public API (easy to explore with curl, supported everywhere, big tool ecosystem); an RPC framework like gRPC is reasonable internally (performance, generated code, schema evolution)
- [ ] Java RMI internally, CORBA publicly
>>>
That's exactly the split the book observes (p. 131). Note that even with RPC internally, you must still handle timeouts, retries and idempotence explicitly.

### explain
"Data outlives code." Explain what this means and one consequence for how you write new code.
>>>
You can replace all of your application code within minutes, but the data in the database stays in whatever encoding it was written in — possibly years ago — unless it's explicitly migrated, which is expensive. Consequence: new code must be able to read every historical format that still exists in storage (backward compatibility), e.g. handle missing new fields with defaults (like nulls for added columns), and schema changes should be made in ways that don't require rewriting all old data.
:::

:::connect Where this goes next
The RPC problems listed today — lost messages, timeouts that tell you nothing, duplicate execution on retry, unbounded latency — are the central subject of **Chapter 8**. Idempotence returns in Chapters 9 and 11. Tomorrow: message brokers and actors, the third mode of data flow, and a wrap-up of Part I.
:::
