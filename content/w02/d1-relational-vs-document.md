---
title: Relational vs Document — the Résumé Example
kind: lesson
minutes: 90
chapter: 2
objectives:
- Explain the idea of layered data models, each hiding the layer below
- Summarise why NoSQL appeared and what "polyglot persistence" means
- Explain the object-relational (impedance) mismatch
- Model a résumé both relationally and as a document, and explain the locality advantage of the document
reading:
- Chapter 2 opening — layers of data models | 25-26
- The relational model and the birth of NoSQL | 26-27
- The object-relational mismatch | 28-31
complete:
- You can explain why one-to-many relationships form a tree
- You completed Task 1 of the résumé exercise (Task 2 can wait until tomorrow)
- You answered the quiz
---

:::problem Choosing a shape for your data
Every program models the world: people, orders, sensor readings. When you store that model, you have to express it in a **general-purpose data model** — tables, JSON documents, or a graph. That choice shapes not only how the code is written, but how you *think* about the problem (p. 25). Some operations become easy and fast, others awkward or slow.

Pick a model that fits badly, and you'll fight it for years: boilerplate translation code, extra queries, or data that drifts out of sync. This chapter is about matching the model to the data.
:::

:::intuition Layers, all the way down
Applications are built by layering one data model on top of another (p. 25):

1. You model the real world as **objects / data structures** in your code.
2. You store them in a **general-purpose data model**: JSON documents, relational tables, a graph. *(This chapter.)*
3. The database engineers represent that model as **bytes** in memory, on disk, on the network. *(Chapter 3.)*
4. Hardware engineers represent bytes as electrical currents, light pulses, magnetic fields.

Each layer hides the complexity below it with a clean model — that's what lets database vendors and application developers work together without knowing each other's internals.

### The relational model and its challengers
Edgar Codd proposed the relational model in 1970: data is organised into **relations** (SQL: tables), each an unordered collection of **tuples** (rows). Many doubted it could be efficient, but by the mid-1980s relational databases and SQL dominated, and they stayed dominant for 25–30 years — through challengers like the network and hierarchical models (1970s), object databases (late 80s/early 90s) and XML databases (2000s). Relational databases generalised remarkably well, far beyond their origins in business data processing.

**NoSQL** (2009) started as a catchy Twitter hashtag for a meetup, later reinterpreted as "Not Only SQL". Its drivers (p. 27): greater scalability (huge datasets, very high write throughput); preference for open source; specialised queries the relational model handles poorly; frustration with restrictive schemas. The likely future is **polyglot persistence**: relational databases used alongside a variety of non-relational stores, each where it fits.
:::

:::details The object-relational mismatch
Most code is object-oriented; relational data is tables, rows, columns. The awkward translation layer between them is called the **impedance mismatch** (borrowed from electronics). ORM frameworks (ActiveRecord, Hibernate) reduce the boilerplate but can't hide the differences entirely.

Take a résumé (a LinkedIn profile, Figure 2-1). Fields like `first_name` appear once per user → columns of `users`. But a person has *several* positions, *several* education entries, *several* contact details: **one-to-many** relationships. Options (p. 28):

1. **Normalized tables** (traditional SQL): separate `positions`, `education`, `contact_info` tables with a `user_id` foreign key.
2. **Structured/JSON/XML column types** (later SQL standards; PostgreSQL, Oracle, DB2, SQL Server) that hold multi-valued data inside one row, queryable and indexable.
3. **Encode as JSON text in a plain column**, letting the application interpret it — but then the database usually can't query inside it.

For a self-contained document like a résumé, JSON (Example 2-1) is quite appropriate. Document databases like MongoDB, RethinkDB, CouchDB and Espresso use this model.

**Locality** is the document's big advantage here (p. 29): to show a profile relationally you need several queries (one per table) or a messy multi-way join. In the JSON version, everything is in one place: one query.

**A tree.** The one-to-many relationships from a user to positions, education and contact info form a **tree** (Figure 2-2) — and JSON makes the tree explicit.

