---
title: Query Languages — Declarative, Imperative, and MapReduce
kind: lesson
minutes: 85
chapter: 2
objectives:
- Distinguish declarative from imperative querying, with the sharks example
- Give three reasons declarative languages win (conciseness, room for optimisation, parallelism)
- Use the CSS vs DOM-manipulation analogy to explain declarative advantages
- Explain how MapReduce querying works, why map/reduce must be pure, and why MongoDB added the aggregation pipeline
reading:
- Query Languages for Data | 42-43
- Declarative queries on the web | 43-45
- MapReduce querying | 45-48
complete:
- You can explain why SQL lets the database reorganise data on disk but imperative code doesn't
- You built the tiny MapReduce framework in the exercise
- You answered the quiz
---

:::problem Telling the computer *how* vs *what*
IMS and CODASYL were queried with imperative code: loop over records, follow pointers, one at a time. SQL instead lets you describe the result you want. Is that just a matter of taste? The book argues it's one of the most important ideas in data systems — it's what lets a database get faster *without you changing your queries*.
:::

:::intuition Ordering a meal vs cooking it
**Imperative**: you give step-by-step instructions in a specific order — like cooking from a recipe.

```js
function getSharks() {
  var sharks = [];
  for (var i = 0; i < animals.length; i++) {
    if (animals[i].family === "Sharks") sharks.push(animals[i]);
  }
  return sharks;
}
```

**Declarative**: you describe the result and let someone else work out how — like ordering from a menu.

```sql
SELECT * FROM animals WHERE family = 'Sharks';
```

(In relational algebra: sharks = σ<sub>family = "Sharks"</sub>(animals). SQL follows the algebra closely.)

You specify the *pattern* of the data — conditions, sorting, grouping, aggregation — but not *how* to achieve it. The query optimizer chooses indexes, join methods, and the order of execution.
:::

:::details Why declarative wins
1. **Concise and easier to work with** than an imperative API.
2. **It hides implementation details**, so the database can improve performance without breaking queries. Example (p. 43): to reclaim disk space, the database might move records around and change their order. SQL never promised an order, so that's safe. Imperative code that loops over records *might* rely on order — the database can't know — so it can't safely reorganise. *SQL being more limited gives the database more room to optimise.*
3. **Parallelism.** CPUs get faster by adding cores, not clock speed. Imperative code specifies an order of instructions and is very hard to parallelise; declarative queries specify only the result, so the database is free to use a parallel implementation.

### The web analogy (pp. 43–45)
Highlight the title of the selected page with CSS:

```css
li.selected > p { background-color: blue; }
```

(XSL/XPath equivalent: `li[@class='selected']/p`.) The imperative alternative walks the DOM with nested loops and sets a style attribute. It's longer and worse:

- If the `selected` class is later removed, the blue stays until the page reloads; CSS automatically stops applying.
- To use a faster new API (`getElementsByClassName`), you must rewrite the code; browser vendors can speed up CSS without breaking anyone.

In browsers declarative CSS beats imperative styling; in databases SQL beat imperative query APIs.

### MapReduce querying (pp. 45–48)
MapReduce is a programming model for bulk processing across many machines, popularised by Google (Chapter 10 covers it fully). Some NoSQL stores (MongoDB, CouchDB) offered a limited form for read-only queries. It's **neither fully declarative nor fully imperative**: query logic is written as code snippets that the framework calls repeatedly, based on `map` (a.k.a. collect) and `reduce` (a.k.a. fold/inject) from functional programming.

Shark sightings per month in PostgreSQL:

```sql
SELECT date_trunc('month', observation_timestamp) AS observation_month,
       sum(num_animals) AS total_animals
FROM observations WHERE family = 'Sharks'
GROUP BY observation_month;
```

In MongoDB MapReduce: a declarative filter `{family: "Sharks"}`; `map` is called once per matching document and **emits** a key (e.g. `"1995-12"`) and value (`numAnimals`); emitted pairs are **grouped by key**; `reduce(key, values)` is called once per key and sums them. Two shark documents from December 1995 with 3 and 4 animals → `emit("1995-12", 3)`, `emit("1995-12", 4)` → `reduce("1995-12", [3, 4]) = 7`.

**Map and reduce must be pure functions**: they use only their input, run no extra database queries, and have no side effects. That lets the database run them anywhere, in any order, and re-run them on failure. They can still parse strings, call libraries, do calculations.

