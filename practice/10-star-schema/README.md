---
title: A tiny data warehouse — star schema and aggregates
chapter: 3
topic: OLAP queries, fact and dimension tables, materialized aggregates
minutes: 40
---

## Objective

Write analytic queries against a star schema like the book's grocery example (Figure 3-9),
including the book's own Example 3-1, and build a materialized aggregate to see the
speed-versus-flexibility trade-off of data cubes (pp. 98–100).

## Setup

Python 3.10+. Open `practice/10-star-schema/warehouse.py`. It builds, in memory:
`fact_sales` (300,000 rows: one row per product sold) and dimension tables `dim_date`
(with `weekday` and `is_holiday`), `dim_product` (with `category`, `brand`) and `dim_store`.
The data is synthetic; a weekend effect on candy is hidden in it.

## Predict first

1. Example 3-1 touches how many columns of `fact_sales`? (Look at it before writing it.)
2. How much faster will the query be when answered from a precomputed daily-per-category aggregate?
3. Name one question the aggregate can't answer that the raw facts can.

## Your task

1. **Task 1:** write Example 3-1 (p. 93) as `EXAMPLE_3_1`. Add `ORDER BY` so the output is easy to read.
2. **Task 2:** write `HOLIDAY_REVENUE`: revenue (`quantity * net_price`) per store city, split by `is_holiday`.
3. **Task 3:** create the aggregate table `daily_category_sales` with `CREATE TABLE ... AS SELECT ...`, then answer Example 3-1 from it.

## Run it

```
python practice/10-star-schema/warehouse.py
```

## Observe

- Analytic queries join the fact table to its dimensions ("who, what, where, when") and aggregate over many rows — the opposite of OLTP's "fetch a few rows by key".
- Example 3-1 needs only 3 of the fact table's columns (`date_key`, `product_sk`, `quantity`). A real fact table has 100+ columns — this is the motivation for column-oriented storage.
- The aggregate answers in well under a millisecond instead of hundreds, and gives the same answer.
- The hidden pattern: candy sales jump at weekends.

## Questions

1. Why are dates stored in a dimension table instead of just as a date column in the fact table?
2. How would the schema change if it were a snowflake schema? Why do analysts often prefer the star?
3. Which question can `daily_category_sales` no longer answer? Why do warehouses keep the raw facts anyway?
4. Why don't companies just run these queries on their OLTP database?

<details><summary>Discussion</summary>

1. So you can attach extra information about dates — weekday, holidays, fiscal periods — and filter/group by it (p. 91).
2. Dimensions would be broken into sub-dimensions, e.g. `dim_product.brand_id → dim_brand`, `category_id → dim_category`. Star schemas are simpler for analysts to query (fewer joins) (p. 91).
3. Anything below the aggregate's grain or involving dropped attributes: sales per store, per brand, per price band, per hour… The cube summed them away. Raw data keeps full flexibility; aggregates are only a performance boost (p. 100).
4. Analytic queries scan huge parts of the data and would hurt the performance of the latency-critical transactions; also the data lives in many separate OLTP systems and needs transforming into an analysis-friendly schema (ETL) (pp. 88–89).
</details>
