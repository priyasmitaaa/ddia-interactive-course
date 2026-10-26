---
title: Graph queries in SQL, and a tiny Datalog engine
chapter: 2
topic: Property graphs, recursive CTEs, Datalog fixed-point evaluation
minutes: 50
---

## Objective

Run the book's "who emigrated from the US to Europe?" query (Examples 2-4, 2-5, 2-11) for real:
first as a recursive SQL query over a property graph stored in two tables, then by writing a
small Datalog evaluator that derives new facts until nothing changes — Figure 2-6 in code.

## Setup

Python 3.10+. Open `practice/07-graph-queries/graph.py`. The graph of Figure 2-5 is loaded into
SQLite tables `vertices(vertex_id, properties JSON)` and `edges(tail_vertex, head_vertex, label)`.
One extra person, **Sam**, was added: born in the United States (directly at country level) and living in Beaune.

## Predict first

1. Should Sam be in the answer? Does the query need any change to handle a BORN_IN edge that points at a country rather than a state?
2. How many rounds of rule application will the Datalog engine need before it stops? (Think about the deepest location chain: Beaune → Côte-d'Or → Burgundy → France → Europe.)

## Your task

1. **Task 1:** write the recursive SQL in `SQL` (adapt Example 2-5; in SQLite use `json_extract(properties, '$.name')`), and make `task1` run it.
2. **Task 2:** implement `evaluate(facts)`: loop applying rules 1–3 until an iteration adds no new facts. Print the number of new facts per iteration.

## Run it

```
python practice/07-graph-queries/graph.py
```

## Observe

- Answer: **Lucy and Sam**. The `WITHIN*0..` idea — "follow zero or more within edges" — is what handles both. In SQL it costs ~30 lines of `WITH RECURSIVE`; in Cypher it's four lines.
- Your Datalog engine reaches a fixed point after several iterations; each iteration climbs one more level of the location hierarchy — exactly Figure 2-6.

## Questions

1. Why can't a normal (non-recursive) SQL query express this, and what does that say about choosing a data model?
2. Why does Example 2-2 put indexes on *both* `tail_vertex` and `head_vertex`?
3. What's the advantage of Datalog's "rules that build on rules" style for complex data?
4. How is this graph model different from the CODASYL network model of the 1970s? Give two differences.

<details><summary>Discussion</summary>

1. The number of joins needed depends on the data (how many `within` hops lead to the country), so it isn't fixed when you write the query. Recursive CTEs (SQL:1999) can do it but clumsily — a sign the data model doesn't fit the use case (p. 54).
2. To traverse the graph in both directions: outgoing edges via `tail_vertex`, incoming via `head_vertex`. The backwards strategy (start from "Europe", follow incoming `within`) needs the head index.
3. Rules can be named, combined and reused across queries, so a complex query is built up from small, testable pieces (pp. 60–62).
4. Any two of: graph DBs have no schema restricting which vertex may link to which; you can look up a vertex directly by ID or index instead of only through an access path; there's no maintained ordering of edges; queries can be declarative (Cypher, SPARQL) rather than imperative cursor navigation (pp. 54–55).
</details>
