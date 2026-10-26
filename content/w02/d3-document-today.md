---
title: Relational vs Document Today — Schemas and Locality
kind: lesson
minutes: 85
chapter: 2
objectives:
- Decide which model leads to simpler application code for a given kind of data
- Explain schema-on-read vs schema-on-write and when each is better
- Explain what part of a schema migration is actually slow
- Explain the limits of the document locality advantage, and the convergence of the two models
reading:
- Relational vs. document databases today (simpler code, schema flexibility) | 38-40
- Data locality for queries, and convergence | 40-42
complete:
- You can argue both sides of "should this app use a document database?"
- You did the schema-on-read exercise (Parts A and B at least)
- You answered the quiz
---

:::problem "Should we use MongoDB or PostgreSQL?"
Teams argue about this constantly, often with slogans: "documents are more flexible", "SQL is more rigorous", "NoSQL is faster". The book cuts through it by asking precise questions about your data: Is it tree-shaped? Do you need joins? Does every record have the same structure? Do you read whole documents at once? Let's go through them.
:::

:::intuition The three arguments, and the counter-argument
**For documents** (p. 38): for some applications the model is closer to the application's data structures; **schema flexibility**; and better **performance through locality**.

**For relational**: better support for **joins**, and for **many-to-one** and **many-to-many** relationships.

### Which leads to simpler code?
- If your data is document-like — a tree of one-to-many relationships, typically loaded all at once — use a document model. Relational **shredding** (splitting a document across several tables) leads to cumbersome schemas and complicated code.
- Documents can't refer directly to a nested item; you say "the second position in user 251's list" — like an access path. Fine if documents aren't deeply nested.
- If you need many-to-many relationships, documents get worse: denormalize (and keep copies consistent yourself) or emulate joins in application code (complex, usually slower).

So it depends on the relationships between data items. For **highly interconnected** data: document is awkward, relational is acceptable, **graph** is most natural (p. 39).
:::

:::details Schemas, migrations, locality
### "Schemaless" is misleading (pp. 39–40)
Most document databases (and JSON columns in relational databases) don't enforce a schema. But the code that reads the data still *assumes* a structure — there is an **implicit** schema. Better terms:

- **Schema-on-read**: the structure is implicit and only interpreted when data is read. Like *dynamic* (run-time) type checking.
- **Schema-on-write**: the schema is explicit and the database makes sure all data conforms. Like *static* (compile-time) type checking.

Neither is right or wrong in general. The difference shows when the data format changes. Book example: split a full `name` into `first_name`.

Document database: just start writing new documents with the new field, and handle old ones when reading:

```js
if (user && user.name && !user.first_name) {
  // Documents written before Dec 8, 2013 don't have first_name
  user.first_name = user.name.split(" ")[0];
}
```

Relational: a migration:

```sql
ALTER TABLE users ADD COLUMN first_name text;
UPDATE users SET first_name = split_part(name, ' ', 1);      -- PostgreSQL
```

Schema changes have a bad reputation, but most databases run `ALTER TABLE` in milliseconds (MySQL at the time copied the whole table, which could take hours). The **`UPDATE`** rewriting every row is what's slow on any database. If that's unacceptable, leave `first_name` NULL and fill it in at read time — just like the document approach.

**Schema-on-read is better when data is heterogeneous**: many different types of objects (impractical to give each its own table), or structure decided by external systems you don't control that may change any time. **A schema is better** when all records are expected to have the same structure: it documents and enforces it. (Chapter 4 goes deeper into schema evolution.)

