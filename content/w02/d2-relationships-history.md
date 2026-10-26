---
title: Many-to-One, Many-to-Many — and Why History Repeats
kind: lesson
minutes: 90
chapter: 2
objectives:
- Explain normalization as removing duplication of human-meaningful information, and its trade-offs
- Explain why many-to-one and many-to-many relationships fit poorly into document databases
- Describe the hierarchical (IMS), network (CODASYL) and relational models and what "access paths" were
- Explain the key insight of the relational model: a query optimizer built once benefits every application
reading:
- Many-to-one and many-to-many relationships | 31-35
- Are document databases repeating history? (IMS, network model, relational model) | 35-38
complete:
- You can explain normalization in one sentence, with the "rename a city" example
- You did Task 2 of the résumé exercise
- You answered the quiz
---

:::problem Data doesn't stay a tree
Yesterday's résumé fit neatly into one document. But look again at `region_id: "us:91"` in Example 2-1. Why an ID and not just the text "Greater Seattle Area"?

And then product asks for features: companies and schools should be **entities** with their own pages and logos; users can write **recommendations** for each other, shown with the recommender's current name and photo (Figures 2-3 and 2-4). Suddenly each résumé points at things *outside* itself, shared by many other résumés. The tree has become a web. How do we store that?
:::

:::intuition IDs vs copies — normalization
Why store `region_id` instead of the text? Standardised lists (pick from a drop-down) give you (p. 31):

- consistent style and spelling,
- no ambiguity (several cities with the same name),
- **easy updates** — the name is stored in one place,
- localisation (show the region in the viewer's language),
- better search (the list can encode that Seattle is in Washington).

The core question is **duplication**. With an ID, the human-meaningful text ("Philanthropy") lives in exactly *one* place; everything else refers to it by an ID that has no meaning to humans — and therefore never needs to change. If you duplicate the text into every record instead, then when it changes (a city is renamed), **every copy** must be updated: more write work, and a risk that some copies get updated and others don't. Removing such duplication is the key idea of **normalization** (p. 32). Rule of thumb from the book: if you're duplicating values that could be stored in one place, the schema isn't normalized.

The book deliberately suspends judgement on normalization vs denormalization here; Part III returns to it with systematic tools for caching and derived data.
:::

:::visual NormalizationSim | Rename a city
Eight profiles, two ways of storing the city.

**Try this:**
1. In **Store the text**, rename Bombay → Mumbai. Count the rows rewritten.
2. Reset, tick **crash halfway**, and rename again. You now have an *inconsistent* database — some profiles say Mumbai, some Bombay.
3. Switch to **Store an ID**. Rename: one row written, every profile is correct. But notice the cost on the read side: showing a profile now needs a join.
:::

:::details Joins, and a fight from the 1970s
**Normalization needs many-to-one relationships** — many people live in one region — and those don't fit nicely into the document model (p. 32). Relational databases refer to rows by ID all the time because joins are easy. Document databases often have weak join support (in 2016: RethinkDB supported joins, MongoDB didn't, CouchDB only in pre-declared views). Without joins in the database, you **emulate them in application code** with extra queries — the work moves from the database to your code. And data tends to become *more* interconnected as features are added (organizations as entities, recommendations).

### Are document databases repeating history? (pp. 35–38)
This exact debate is older than NoSQL. IBM's **IMS** (1968, built for stock-keeping in the Apollo program, still running on mainframes) used the **hierarchical model**: all data as a tree of records nested within records — remarkably like JSON. It worked well for one-to-many, but made many-to-many hard and had no joins. Developers had to choose between duplicating data or resolving references manually. Sound familiar?

Two solutions competed in the 1970s:

**The network model (CODASYL).** A generalisation of the hierarchical model: a record can have *multiple parents*. Links were not foreign keys but **pointers** stored on disk. The only way to reach a record was to follow a path from a root along chains of links — an **access path**. A query moved a *cursor* through the database by iterating over lists and following pointers; the programmer had to keep all these paths in their head ("navigating around an n-dimensional data space"). Efficient on 1970s hardware (tape drives with very slow seeks), but query code was complicated and inflexible: if you didn't have a path to the data you wanted, you had to rewrite lots of hand-written navigation code.

