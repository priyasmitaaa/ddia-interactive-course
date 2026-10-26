---
title: Thrift and Protocol Buffers — Field Tags and Schema Evolution
kind: lesson
minutes: 95
chapter: 4
objectives:
- Read a Thrift or Protocol Buffers schema and explain what field tags are
- Explain variable-length integers and how CompactProtocol/protobuf save space
- Derive the evolution rules for adding, removing and retyping fields from the encoding
- Explain protobuf's `repeated` and why optional → repeated is a safe change
reading:
- Thrift and Protocol Buffers | 113-116
- Field tags and schema evolution | 116-117
- Data types and schema evolution | 117
complete:
- You can decode the first 10 bytes of Figure 4-4 by hand
- Protobuf exercise tests T1–T3 pass
- You answered the quiz
---

:::problem Stop sending the field names
Yesterday's binary JSON still spelled out `"userName"`, `"favoriteNumber"` and `"interests"` in every record — most of its 66 bytes. If both sides agree on a **schema** in advance, the bytes only need to say *which* field, not its name. That's the idea behind **Apache Thrift** (from Facebook) and **Protocol Buffers** (from Google), both open-sourced in 2007–08. The open question: if the schema is baked into both sides, how can it change without breaking either?
:::

:::intuition Schemas and field tags
Thrift's interface definition language (IDL):

```
struct Person {
  1: required string       userName,
  2: optional i64          favoriteNumber,
  3: optional list<string> interests
}
```

Protocol Buffers:

```
message Person {
  required string user_name       = 1;
  optional int64  favorite_number = 2;
  repeated string interests       = 3;
}
```

Both come with **code generation** tools that produce classes for many languages. The numbers 1, 2, 3 are **field tags**: compact aliases for fields. The encoded data contains tags instead of names.

Think of a paper form with numbered boxes: "Box 1: name, Box 2: phone". If everyone uses the same form layout, you can just write "1=Martin, 2=1337". You can even reprint the form with a box *renamed* — box numbers are what matter.
:::

:::visual EncodingBytes | Tags and varints
@props {"initial":"thriftc"}
**Try this:**
1. **Thrift BinaryProtocol** (59 bytes): each field has a type byte, a 2-byte tag and, for strings, a 4-byte length. 1337 takes a full 8 bytes.
2. **Thrift CompactProtocol** (34 bytes): type and tag delta packed into **one byte**; numbers as **variable-length integers**.
3. **Protocol Buffers** (33 bytes): hover over `10` (tag 2, wire type 0 = varint) and `b9 0a` (1337). Notice `interests` appears as **two separate fields with tag 3** — that's `repeated`.
4. Set favoriteNumber to 5, then 100, then 100000, and watch the varint grow from 1 to 2 to 3 bytes.
:::

:::details Encoding details and evolution rules
### Variable-length integers
CompactProtocol and protobuf don't spend 8 bytes on every 64-bit number. A **varint** stores 7 bits per byte and uses each byte's **top bit** to say "more bytes follow". So in Thrift CompactProtocol (which uses zigzag for signed numbers), numbers between −64 and 63 take one byte, −8192 to 8191 two bytes, and so on (p. 115). 1337 = binary `10100111001`:

- protobuf: low 7 bits `0111001` with the continuation bit → `10111001` = `0xb9`; remaining bits `1010` → `0x0a`. So `b9 0a`.

`required` vs `optional` doesn't change the encoding at all — `required` just adds a runtime check that fails if the field is missing, which catches bugs (p. 116).

### Field tags and schema evolution (pp. 116–117)
An encoded record is just the concatenation of its fields, each identified by **tag number** and annotated with a **datatype**; unset fields are omitted. Consequences:

- **Renaming** a field: fine — names never appear in the data.
- **Changing a tag**: never — all existing data would become invalid.
- **Adding a field**: give it a **new tag number**. Old code reading new data sees an unknown tag and **skips it** — the datatype annotation tells the parser how many bytes to skip. → **forward compatible**. New code reading old data: tags still mean the same thing → **backward compatible**, *provided the new field isn't `required`* (old data never contains it). So every field added after the first deployment must be **optional or have a default**.
- **Removing a field**: the mirror image — you can only remove **optional** fields (never required ones), and you can **never reuse its tag number**, because data with the old tag may still exist and must be ignored by new code.

