---
title: Sort Order, Writing to Column Stores, and Data Cubes
kind: lesson
minutes: 80
chapter: 3
objectives:
- Explain why rows (not columns) are sorted in a column store, and how sort order acts as an index and aids compression
- Explain why a column store might keep the same data in several sort orders (C-Store, Vertica)
- Explain how column stores handle writes using an LSM-tree-like approach
- Explain materialized views and data cubes, and their speed–flexibility trade-off
reading:
- Sort order in column storage | 96-97
- Writing to column-oriented storage | 98
- Aggregation — data cubes and materialized views | 98-100
- Summary | 100-101
complete:
- You can explain why the first sort key compresses best
- You did Task 3 of the column-store exercise
- You used the data-cube visual and can name a question a cube can't answer
- You answered the quiz
---

:::problem Faster reads, harder writes
Column storage, compression and sorting all make big read-only queries faster. But they make **writes** awkward: you can't update a compressed, sorted column file in place, and inserting one row means touching every column file consistently. And even with fast scans, some aggregates are computed again and again by every dashboard. Can we precompute them?
:::

:::intuition Sorting whole rows
In a column store, rows can be stored in insertion order (inserting is then just appending to each column file) — or we can impose an order, like SSTables, and use it as an **index** (p. 96).

But **you can't sort each column independently**: then the k-th entries would no longer belong to the same row. The data is sorted **a whole row at a time**, even though it's stored by column. The administrator picks sort keys from knowledge of common queries:

- If queries usually target date ranges, make `date_key` the **first sort key**: a "last month" query scans only last month's rows.
- A **second sort key** (e.g. `product_sk`) orders rows with the same date, grouping sales of a product on a day together.

Sorting also **helps compression**: after sorting, the first sort column has long runs of repeated values, so run-length encoding can shrink it to a few kilobytes even for billions of rows. The second key compresses less (its runs restart within each first-key value), and columns further down are essentially random.
:::

:::visual ColumnStoreViz | Sort order and runs
@props {"initialTab":"sort"}
This opens on **Tab 3** ("Sort order & compression"). Switch between insertion order, sorted by `date_key`, and sorted by `date_key, product_sk`. Watch the number of runs per column — fewer runs means better run-length compression. Which column benefits most? Which barely changes?
:::

