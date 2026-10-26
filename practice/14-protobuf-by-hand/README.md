---
title: Protocol Buffers by hand — varints, tags and forward compatibility
chapter: 4
topic: Binary schema-driven encoding, field tags, skipping unknown fields
minutes: 45
---

## Objective

Write a Protocol Buffers encoder and decoder for the book's `Person` record without any library,
reproduce the exact 33 bytes of Figure 4-4, and prove to yourself *why* protobuf is forward
compatible: an old decoder can skip fields it has never heard of, because each field carries its
tag and wire type.

## Setup

Python 3.10+. Files: `practice/14-protobuf-by-hand/proto.py` (TODOs) and `test_proto.py`.
Keep the Encoding visualization from today's lesson open — hovering its Protocol Buffers bytes
shows the same structure you're about to write.

## Predict first

1. How many bytes does the varint encoding of 1337 take? Of 2⁶³ − 1?
2. Which bytes in the encoding would change if you renamed `user_name` to `name` in the schema?
3. An old decoder receives a record with an unknown field tag 4 of wire type 2. How does it know how many bytes to skip?

## Your task

1. **TODO 1:** `encode_varint` / `decode_varint` → T1.
2. **TODO 2:** `encode_person` → T2 (the book's 33 bytes, exactly).
3. **TODO 3:** `decode_person`, skipping unknown tags by wire type → T3.

## Run it

```
python practice/14-protobuf-by-hand/test_proto.py
```

## Observe

- 1337 needs only 2 bytes as a varint (vs 8 in Thrift BinaryProtocol).
- Field names never appear in the bytes — renaming a field changes nothing on the wire, but changing a tag number breaks every existing record.
- The old decoder reads newer data correctly and simply reports the tags it skipped.

## Questions

1. Why can you never reuse a tag number of a deleted field?
2. Why must every field added after the first deployment be optional (or have a default)?
3. Protobuf has no list type, only `repeated`. What evolution does that make possible (p. 117)?
4. You change `favorite_number` from int32 to int64. Which direction of compatibility is at risk, and how?

<details><summary>Discussion</summary>

1. Old data with that tag may still exist (in databases, files, queues); new code would interpret it with the new field's meaning (p. 117).
2. New code reading old data would fail a `required` check, because old writers never set the new field — that breaks backward compatibility.
3. An optional single-valued field can become `repeated`: new code sees a list of zero or one elements in old data; old code reading new data sees only the last element.
4. Forward compatibility: old code holds the value in a 32-bit variable and truncates numbers that don't fit (p. 117).
</details>
