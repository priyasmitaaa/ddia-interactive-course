---
title: Why Encoding Matters — Compatibility, JSON and Binary JSON
kind: lesson
minutes: 85
chapter: 4
objectives:
- Explain backward and forward compatibility and why rolling upgrades require both
- Explain encoding (serialization) vs in-memory representation
- List the problems of language-specific formats (pickle, Java serialization)
- Explain the subtle problems of JSON, XML and CSV, and what binary JSON variants (MessagePack) do and don't fix
reading:
- Chapter 4 opening — compatibility | 107-108
- Formats for Encoding Data, language-specific formats | 108-110
- JSON, XML and binary variants | 110-113
complete:
- You can define backward and forward compatibility without mixing them up
- You did the encoding-pitfalls exercise
- You answered the quiz
---

:::problem Old and new code, running at the same time
You add a field to a record. In a small program you'd change the code and the data at once. In a real system you can't:

- **Server-side**, you do a **rolling upgrade** (staged rollout): deploy the new version to a few nodes at a time, check it's healthy, continue. No downtime — but for a while, old and new versions run side by side.
- **Client-side** (mobile apps, desktop software), users update whenever they feel like it — maybe never.

So old code and new code, and old and new data formats, all coexist (p. 108). For the system to keep working, compatibility must hold in **both** directions.
:::

:::intuition Backward and forward compatibility
- **Backward compatibility**: **newer code can read data written by older code.** Usually easy: you know the old format and can handle it.
- **Forward compatibility**: **older code can read data written by newer code.** Harder: old code must *ignore additions* it has never heard of.

Memory trick: backward = new code looking *back* at old data; forward = old code coping with data from the *future*.

### Two representations
In memory, data lives in objects, structs, lists, hash tables and trees, optimised for the CPU (with pointers). To write it to a file or send it over the network, you must turn it into a **self-contained sequence of bytes** — a pointer means nothing to another process. Memory → bytes is **encoding** (a.k.a. serialization, marshalling); bytes → memory is **decoding** (parsing, deserialization, unmarshalling). The book says "encoding" because "serialization" means something else in Chapter 7 (transactions). And encoding has nothing to do with encryption.
:::

:::details The formats
### Language-specific formats (pp. 109–110)
Java's `java.io.Serializable`, Ruby's `Marshal`, Python's `pickle`, Kryo… Convenient (save and restore objects with almost no code), but with deep problems:

1. **Tied to one language** — reading the data from another language is very hard; you're committed to that language for a long time and can't easily integrate with other organisations.
2. **Security** — to restore objects of the right types, the decoder must be able to instantiate arbitrary classes. If an attacker can make your application decode an arbitrary byte sequence, this frequently leads to serious vulnerabilities, up to remote code execution. Never decode such formats from untrusted sources.
3. **Versioning is an afterthought** — forward/backward compatibility often neglected.
4. **Efficiency is an afterthought** — Java serialization is notorious for poor performance and bloated output.

Verdict: generally a bad idea for anything but very transient purposes.

### JSON, XML, CSV (pp. 110–111)
Widely known, widely supported, almost as widely disliked. XML is criticised as verbose and complicated; JSON is popular thanks to built-in browser support and simplicity; CSV is less powerful. All are textual and somewhat human-readable, but:

- **Numbers are ambiguous.** XML and CSV can't distinguish a number from a string of digits (without an external schema). JSON distinguishes strings and numbers, but not integers from floats, and specifies no precision. Integers above **2⁵³** can't be represented exactly as IEEE 754 doubles, so they become inaccurate in languages like JavaScript. Twitter's 64-bit tweet IDs are returned **twice** — as a JSON number and as a decimal string — to work around this.
- **No binary strings.** JSON and XML handle Unicode text well but not raw bytes, so people **Base64**-encode binary data — it works, but it's hacky (and ~33% bigger).
- **Optional, complicated schemas.** XML Schema and JSON Schema are powerful and complicated; many JSON tools don't use schemas, so correct interpretation (numbers, Base64) is left to application code.
- **CSV has no schema** and vague escaping rules (what if a value contains a comma or newline?) — formally specified, but not every parser follows the spec.

Still, they're **good enough** for many purposes, especially **data interchange between organisations**: the hard part is getting organisations to agree on anything, not prettiness or efficiency.

### Binary encodings of JSON (pp. 111–113)
Inside one organisation you can use something more compact and faster to parse — the gain is negligible for small data but big at terabytes. Hence many binary JSON formats (MessagePack, BSON, BJSON, UBJSON, BISON, Smile) and binary XML (WBXML, Fast Infoset). Some add datatypes (integer vs float, binary strings), but they keep the JSON data model — and since there's no schema, **they must still include every field name** in the encoded data.

