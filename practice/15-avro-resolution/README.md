---
title: Avro — writer's schema, reader's schema, resolution
chapter: 4
topic: Tagless binary encoding, schema resolution by name, compatibility rules
minutes: 50
---

## Objective

Implement Avro's binary encoding — the most compact of the book's formats (32 bytes, Figure 4-5) —
and its key idea: data is decoded with the **writer's** schema and then translated into the
**reader's** schema by matching field names, filling in defaults (pp. 119–121). You'll see the
compatibility rules emerge from the code rather than memorising them.

## Setup

Python 3.10+. Files: `practice/15-avro-resolution/avro.py` (TODOs 1–4) and `test_avro.py`.
The Schema Resolution visualization in today's lesson shows the same rules interactively.

## Predict first

1. Avro bytes contain no field tags and no type markers. What must the reader have to decode them at all?
2. A new reader schema adds `userID` (long, no default). What happens when it reads old data?
3. A new writer drops `interests`, which has no default. Who breaks: new readers or old readers?

## Your task

1. **TODO 1:** `write_long` / `read_long` (zigzag + varint) → T1.
2. **TODO 2:** `encode_value` → T2 (the book's exact 32 bytes).
3. **TODO 3:** `decode_value` → T3.
4. **TODO 4:** `decode` with writer/reader resolution → T4.

## Run it

```
python practice/15-avro-resolution/test_avro.py
```

## Observe

- Without the writer's schema, the bytes are meaningless — there is literally nothing saying where a field starts.
- Field order can differ between writer and reader; matching is by name.
- Adding or removing a field is safe in both directions **only if it has a default** — exactly the rule on p. 120.

## Questions

1. How does a reader get the writer's schema in (a) a large file of records, (b) a database of individually written records, (c) a network connection (p. 121–122)?
2. Why is Avro friendlier than Protocol Buffers for schemas generated automatically from a database table?
3. Why does Avro use unions with `null` instead of making every field nullable?
4. Renaming a field with an alias in the reader's schema is backward compatible but not forward compatible. Why?

<details><summary>Discussion</summary>

1. (a) Once, at the start of the file (object container files). (b) A schema version number at the start of each record, plus a registry of schema versions (as Espresso does). (c) Negotiate it when the connection is set up (Avro RPC).
2. There are no tag numbers to assign and keep stable: fields are matched by name, so you can regenerate the schema from the table after every change and readers still resolve it (p. 122).
3. Being explicit about what can be null prevents bugs; null can only be a default if it's a branch of the union (p. 121).
4. A new reader knows the alias, so it can map the old name to the new one. An old reader only knows the old name and finds no matching field in new data.
</details>
