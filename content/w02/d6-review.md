---
title: Review — Chapter 2 Checkpoint
kind: review
minutes: 60
chapter: 2
objectives:
- Retrieve Chapter 2's ideas from memory and mix them with Chapter 1
- Choose a data model for unfamiliar scenarios and justify it
- Catch up on anything skipped this week (e.g. Datalog Task 2)
reading:
- Re-read the Chapter 2 Summary | 62-63
complete:
- You did today's spaced review
- You answered the checkpoint questions from memory
- You caught up on (or consciously skipped) this week's exercises
---

:::review Today's spaced review
Mixed questions from Weeks 1 and 2, chosen for you. Answer each before looking at the options too closely — retrieval is the workout.
:::

:::task Draw the map of data models
On paper, draw three circles: **Document**, **Relational**, **Graph**. Inside each, write from memory: its shape of data, its strongest use case, one weakness, one query language, and one real product. Between the circles, write what changes as data becomes more interconnected. Then check against the Chapter 2 summary (pp. 62–63). Keep this sheet — you'll add storage engines to it next week.
:::

:::quiz Chapter 2 checkpoint
### tradeoff
A recipe website: each recipe has ingredients, steps and photos, is read far more often than edited, and is always displayed whole. Users can also "follow" chefs and see recipes from chefs they follow. Which model fits best overall?
- [ ] Graph, because users follow chefs
- [x] Documents for the recipes (self-contained trees, read whole), with references for chefs and follows — or a relational database with JSON columns
- [ ] Pure relational with every step and ingredient shredded into separate tables, because normalization is always best
- [ ] It doesn't matter at all
>>>
Recipes are classic documents: one-to-many trees loaded at once, where locality helps. Follows are a simple many-to-many relationship that can be a reference collection or a relational table — not complex enough to require a graph database. A relational DB with JSON support (convergence) is also a fine answer.

### mcq
Which question best decides between a document and a relational model, according to the book?
- [ ] Which one has the faster benchmark?
- [x] What kinds of relationships exist between data items (tree-shaped one-to-many vs many-to-one/many-to-many)?
- [ ] Which one is newer?
- [ ] Which one uses JSON?
>>>
"It's not possible to say in general which data model leads to simpler application code; it depends on the kinds of relationships that exist between data items" (p. 39).

### scenario
A team stores users as documents and embeds a copy of each user's current company name in their profile. A company renames itself and an engineer runs a script to update all affected profiles; the script crashes after updating 40%. What's the state of the system, what concept from this chapter explains it, and how could the design avoid it?
>>>
The data is now inconsistent: 40% of profiles show the new name and 60% the old one, and nothing records which is right. This is the cost of **denormalization** (duplicating human-meaningful information). With a normalized design, profiles would store a `company_id` and the name would be updated in one place, atomically. Alternatively, keep the copies but derive them from a single source of truth with a reliable, restartable process (the Part III approach) — and make the update idempotent so it can be resumed.

### mcq
A colleague says: "We use MongoDB, so we have no schema to worry about." What is the best response?
- [ ] Correct — schemas don't exist in document databases
- [x] You still have an implicit schema that all reading code assumes; it just isn't enforced on write (schema-on-read)
- [ ] MongoDB actually enforces strict schemas
- [ ] Schemas only matter for graph databases
>>>
"Schemaless" is misleading (p. 39). Code reading `user.first_name` encodes assumptions about structure. When the structure changes, every reader must handle old and new shapes.

### explain
Connect Chapters 1 and 2: how does the choice of data model affect *maintainability* (operability, simplicity, evolvability)? Give one example for each of the three models.
>>>
Examples: **Relational** — the query optimizer and declarative SQL are an abstraction that keeps application code simple and evolvable: add an index and existing queries speed up without changes. **Document** — schema-on-read helps evolvability (new fields without migrations) but spreads migration logic into all reading code, adding complexity over time; denormalized copies add operational risk. **Graph** — very evolvable for interconnected data: new kinds of vertices and edges can be added without schema changes, and declarative traversal queries stay short, whereas emulating them in SQL adds accidental complexity.

### short
Name the language and the trick each uses for "zero or more WITHIN hops": Cypher, SPARQL, SQL, Datalog.
>>>
Cypher: `-[:WITHIN*0..]->`. SPARQL: the property path `:within*`. SQL: a recursive common table expression (`WITH RECURSIVE`) that repeatedly adds vertices connected by `within` edges. Datalog: a recursive rule, `within_recursive(L, N) :- within(L, Via), within_recursive(Via, N).` plus a base rule.
:::
