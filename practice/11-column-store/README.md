---
title: Row store vs column store, bitmaps and RLE
chapter: 3
topic: Column-oriented storage, bitmap encoding, run-length encoding, sort order
minutes: 45
---

## Objective

Store the same 400,000-row, 20-column fact table both row by row and column by column, run
the same analytic query on each, and measure how many bytes each must read. Then build
bitmap indexes with run-length encoding (Figure 3-11) and see how sort order changes
compressibility (pp. 96–97).

## Setup

Python 3.10+. Open `practice/11-column-store/columns.py`. Data files are written to a temporary
folder and deleted afterwards (about 70 MB while running). `query_rows` is given.

## Predict first

1. The query needs 2 of 20 columns. How many MB will the row store read vs the column store?
2. After sorting all rows by `(product_sk, store_sk)`, which column will have the fewest runs? Which column gets *worse*?

## Your task

1. **Task 1:** `query_columns` — read only `product_sk.col` and `quantity.col` and compute the same total.
2. **Task 2:** `bitmap(column, value)` (a Python `int` used as a bit set) and `rle(bits, n)`. The harness then answers `product_sk IN (7,8,9) AND store_sk = 3` with `|` and `&`.
3. **Task 3:** `count_runs(values)`; the harness compares insertion order with sorted order.

## Run it

```
python practice/11-column-store/columns.py
```

## Observe

- The column store reads about **10× less** data (2 of 20 columns) and is correspondingly faster. With 100+ columns the gap is bigger still.
- A bitmap for one of 200 products is mostly zeros; RLE shrinks 400,000 bits to a few thousand numbers.
- Sorting by `product_sk` collapses it to 200 runs, `store_sk` (second key) improves a lot, later columns don't improve — and `date_key`, which was perfectly ordered by insertion time, is destroyed. Every sort order favours some queries over others.

## Questions

1. Why can't each column be sorted independently?
2. Why does the first sort key compress best and later keys hardly at all?
3. Your analysts query mostly by date range, sometimes by product. Which sort order would you choose? How does Vertica (C-Store) avoid having to choose just one?
4. Why are compressed, sorted column files bad at in-place inserts, and how do column stores handle writes?

<details><summary>Discussion</summary>

1. Rows are reconstructed by position: the k-th value in each column file belongs to row k. Sorting columns independently would break that correspondence (p. 96).
2. After sorting, equal first-key values are contiguous, giving long runs. Within each run the second key is sorted, so it has shorter runs; beyond that the values are effectively random (p. 97).
3. Sort primarily by `date_key` (range scans become contiguous). C-Store/Vertica store the data — which must be replicated anyway — in several different sort orders and pick the best one per query (p. 97).
4. Inserting into the middle would mean rewriting every column file consistently. Instead, writes go to an in-memory store (LSM-style) and are merged into new column files in bulk; queries combine both (p. 98).
</details>
