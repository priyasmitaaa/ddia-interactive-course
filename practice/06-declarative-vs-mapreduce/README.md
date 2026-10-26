---
title: Imperative vs declarative vs MapReduce
chapter: 2
topic: Query languages, purity of map/reduce functions
minutes: 35
---

## Objective

Answer the book's marine-biologist question — sharks sighted per month (pp. 45–47) — three ways,
and build a tiny MapReduce framework so you understand what MongoDB's `mapReduce` (and later,
Hadoop in Chapter 10) actually does with your two functions.

## Setup

Python 3.10+. Open `practice/06-declarative-vs-mapreduce/sharks.py`. It generates 50,000 observations.
`imperative()` is already written.

## Predict first

1. Which of the three versions leaves the database the most freedom to choose *how* to execute the query (e.g. use an index, run in parallel)?
2. The framework may call your `map` function on documents in any order, on any machine, and re-run it after a failure. What would go wrong if `shark_map` incremented a global counter or wrote to a file?

## Your task

1. Write the SQL in `declarative_sql()` (use `strftime('%Y-%m', observation_timestamp)` and `GROUP BY`).
2. Implement `map_reduce(docs, map_fn, reduce_fn, query)`: filter with `query`, call `map_fn` on each doc (it *yields* key–value pairs), group values by key, call `reduce_fn(key, values)` once per key.
3. Implement `shark_map` and `shark_reduce`.
4. Bonus: make `shark_map` impure — e.g. count calls in a global — then call `map_reduce` twice. What breaks?

## Run it

```
python practice/06-declarative-vs-mapreduce/sharks.py
```

## Observe

- All three produce identical results; the difference is *who decides how*.
- In MapReduce you write two carefully coordinated functions; in SQL you write one statement. That usability gap is why MongoDB added the declarative aggregation pipeline (p. 47) — "accidentally reinventing SQL".

## Questions

1. Why can a database safely reorder records on disk under a SQL query, but not under imperative code that iterates in storage order?
2. Why must map and reduce be pure functions?
3. Why do declarative languages parallelise more easily?
4. Is MapReduce declarative or imperative?

<details><summary>Discussion</summary>

1. SQL doesn't promise an order (without ORDER BY), so the database can move data around. Imperative code might rely on the order and the database can't know whether it does (pp. 42–43).
2. So the framework can run them anywhere, in any order, and re-run them after failures without changing the result (p. 47). Side effects would be repeated or lost.
3. They specify the pattern of results, not the algorithm or order of steps, so the engine is free to split the work across cores and machines.
4. Somewhere in between: the framework's structure is fixed (map, group, reduce), but the logic inside is ordinary code snippets.
</details>
