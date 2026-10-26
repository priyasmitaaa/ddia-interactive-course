---
title: Schema-on-write vs schema-on-read
chapter: 2
topic: Schema flexibility, migrations, heterogeneous data
minutes: 35
---

## Objective

Carry out the book's example change — splitting `name` into `first_name` (p. 39) — in both
styles, measure what's actually slow about a migration (p. 40), and see where schema-on-read
is the natural choice (heterogeneous data from systems you don't control).

## Setup

Python 3.10+. Open `practice/05-schema-on-read/schema.py`. Part A builds a 300,000-row SQLite table.

## Predict first

1. Which will take longer on 300,000 rows: `ALTER TABLE ... ADD COLUMN`, or the `UPDATE` that fills the new column? By roughly how much?
2. In the document version, where does the "migration logic" live instead?

## Your task

1. **Part A:** add the `ALTER TABLE` and the `UPDATE` in `part_a`. Note the two timings.
2. **Part B:** implement `read_user` so it handles both old (`name`) and new (`first_name`/`last_name`) documents.
3. **Part C:** implement `amount_eur` for three differently-shaped event sources.

## Run it

```
python practice/05-schema-on-read/schema.py
```

## Observe

- `ALTER TABLE ADD COLUMN` takes about a millisecond: most databases (the book singles out older MySQL as an exception) just change metadata. The slow part is the `UPDATE` that rewrites every row.
- Schema-on-read moves the migration into **every piece of code that reads the data**, forever (or until you rewrite old documents).
- For Part C, any fixed table schema would either have lots of nullable columns or need one table per source.

## Questions

1. The book compares schema-on-read/write to dynamic/static type checking. Explain the analogy.
2. If an `UPDATE` over a huge table is too slow, what can a relational application do instead? (p. 40)
3. Name two situations where schema-on-read is clearly better, and one where an enforced schema is clearly better.
4. Is a document database truly "schemaless"? Why is that word misleading?

<details><summary>Discussion</summary>

1. Schema-on-write checks structure when data is written (like a compiler rejecting badly typed code); schema-on-read only interprets structure when data is read (like a runtime that discovers a missing field when the code runs).
2. Leave `first_name` as NULL and fill it in at read time in application code — exactly the document-database approach — possibly backfilling gradually.
3. Better on read: many different object types that don't fit one table each; data whose structure is decided by external systems that may change at any time. Better enforced: when all records are supposed to have the same structure — the schema documents and enforces it, catching bad writes early.
4. Reading code still assumes a structure (an *implicit* schema); the database just doesn't enforce it. That's why the book prefers "schema-on-read".
</details>