### Locality — and its limits (pp. 40–41)
A document is usually stored as one continuous string (JSON, XML, or a binary variant like MongoDB's BSON). If you often need the whole document (render a page), locality wins: no multiple index lookups and disk seeks across tables.

But:
- it only helps if you need **large parts** of the document at once — the database usually loads the whole thing even to read a small part, which is wasteful for big documents;
- **updates usually rewrite the whole document**; only changes that don't alter its encoded size can be done in place.

Hence the advice: keep documents small, avoid writes that grow them. These limits significantly narrow where document databases are useful.

Locality isn't exclusive to documents: Google **Spanner** lets a relational schema interleave child rows inside a parent table; Oracle has **multi-table index cluster tables**; Bigtable's **column families** (Cassandra, HBase) manage locality too.

### Convergence (p. 41)
Relational databases gained XML (mid-2000s) and JSON support (PostgreSQL 9.3+, DB2 10.5+) with indexing and querying inside documents. On the document side, RethinkDB supports relational-like joins, and some MongoDB drivers resolve references (a client-side join). The models complement each other, and a **hybrid** of relational and document is a good direction. (Fun fact: Codd's original 1970 paper allowed *nonsimple domains* — nested relations as values — something quite like JSON inside a row.)
:::

:::extra Since 2016
The convergence the book predicted happened. PostgreSQL's binary `jsonb` type (indexed with GIN indexes) is widely used as a document store; MySQL, SQL Server, Oracle and SQLite all have JSON functions (the exercise uses SQLite's). MongoDB added `$lookup` (a join operator, from version 3.2) and multi-document ACID transactions (4.0, 2018). The "relational vs document" choice today is more about defaults and ecosystem than hard capability limits — the book's reasoning about relationships and locality is what still decides good designs.
:::

:::practice 05-schema-on-read | Do the migration both ways
Time an `ALTER TABLE` against the `UPDATE` that fills the column, write a schema-on-read reader, and handle heterogeneous event data. About 35 minutes.
:::

:::quiz
### mcq
Your data is a collection of IoT events from 40 different device vendors, each with a different, changing JSON shape. Which approach fits best?
- [x] Schema-on-read (documents), because the data is heterogeneous and its structure is controlled by external systems
- [ ] Schema-on-write with one table per vendor, migrated whenever a vendor changes format
- [ ] A graph database, because there are 40 vendors
- [ ] It's impossible to store such data
>>>
This is exactly the book's case for schema-on-read (p. 40): many types of object, structure determined by external systems that may change at any time. A schema would hurt more than help.

### mcq
In a relational database, which part of "split `name` into `first_name`" is slow on a large table?
- [ ] `ALTER TABLE ... ADD COLUMN` — it always copies the whole table on every database
- [x] The `UPDATE` that rewrites every row to fill the new column
- [ ] Reading the table afterwards
- [ ] Nothing — both are instant
>>>
Most databases add a column as a metadata change in milliseconds (MySQL historically was an exception). Rewriting every row is slow anywhere, which is why you can leave the column NULL and fill it in at read time. You measured this in the exercise.

### predict
A document database stores each user's entire activity history inside the user's document. It grows to several MB. What do you expect to happen?
- [ ] Reads get faster because of locality
- [x] Reading or updating even a small field gets expensive, since the database typically loads and rewrites the whole document
- [ ] Nothing changes; document size doesn't matter
- [ ] The database automatically splits it into tables
>>>
Locality helps only if you need most of the document at once. Large, growing documents mean every read loads lots of unneeded data, and updates that change the encoded size usually rewrite the whole document — hence "keep documents small" (p. 40).

### mcq
Why does the book call "schemaless" misleading?
- [ ] Because document databases secretly enforce schemas
- [x] Because the reading code still assumes a structure — there is an implicit schema, it's just not enforced by the database
- [ ] Because JSON requires a schema to be parsed
- [ ] Because every document must have the same fields
>>>
Code that reads `user.first_name` assumes the field exists. The structure is implicit and interpreted at read time — hence "schema-on-read" is the more accurate term (p. 39).

### design
You're building a CMS where each article has a title, body, list of tags, list of embedded images (with captions), and an author (shared across many articles, with a profile photo). Sketch which parts you'd nest in an article document and which you'd reference, and justify each choice.
>>>
Nest: title, body, tags (simple values), and images with captions — these belong to one article, form a tree (one-to-many) and are usually loaded together to render the page, so locality helps. Reference: the author, by `author_id` — it's many-to-one (many articles share an author), and the author's name/photo should be updated in one place. Possibly cache/denormalize the author's display name for fast rendering, accepting the need to update copies when it changes. If you later need "articles by authors I follow, tagged X", relational joins (or a graph) become attractive.

### explain
Explain the analogy between schema-on-read/schema-on-write and dynamic/static type checking, and give one advantage of each.
>>>
Schema-on-write checks data structure when it's written, just as a static type checker rejects bad code at compile time: you catch errors early and the schema documents what the data looks like. Schema-on-read only interprets the structure when data is read, like dynamic typing checking at run time: it's flexible — you can write new shapes immediately without a migration, and handle heterogeneous data — but mistakes surface later, in every piece of reading code.
:::

:::connect Where this goes next
Locality — "keep things that are read together, stored together" — is a theme of Chapter 3: B-tree pages, SSTables, and especially column-oriented storage, which deliberately stores data *by column* because analytic queries read one column across millions of rows. Schema evolution gets its full treatment in Chapter 4, where old and new code must read each other's data. Tomorrow: query languages.
:::