Example 4-1:

```json
{ "userName": "Martin", "favoriteNumber": 1337, "interests": ["daydreaming", "hacking"] }
```

In MessagePack (Figure 4-1): `0x83` = object (top 4 bits `0x80`) with 3 fields (bottom 4 bits); `0xa8` = string (top bits `0xa0`) of length 8; then the 8 bytes of `userName`… **66 bytes**, versus **81** for compact textual JSON. Is a small saving worth losing human-readability? Unclear. The next lesson gets the same record into **32 bytes**.
:::

:::visual EncodingBytes | The same record, six encodings
@props {"initial":"msgpack"}
These are real encoders: for the book's example they produce exactly the bytes of Figures 4-1 to 4-5.

**Try this:**
1. Click **MessagePack** and hover over byte groups. Find the field names (red) — they take up a large part of the 66 bytes.
2. Compare the size bars for all six formats. Today: JSON vs MessagePack. Tomorrow: the rest.
3. Edit the record: make `userName` 40 characters long, or clear `favoriteNumber`. Watch which formats grow by how much.
:::

:::practice 13-encoding-pitfalls | Break JSON and CSV on purpose
Reproduce the 2⁵³ tweet-ID corruption and Twitter's workaround, measure Base64 overhead, and watch a naive CSV writer produce a file that a real parser reads differently.
:::

:::quiz
### mcq
You deploy v2 of a service that writes a new field. Some servers still run v1 and read those records. Which property must hold for v1 to keep working?
- [ ] Backward compatibility
- [x] Forward compatibility
- [ ] Neither, as long as the database has a schema
- [ ] Both are impossible during a rolling upgrade
>>>
Old code (v1) reading data written by newer code (v2) is forward compatibility. Old code must ignore the additions it doesn't understand.

### mcq
Which is **not** one of the book's objections to language-specific formats like `pickle` or Java serialization?
- [ ] They tie your data to one programming language
- [ ] Decoding can instantiate arbitrary classes, a frequent source of security problems
- [ ] Versioning and efficiency are often afterthoughts
- [x] They cannot represent nested objects
>>>
They represent nested objects just fine — that's their convenience. The problems are language lock-in, security, versioning and efficiency (pp. 109–110).

### predict
A JavaScript client receives `{"id": 1203940218741645313}` from an API. What will `JSON.parse(...).id` most likely be?
- [ ] Exactly 1203940218741645313
- [x] A nearby but different number, because integers above 2⁵³ can't be represented exactly as doubles
- [ ] A string
- [ ] An error
>>>
No error — a silently wrong number. That's why Twitter's API sends tweet IDs a second time as a string (p. 110). You reproduced it in the exercise.

### mcq
Why is MessagePack only a little smaller than textual JSON for Example 4-1 (66 vs 81 bytes)?
- [x] Without a schema, it still has to include all the field names in the encoded data
- [ ] It stores numbers as text
- [ ] It compresses with gzip
- [ ] It adds checksums
>>>
Binary JSON keeps the JSON data model with no schema, so `userName`, `favoriteNumber` and `interests` are spelled out in every record (p. 111).

### explain
Explain in your own words why backward compatibility is "normally not hard", but forward compatibility "can be trickier" (p. 108).
>>>
When you write the new code, you already know the old data format, so you can explicitly handle it — or keep the old parsing code around. For forward compatibility, the old code was written before the new format existed, so it can't know what's coming; it only works if the old code was designed (or the format was designed) to ignore or preserve things it doesn't understand.

### scenario
Your team stores user sessions with Python's `pickle` in Redis, read and written only by your own Python service. A new team wants to read sessions from a Go service. What problems do you foresee, and what would you migrate to?
>>>
Go can't easily decode pickle — it's tied to Python. Pickle has weak versioning, so changing the session class in Python may break reading old sessions; and decoding pickle data is unsafe if anyone else can ever write to that Redis key. Migrate to a language-independent format with clear evolution rules: JSON (simple, cross-language, readable — be careful with large integers and binary data) or Protocol Buffers/Avro (compact, schema-documented, explicit compatibility). A rolling migration: write both formats for a while, read whichever exists.
:::

:::connect Where this goes next
Compatibility is a relationship between one process that encodes and another that decodes. On Thursday you'll see the three ways data flows between processes — databases, services, message brokers — and which compatibility each needs. Tomorrow: schema-driven binary formats that encode the same record in about a third of JSON's size and make compatibility rules explicit.
:::