:::details Several sort orders, writes, and cubes
### Several different sort orders (p. 97)
An idea from **C-Store**, adopted by **Vertica**: different queries benefit from different sort orders, and data has to be **replicated** to several machines anyway (so you don't lose it when one fails). So store each replica **sorted differently**, and answer each query from the version that suits it best. It's a bit like multiple secondary indexes in a row store — but a row store keeps each row in one place and indexes hold pointers, whereas a column store usually has no pointers, just columns of values.

### Writing to column-oriented storage (p. 98)
Update-in-place (B-tree style) is impossible with compressed columns; inserting a row into a sorted table would likely mean rewriting all column files. The solution is one you already know: **LSM-trees**. Writes go to an **in-memory store**, sorted and prepared for disk (row- or column-oriented, doesn't matter). When enough accumulate, they're **merged with the column files and written to new files in bulk** — essentially what Vertica does. Queries examine both the on-disk columns and recent in-memory writes, and the optimizer hides the distinction: analysts see their inserts, updates and deletes immediately.

### Materialized views and data cubes (pp. 98–100)
Warehouse queries are full of aggregates (`COUNT`, `SUM`, `AVG`, `MIN`, `MAX`). If many queries use the same ones, why recompute them from raw data every time? Cache them.

A **materialized view** is like a normal (virtual) view — a table-like object defined by a query — except its results are **actually written to disk**. A virtual view is just a shortcut: the engine expands it into the underlying query when you read it. A materialized view is a **denormalized copy** that must be **updated when the underlying data changes** — making writes more expensive, which is why they're rare in OLTP but more sensible in read-heavy warehouses.

A common special case is the **data cube** (OLAP cube): a grid of aggregates grouped by different dimensions (Figure 3-12). With two dimensions (date, product), each cell holds e.g. `SUM(net_price)` for that date–product pair; summing along a row or column reduces it by one dimension (sales per date regardless of product, or per product regardless of date). Real facts have more dimensions — five in Figure 3-9 — so the cube is a five-dimensional hypercube, summarised along each dimension.

**Pro:** certain queries become very fast — e.g. total sales per store yesterday is just a lookup along one dimension. **Con:** far less flexible than raw data — you can't ask what proportion of sales came from items over $100, because price isn't a dimension. So warehouses keep as much **raw data** as possible and use cubes only as a performance boost for certain queries.

### Chapter 3 in one paragraph (pp. 100–101)
Storage engines split into OLTP-optimised and analytics-optimised. **OLTP**: user-facing, huge request volume, each query touches few records via an index — **disk seek time** is often the bottleneck; engines come from the **log-structured** school (Bitcask, SSTables/LSM-trees, LevelDB, Cassandra, HBase, Lucene: turn random writes into sequential ones) or the **update-in-place** school (B-trees, in all major relational databases). **Analytics**: fewer queries, each scanning millions of rows — **disk bandwidth** is the bottleneck, indexes matter less, and compact **column-oriented** encoding is what counts. Knowing the internals lets you pick tools and reason about tuning parameters.
:::

:::visual DataCubeViz | A two-dimensional data cube
Click any cell, row total or column total to see which query it precomputes. Then press the **"items costing more than $100"** question.
:::

:::practice 11-column-store | Task 3: sort order and runs
Finish Task 3 of the column-store exercise: count runs before and after sorting by `(product_sk, store_sk)`. Look carefully at what happens to `date_key`.
:::

:::quiz
### mcq
Why must a column store sort entire rows rather than each column independently?
- [ ] Sorting columns independently is slower
- [x] Rows are reconstructed by position; sorting columns independently would break the link between the k-th values of different columns
- [ ] Only the first column can be compressed
- [ ] SQL requires it
>>>
The k-th item of every column belongs to the same row only if all columns share one row order (pp. 96–97).

### predict
Rows are sorted by `(date_key, product_sk)`. Which column will compress best with run-length encoding?
- [x] date_key
- [ ] product_sk
- [ ] customer_sk
- [ ] net_price
>>>
The first sort key has the longest runs of repeated values. product_sk has shorter runs (restarting within each date). Columns not in the sort key look random. You saw this in Tab 3 and in the exercise.

### mcq
How do column stores like Vertica handle inserts efficiently?
- [ ] They update compressed column files in place
- [x] Writes go to an in-memory store first and are periodically merged with the column files into new files in bulk, LSM-style
- [ ] They don't allow inserts
- [ ] They maintain a B-tree per column
>>>
The LSM idea again: absorb writes in memory, write out in bulk. Queries combine on-disk columns with recent in-memory writes, transparently (p. 98).

### mcq
What is the difference between a virtual view and a materialized view?
- [ ] There is none
- [ ] A virtual view is stored on disk; a materialized view is computed on the fly
- [x] A virtual view is a shortcut expanded into its query at read time; a materialized view is an actual stored copy of the results that must be updated when the data changes
- [ ] Materialized views only exist in OLTP databases
>>>
Materialization trades write cost and staleness risk for read speed — denormalization again (p. 98).

### tradeoff
A data cube over (date, product, store) answers dashboard queries instantly. An analyst asks for "sales in the first hour after opening, per store". What's the issue?
- [ ] None — cubes can answer any question
- [x] Time of day isn't a dimension of the cube; the answer needs the raw facts, which is why warehouses keep raw data and use cubes only as a performance boost
- [ ] Cubes can't group by store
- [ ] The query needs a B-tree
>>>
The cube has summed away everything that isn't a dimension. Flexibility lives in the raw data (p. 100).

### explain
Explain C-Store/Vertica's "several sort orders" idea and why it doesn't cost as much extra storage as it sounds.
>>>
Different queries benefit from different sort orders (date ranges vs per-product). Since data must be replicated to several machines anyway for fault tolerance, each replica can be stored sorted in a different way; queries use the replica whose sort order best fits their pattern. The redundancy was needed regardless, so you get extra "indexes" almost for free — though writes must now maintain several sort orders (p. 97).
:::

:::connect Where this goes next
Materialized views are **derived data** kept in sync with a source — the same concept as Twitter's timeline caches (Week 1) and indexes (last week). Part III of the book (Chapters 10–11) is all about building and maintaining derived data systematically: batch jobs that rebuild views, and stream processors that update them incrementally. Tomorrow: your LSM-tree lab.
:::
