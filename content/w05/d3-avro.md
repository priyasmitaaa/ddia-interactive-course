---
title: Avro — Writer's Schema, Reader's Schema, and the Merits of Schemas
kind: lesson
minutes: 95
chapter: 4
objectives:
- Explain why Avro's encoding has no tags or type markers, and what that requires of the reader
- Explain schema resolution between writer's and reader's schemas
- Apply Avro's evolution rules (defaults, unions with null, aliases)
- Explain how the reader obtains the writer's schema in files, databases and network connections
- Explain why Avro suits dynamically generated schemas, and list the merits of schemas in general
reading:
- Avro, the writer's schema and the reader's schema | 118-120
- Schema evolution rules, but what is the writer's schema? | 120-122
- Dynamically generated schemas, code generation | 122-123
- The merits of schemas | 123-124
complete:
- You can state Avro's compatibility rule in one sentence
- Avro exercise tests T1–T4 pass
- You answered the quiz
---

:::problem Even smaller, and friendlier to change
**Apache Avro** started in 2009 as a Hadoop sub-project because Thrift wasn't a good fit for Hadoop's use cases (p. 118). It also uses a schema — written either in Avro IDL (for humans) or JSON (for machines):

```
record Person {
  string                 userName;
  union { null, long }   favoriteNumber = null;
  array<string>          interests;
}
```

No tag numbers anywhere. Encoded, the example record is **32 bytes** — the smallest of all. But if the bytes don't say which field is which, how can anything ever change?
:::

:::intuition Nothing but values
In Avro's encoding (Figure 4-5) there's **nothing to identify fields or their types** — values are simply concatenated: a string is a length prefix and UTF-8 bytes (which could just as well be an integer, as far as the bytes are concerned); integers are zigzag varints. To parse it, you walk through the fields **in the order the schema lists them**, using the schema for each field's type. So the data can only be decoded by code that has the **exact schema the writer used**.

The trick: there are two schemas.

- The **writer's schema** — whatever version the encoding application knows (e.g. compiled into it).
- The **reader's schema** — what the decoding application expects (its code may have been generated from it).

They don't have to be the same, only **compatible**. When decoding, the Avro library looks at both **side by side** and translates data from the writer's schema into the reader's (Figure 4-6):

- fields can be in a different order — they're **matched by name**;
- a field the writer has and the reader doesn't → **ignored**;
- a field the reader expects and the writer didn't write → **filled in with the default** from the reader's schema.

Analogy: a translator who reads a letter written with the sender's dictionary, then re-tells it in your vocabulary, skipping things you don't care about and telling you "not mentioned" (the default) for things you asked about.
:::

:::visual SchemaResolver | Resolve old and new schemas
**Try this:**
1. Start with **Figure 4-6**: the reader has `userID`, the writer has `photoURL`. Switch between the two directions.
2. **Add a field with a default**: compatible both ways.
3. **Add a field WITHOUT default**: which direction breaks? Read the red line.
4. **Remove a field without default**: now the *other* direction breaks.
5. Experiment: make your own change and predict both verdicts before looking.
:::

:::details Rules, the writer's schema, and why schemas are good
### Evolution rules (pp. 120–121)
In Avro terms: **forward compatibility** = new writer schema, old reader schema; **backward compatibility** = new reader, old writer.

> To maintain compatibility, you may only add or remove a field that **has a default value**.

Add a field without a default → new readers can't read old data (backward broken). Remove a field without a default → old readers can't read new data (forward broken).

**Null is not a universal default.** To allow null you use a **union**: `union { null, long, string } field;`. Null can only be a default if it's a branch of the union (strictly, the default must match the *first* branch's type). More verbose, but it prevents bugs by being explicit. So Avro has no `optional`/`required` markers — it has unions and defaults.

Changing a field's **type** is possible if Avro can convert it. **Renaming** works via **aliases** in the reader's schema: backward compatible, not forward compatible. Adding a **branch to a union**: likewise backward but not forward compatible.

### But what is the writer's schema? (pp. 121–122)
Including the whole schema in every record would wipe out the space savings. It depends on context:

- **Large file with many records** (common in Hadoop, Chapter 10): all records share one schema, so put it **once at the start of the file** — Avro's *object container files*.
- **Database with individually written records**: records may have different writer's schemas. Prefix each record with a **schema version number** and keep the list of schema versions in the database (LinkedIn's **Espresso** works this way).
- **Network connection**: the two processes **negotiate the schema version on connection setup** (Avro RPC).

A **database of schema versions** is useful anyway: documentation, and a chance to check compatibility before deploying. A version can be an incrementing integer or a hash of the schema.