Usability problem: you must write two carefully coordinated functions, which is harder than one query, and the optimizer has less to work with. So MongoDB 2.2 added the declarative **aggregation pipeline**:

```js
db.observations.aggregate([
  { $match: { family: "Sharks" } },
  { $group: {
      _id: { year: { $year: "$observationTimestamp" }, month: { $month: "$observationTimestamp" } },
      totalAnimals: { $sum: "$numAnimals" } } }
]);
```

Its expressiveness is similar to a subset of SQL in JSON syntax. The book's moral: *a NoSQL system may find itself accidentally reinventing SQL, albeit in disguise.* Note also: SQL isn't limited to one machine, and MapReduce has no monopoly on distributed query execution.
:::

:::practice 06-declarative-vs-mapreduce | One question, three ways
Write the SQL, build a 15-line MapReduce framework, and (bonus) see what goes wrong when the map function has side effects.
:::

:::quiz
### mcq
Why can a database safely move records around on disk under SQL queries but not under imperative query code?
- [x] SQL doesn't guarantee an order of results (without ORDER BY), so reordering can't break it; imperative code might depend on storage order and the database can't tell
- [ ] SQL queries lock the whole table
- [ ] Imperative code is compiled, SQL is interpreted
- [ ] Moving records is never safe
>>>
Declarative queries state only what result is wanted. Because SQL is "more limited", the database has more freedom to reorganise storage, add indexes, or change algorithms (pp. 42–43).

### mcq
Why must MapReduce `map` and `reduce` functions be pure (no side effects, no extra queries)?
- [ ] So they can be written in JavaScript
- [x] So the framework can run them anywhere, in any order, and re-run them after failures without changing the result
- [ ] Because pure functions are faster
- [ ] To prevent SQL injection
>>>
Purity makes them safe to distribute, reorder and retry. Chapter 10 builds heavily on this: fault tolerance in batch processing comes from re-running deterministic tasks.

### predict
Two documents: `{month: "1995-12", numAnimals: 3}` and `{month: "1995-12", numAnimals: 4}`, plus `{month: "1996-01", numAnimals: 5}`, all sharks. How many times is `reduce` called, and with what?
- [ ] Three times, once per document
- [x] Twice: `reduce("1995-12", [3, 4])` and `reduce("1996-01", [5])`
- [ ] Once, with all values `[3, 4, 5]`
- [ ] Zero times, because map does the summing
>>>
Map emits one pair per document; the framework groups values by key; reduce runs once per distinct key. (Some implementations skip reduce for single-value keys, but conceptually it's once per key.)

### mcq
Which statement best captures why imperative DOM-manipulation code is worse than the CSS rule `li.selected > p`?
- [ ] JavaScript is slower than CSS
- [x] The imperative code doesn't react when the class changes, and must be rewritten to benefit from faster APIs, while CSS is re-evaluated automatically and can be optimised by the browser
- [ ] CSS can only style one element
- [ ] The DOM can't be accessed from JavaScript
>>>
The two problems the book lists (p. 45): stale highlighting after the class is removed, and having to rewrite code to use better APIs. Declarative rules are maintained and optimised by the system.

### explain
"A NoSQL system may find itself accidentally reinventing SQL." Explain what the book means, using MongoDB as the example.
>>>
MongoDB first offered MapReduce for queries: flexible, but awkward (two coordinated functions) and hard to optimise. To make queries easier to write and optimise, it added the aggregation pipeline — a declarative language with stages like `$match` (WHERE) and `$group` (GROUP BY) whose power is similar to a subset of SQL, just written in JSON. The need for declarative, optimisable queries is universal, so systems that drop SQL tend to rebuild something equivalent.

### short
Give two reasons why declarative query languages parallelise more easily than imperative code.
>>>
(1) They specify only the pattern/result, not the order of steps, so the engine is free to split work across cores or machines and combine partial results. (2) Imperative code encodes a specific sequence of instructions (with shared mutable state, loops, ordering dependencies) that would have to be preserved, which makes safe parallel execution very hard.
:::

:::connect Where this goes next
The declarative idea keeps winning: Chapter 10 shows MapReduce in full, then the move "beyond MapReduce" towards declarative dataflow APIs (Spark, Flink, Hive, SQL on Hadoop) — for the same optimisation reasons you saw today. Tomorrow: what if *everything* is related to everything? Graph data models.
:::
