---
title: Review — Chapter 4 Checkpoint
kind: assessment
minutes: 65
chapter: 4
objectives:
- Retrieve Chapter 4's encodings and compatibility rules from memory
- Apply evolution rules to concrete schema changes
- Interleave with Chapters 1–3
reading:
- Chapter 4 Summary | 135-136
complete:
- You did today's spaced review
- You answered the checkpoint from memory
- The Avro and protobuf exercises pass
---

:::review Today's spaced review
Scheduled questions from all of Part I so far.
:::

:::task Compatibility table from memory
Without notes, fill in this table on paper, then check against the lessons of Days 2–3:

| Change | Protobuf/Thrift: safe? | Avro: safe? | Condition |
|---|---|---|---|
| Add a field | | | |
| Remove a field | | | |
| Rename a field | | | |
| Change int32 → int64 | | | |
:::

:::quiz Chapter 4 checkpoint
### scenario
A mobile app (users update slowly) talks to your backend with Protocol Buffers. You want to replace `string address = 5;` with a structured address (street, city, postcode). Describe a safe way to evolve the schema, and what you must never do.
>>>
Add a new optional field with a **new tag**, e.g. `optional Address structured_address = 9;` (a nested message), keep writing both the old `address` string and the new field for as long as old clients exist, and have new code prefer the structured field when present. Eventually, once no client relies on it, stop writing tag 5 — but never delete it in a way that lets tag 5 be **reused**, and never change tag 5's type to the new message (old clients would misparse it). Mark it reserved. Never make the new field `required`, because old clients won't send it.

### mcq
Which encoding of the book's example record contains neither field names nor field tags?
- [ ] MessagePack
- [ ] Thrift CompactProtocol
- [ ] Protocol Buffers
- [x] Avro
>>>
Avro concatenates values in schema order; the writer's schema says what they are (p. 119).

### tradeoff
A team uses JSON over REST between 40 internal microservices and complains about payload sizes and frequent breakage when fields change. What's a reasonable suggestion and its main cost?
- [x] Move internal APIs to a schema-based binary format (e.g. gRPC/Protocol Buffers) with a schema registry and compatibility checks; the cost is losing human-readable payloads and needing tooling to inspect them
- [ ] Switch to Java serialization for speed
- [ ] Switch to XML for stricter schemas
- [ ] Remove all optional fields
>>>
Schemas give compactness, documentation and checkable compatibility (pp. 123–124); the downside is that data must be decoded to be read (p. 135). REST/JSON could stay for public APIs.

### mcq
Which statement about rolling upgrades is correct?
- [ ] They require every node to stop at the same time
- [ ] They only need backward compatibility
- [x] They allow releasing without downtime and rolling back faulty releases early, but require both backward and forward compatibility of all data flowing around
- [ ] They're only possible with Avro
>>>
Summary, p. 135: during rolling upgrades, different nodes run different versions, so data must be compatible in both directions.

### explain
Connect Chapter 3 and Chapter 4: in your Bitcask store, which "encoding" decisions did you make, and how would you evolve the record format if you later wanted to store a timestamp with each record?
>>>
The record format (crc, key_len, value_len, key, value; little-endian 32-bit integers; a special value_len for tombstones) is an encoding with an implicit schema. To add a timestamp compatibly: add a **format version** (e.g. a version byte or a flag in the header) so new code can recognise both old and new records; new code reads old records without a timestamp (backward compatible, default timestamp unknown). Old code reading new records would misparse them unless the format was designed with forward compatibility (e.g. a header length field so unknown header bytes can be skipped) — so before rolling out, upgrade all readers first, then start writing the new format. Compaction can gradually rewrite old records into the new format ("data outlives code").

### short
Name the three ways data flows between processes, and who encodes/decodes in each.
>>>
(1) **Databases**: the writing process encodes, the reading process (possibly a later version) decodes. (2) **Services via REST/RPC**: the client encodes the request, the server decodes it, encodes the response, and the client decodes the response. (3) **Asynchronous message passing** (brokers, actors): the sender encodes a message, the recipient(s) decode it (p. 136).
:::