### Dynamically generated schemas (pp. 122–123)
No tags turns out to matter. Say you dump a relational database to a binary file: generate an Avro record schema per table, one field per column, names = column names. If the database schema changes (one column added, one removed), just **regenerate** the Avro schema and export again; readers match fields by name. With Thrift or protobuf, someone would have to assign tags by hand (or very carefully automate it, never reusing old tags) — dynamically generated schemas weren't their design goal.

### Code generation (p. 123)
Thrift and protobuf rely on code generation — great for statically typed languages (efficient structures, type checking, IDE autocompletion). In dynamic languages (JavaScript, Ruby, Python) it's less useful and often frowned upon, and for generated schemas it's an obstacle. Avro's code generation is optional: an object container file is **self-describing** (it embeds the writer's schema), so you can open it with the Avro library like a JSON file — handy with tools like Apache Pig.

### The merits of schemas (pp. 123–124)
Protobuf, Thrift and Avro schema languages are much simpler than XML Schema or JSON Schema (which support detailed validation like regex patterns or ranges), so they're easier to implement and support many languages. The ideas aren't new: **ASN.1** (standardised 1984) uses tag numbers similarly and its DER encoding still encodes SSL/X.509 certificates — but it's complex and badly documented. Most relational databases also have proprietary binary network protocols, decoded by drivers (ODBC/JDBC).

Schema-based binary encodings are:
1. **More compact** than binary JSON — no field names.
2. **Documentation that's always up to date** — it's required for decoding.
3. **Checkable** — a schema database lets you verify forward/backward compatibility before deploying.
4. **Good for static typing** — generated code gives compile-time checks.

So **schema evolution gives you the flexibility of schemaless JSON databases, with better guarantees and better tooling.**
:::

:::practice 15-avro-resolution | Implement Avro resolution
Encode the book's record into exactly 32 bytes, then implement decoding with a writer's schema and a reader's schema — the tests check each evolution rule.
:::

:::quiz
### mcq
What does an Avro decoder need in order to parse a record's bytes?
- [ ] Nothing; Avro data is self-describing per record
- [ ] The field tags embedded in the record
- [x] The exact writer's schema, because the bytes contain only concatenated values with no field identifiers or types
- [ ] The reader's schema only
>>>
Without the writer's schema, there's no way to know where one field ends and the next begins (p. 119). The reader's schema is then used to translate the result.

### predict
Writer's schema: `userName`, `favoriteNumber` (default null), `interests`. Reader's schema adds `userID: long` **with no default**. The reader decodes an old record. What happens?
- [ ] userID is set to 0
- [ ] userID is set to null
- [x] Decoding fails: the reader expects a field the writer didn't write, and there is no default
- [ ] The extra field is ignored
>>>
Adding a field without a default breaks backward compatibility (new reader, old writer) (p. 121). Give it a default and it works.

### mcq
In Avro, how do you make a field nullable?
- [ ] Mark it `optional`
- [ ] All fields are nullable by default
- [x] Use a union type that includes `null`, e.g. `union { null, long }`
- [ ] Set its type to `any`
>>>
Avro has no optional/required markers; it uses unions and defaults, which makes nullability explicit (p. 121).

### mcq
LinkedIn's Espresso stores Avro records written at different times with different schemas. How does a reader know each record's writer's schema?
- [ ] The full schema is stored inside every record
- [x] Each record starts with a schema version number, and the schema versions are stored in the database
- [ ] All records are rewritten whenever the schema changes
- [ ] The schema is negotiated when the client connects
>>>
A version number per record plus a schema registry (p. 122). Big files instead put the schema once at the top; RPC negotiates it per connection.

### tradeoff
You export a 300-table relational database nightly to binary files for the analytics team, and tables change often. Why is Avro a better fit than Protocol Buffers here?
- [ ] Avro is faster to encode
- [x] Avro schemas can be regenerated from the table definitions each night with fields matched by name; protobuf would need tag numbers maintained carefully by hand across schema changes
- [ ] Protobuf can't encode strings
- [ ] Protobuf files can't be read by Hadoop
>>>
Dynamically generated schemas were a design goal of Avro and not of Thrift/protobuf (pp. 122–123).

### explain
State Avro's compatibility rule and explain *why* it's exactly the rule you'd expect, from how resolution works.
>>>
Rule: only add or remove fields that have a default value. Why: resolution matches fields by name. Writer-only fields are harmlessly ignored. Reader-only fields must be filled in from somewhere — the only source is the reader's default. When you **add** a field, a new reader can meet old data lacking it (needs a default for backward compatibility). When you **remove** a field, an old reader still expects it but new data lacks it (needs a default in the old schema for forward compatibility). Either way, the field present on only one side needs a default.
:::

:::connect Where this goes next
You now know three ways to make data evolvable: protobuf/Thrift tags, Avro schema resolution, and schema-on-read JSON. Tomorrow: the *places* data flows — through databases (where "data outlives code"), through services (REST and RPC, and why a network call is not a function call), and next through message brokers.
:::