Some argue JSON reduces the impedance mismatch. Keep two caveats in mind for later: JSON has its own problems as an encoding format (Chapter 4), and "no schema" is not automatically an advantage (Day 3 this week).
:::

:::visual ResumeModel | Render one profile, two ways
Press **Render Bill's profile page** in each mode. Watch which rows the relational version must touch, query by query — and how the document version gets the whole tree in one read.

Then look closely at the document: `region_id` and `industry_id` are still **IDs**. Even the document needs another lookup to display "Greater Seattle Area". That's tomorrow's topic.
:::

:::practice 04-document-vs-relational | Build both models in SQLite
Do **Task 1** today (load a profile from each model and count the queries). Task 2 — recommendations, a many-to-many feature — fits tomorrow's lesson perfectly, so it's fine to stop after Task 1.
:::

:::quiz
### mcq
Which relationship in a résumé is **one-to-many** and naturally forms a tree under the user?
- [x] A user's list of past positions
- [ ] The region the user lives in (shared with many other users)
- [ ] The industry the user works in
- [ ] Recommendations written between users
>>>
Each position belongs to exactly one user, and one user has many positions — a parent with children, a tree. Region and industry are **many-to-one** (many users share one region); recommendations are **many-to-many** (users ↔ users). Those don't fit a tree.

### mcq
What is the main performance advantage of storing the whole profile as one JSON document?
- [ ] JSON is a smaller encoding than relational rows
- [x] Locality: all the data needed to render the profile is in one place, so one query fetches it
- [ ] Documents can't be corrupted
- [ ] It allows many-to-many joins to run faster
>>>
The book highlights locality (p. 29): the relational version needs multiple queries or a multi-way join across tables, while a document fetch is one lookup. JSON is not especially compact (Chapter 4), and document databases are generally *weaker* at joins.

### mcq
What is the "impedance mismatch"?
- [ ] The speed difference between memory and disk
- [ ] A bug when two databases use different character encodings
- [x] The awkward translation between objects in application code and the tables/rows/columns of a relational database
- [ ] The difference between SQL dialects
>>>
Objects nest and reference each other freely; relational data is flat tables. Code (or an ORM) must translate between them. ORMs reduce the boilerplate but can't fully hide the mismatch (p. 28).

### mcq
Which of these was **not** one of the driving forces behind NoSQL that the book lists?
- [ ] Need for greater scalability, e.g. very high write throughput
- [ ] Preference for free and open-source software
- [ ] Frustration with restrictive relational schemas
- [x] Relational databases being unable to store text data
>>>
Relational databases store text just fine. The four listed drivers are scalability, open source, specialised query operations poorly supported by the relational model, and the desire for a more dynamic, expressive data model (p. 27).

### explain
Explain the idea of "layered data models" using an example from your own experience (e.g. a phone contacts app). Name at least three layers.
>>>
Example: (1) In the app's code, a `Contact` object with a name, a list of phone numbers and a photo. (2) The app stores contacts in a general-purpose data model, e.g. SQLite tables (`contacts`, `phone_numbers`) or JSON documents. (3) SQLite represents those tables as bytes in pages of a file on flash storage (B-trees, Chapter 3). (4) The flash chip represents bits as electrical charges. Each layer hides the details of the layer below, so the app developer never thinks about B-tree pages or charge levels.

### short
What does "polyglot persistence" mean, and why does the book think it's the likely future?
>>>
Using several different data stores within one application or organisation — relational databases alongside document stores, search indexes, caches, graph databases — each for the use case it suits best. Because different applications (and different parts of one application) have different requirements, no single technology is best for everything (p. 27).
:::

:::connect Where this goes next
Today's tree-shaped data is where documents shine. Tomorrow you'll see what happens when data stops being a tree — many-to-one and many-to-many relationships — and why that exact problem was fought over in the 1970s (the hierarchical vs network vs relational "great debate"). The locality idea returns in Chapter 3 (how storage engines lay out data on disk) and in column-oriented storage, which flips locality on its head for analytics.
:::