### Data types and evolution (p. 117)
Changing a field's type may be possible, but values can lose precision or be truncated: change int32 → int64 and new code reads old data fine (pad with zeros), but **old code** reading new data still uses a 32-bit variable, and a large value gets truncated.

Protobuf has no list type; it has `repeated` (a third option besides required and optional): the same tag simply appears multiple times. Nice effect: you can change an **optional** field into a **repeated** one — new code sees a list of zero or one elements in old data; old code reading new data sees only the **last** element. Thrift has a dedicated, parameterised list type: it doesn't allow that evolution, but supports nested lists.

Thrift oddity: it has two binary encodings that matter (BinaryProtocol, CompactProtocol) — actually three, plus two JSON-based formats. "What fun!" (footnote, p. 114).
:::

:::practice 14-protobuf-by-hand | Write the encoder and the skipping decoder
Reproduce the book's 33 bytes exactly, then decode data from a "future" writer that added two new fields.
:::

:::quiz
### predict
In Protocol Buffers, you rename the field `user_name` to `full_name` but keep tag 1. What happens to existing encoded data?
- [x] Nothing — it is still decoded correctly, because field names never appear in the encoded bytes
- [ ] All existing data becomes unreadable
- [ ] Old data is decoded into the wrong field
- [ ] The field becomes required
>>>
Only tags are on the wire. Renaming changes only generated code. Changing the tag number, by contrast, would break all existing data (p. 116).

### mcq
How does old code skip a field with an unknown tag?
- [ ] It looks the tag up in a schema registry
- [x] Each field carries a type annotation (wire type) that tells the parser how many bytes the value occupies
- [ ] It can't; old code crashes on unknown tags
- [ ] Unknown fields are always at the end
>>>
For a varint it reads until the top bit is clear; for length-delimited data it reads the length and skips that many bytes. This makes forward compatibility possible (p. 117). You implemented it in the exercise.

### mcq
Why must a field added after the first deployment be optional or have a default?
- [ ] Required fields use more bytes
- [ ] Optional fields are faster to decode
- [x] New code reading old data would fail the required check, because old writers never wrote the field — breaking backward compatibility
- [ ] Old code can't skip required fields
>>>
`required` is a runtime check on decode. Old records simply don't contain the new tag (p. 117).

### mcq
Why can you never reuse the tag number of a removed field?
- [ ] Tags must be sequential
- [x] Data written with the old field may still exist, and new code would misinterpret it as the new field
- [ ] Code generators forbid it
- [ ] Reusing tags makes encoding slower
>>>
Old data outlives the schema change (databases, files, queues). New code must keep ignoring that tag (p. 117).

### predict
You change an optional `string email = 4;` to `repeated string email = 4;`. An old reader receives a new record containing two emails. What does it see?
- [ ] An error
- [ ] Both emails concatenated
- [x] Only the last email
- [ ] The first email
>>>
A repeated field is just the same tag appearing several times; a single-valued reader keeps overwriting the value and ends with the last one (p. 117).

### explain
Explain how a varint encodes 300, byte by byte. (300 in binary is 1 0010 1100.)
>>>
Split into 7-bit groups from the least significant end: `0101100` (44) and `0000010` (2). The first byte holds the low group with the continuation bit set: `1` + `0101100` = `10101100` = `0xAC`. The second byte holds the next group with the top bit clear (no more bytes): `00000010` = `0x02`. So 300 → `AC 02`. A decoder reads 0xAC, sees the top bit, keeps 44, reads 0x02, adds 2 × 128 = 256 → 300.
:::

:::connect Where this goes next
Field tags make protobuf and Thrift evolvable, but someone must assign and protect those numbers forever. Tomorrow's Avro takes a different route: no tags at all, and an explicit reader/writer schema resolution — which turns out to suit automatically generated schemas. gRPC (built on protobuf) returns on Thursday with RPC.
:::