**The relational model.** Lay all data out in the open: a relation is just a collection of tuples. Read any rows matching any condition; look up by key; insert anywhere. The **query optimizer** decides which parts of the query run in which order and which indexes to use — it chooses the access path automatically. Want to query differently? Declare a new index; queries use it without being rewritten. Optimizers are complex beasts that took years of research — **but you build one once, and every application benefits** (p. 37). Hand-coding access paths is easier for one query; the general-purpose solution wins in the long run.

**Comparison to document databases.** Document databases reverted to the hierarchical model in one way: nesting one-to-many records inside their parent. But for many-to-one and many-to-many, relational and document databases are *not fundamentally different*: both refer to the related item by a unique identifier — a **foreign key** in relational terms, a **document reference** in document terms — resolved at read time by a join or follow-up queries. Document databases have not followed CODASYL's pointer-chasing path.
:::

:::practice 04-document-vs-relational | Task 2: recommendations
Now do **Task 2** of yesterday's exercise: add recommendations (a many-to-many relationship) to both models, and compare a single SQL join with an application-side join.
:::

:::quiz
### predict
A product catalogue stores the manufacturer's name as text inside each of 2 million product documents. The manufacturer "Facebook Inc." renames itself "Meta Platforms". What happens?
- [ ] One update, because the database deduplicates text automatically
- [x] Every product document mentioning it must be rewritten; until that finishes (or if it fails halfway), different products show different names
- [ ] Nothing — old names are kept for history, which is always correct
- [ ] The database rejects the change because of the schema
>>>
Duplicated human-meaningful information means many copies to update: write overhead and a risk of inconsistency. With a `manufacturer_id` reference, you'd update one row — at the cost of a join (or extra lookup) on read.

### mcq
What was an **access path** in the CODASYL network model?
- [ ] An index chosen automatically by the query optimizer
- [x] A chain of pointer links, followed from a root record, that the programmer navigated to reach a record
- [ ] A URL used to fetch a document
- [ ] A foreign key constraint
>>>
Records were linked by on-disk pointers; the only way to a record was to follow a path from a root. The programmer had to know and manage these paths in their code. In the relational model, the optimizer chooses access paths automatically.

### mcq
According to the book, what was the **key insight** of the relational model regarding query optimization?
- [ ] Hand-coded access paths are always faster
- [ ] Queries should be written in COBOL
- [x] A complex query optimizer only has to be built once, and then all applications using the database benefit from it
- [ ] Optimizers are unnecessary if data is normalized
>>>
Writing a general-purpose optimizer is hard, but it is a one-time cost amortised over every application and every query. New indexes are used automatically without rewriting queries, which made it much easier to add features (p. 37).

### mcq
For representing **many-to-one** relationships, how do relational and document databases differ fundamentally?
- [ ] Document databases use on-disk pointers like CODASYL
- [ ] Relational databases embed copies of the related record
- [x] They don't differ fundamentally: both use a unique identifier (foreign key / document reference) resolved at read time
- [ ] Only relational databases can represent them at all
>>>
The book's point on pp. 37–38: the difference is in how *one-to-many* nested data is stored. For references to other entities, both use IDs and resolve them with joins or follow-up queries.

### explain
In your own words: why does the book say document databases are, in one respect, "repeating history"?
>>>
In the 1960s–70s, IMS stored data as a hierarchy — a tree of nested records, just like JSON documents. It was great for one-to-many data but bad at many-to-many relationships and had no joins, so developers had to duplicate data or manually resolve references. Document databases nest data the same way and run into the same problems as soon as data becomes interconnected. The relational model was invented largely to solve those problems.

### tradeoff
You store each blog post as a document. Should the author's display name be embedded in each post, or referenced by `author_id`?
- [ ] Always embed: documents should never contain IDs
- [ ] Always reference: duplication is always wrong
- [x] It depends: embedding makes reads one lookup but requires rewriting all posts when a name changes; referencing keeps one source of truth but needs a join or extra lookup when reading
- [ ] Neither: store the name in a cache only
>>>
This is the normalization trade-off: read cost vs write cost and consistency risk. If names rarely change and posts are read constantly, embedding (denormalizing) might be fine — *if* you have a reliable way to update copies. Part III of the book shows principled ways to maintain such derived copies.
:::

:::connect Where this goes next
Notice the recurring trade-off: **duplicate data to make reads fast, or keep one copy and pay at read time** (join). You saw it in Twitter's timelines (Week 1) and you'll see it again with indexes (Chapter 3), materialized views, and derived data in Part III. Tomorrow: which model leads to simpler code, the truth about "schemaless", and locality.
:::
