---
title: Stars and Snowflakes — Schemas for Analytics
kind: lesson
minutes: 85
chapter: 3
objectives:
- Explain fact tables and dimension tables, and why facts are stored as individual events
- Explain why dates get a dimension table
- Compare star and snowflake schemas
- Write an analytic query that joins a fact table with its dimensions (Example 3-1)
reading:
- Stars and snowflakes — schemas for analytics | 90-93
complete:
- You can sketch a star schema for a new domain
- You wrote Example 3-1 in the warehouse exercise
- You answered the quiz
---

:::problem One formula for (almost) every warehouse
OLTP applications use all sorts of data models (Chapter 2). Analytics is far less diverse: most warehouses follow one formulaic style, the **star schema** (also called **dimensional modelling**). Once you can read one, you can read nearly all of them.
:::

:::intuition Facts in the middle, dimensions around them
At the centre: a **fact table** (Figure 3-9: `fact_sales`). Each row is an **event** at a particular time — here, one product bought by a customer; for web analytics, a page view or a click. Facts are captured as **individual events** because that keeps maximum flexibility for later analysis — which makes fact tables enormous (Apple, Walmart, eBay: tens of petabytes, mostly facts).

Some fact columns are **attributes** (price sold at, supplier cost → profit margin). Others are **foreign keys to dimension tables**, which describe the **who, what, where, when, how and why** of the event: `dim_product` (SKU, description, brand, category, fat content, package size…), `dim_store`, `dim_customer`, `dim_promotion` — and even **`dim_date`**, because a date table can encode extra facts about dates such as public holidays, so queries can compare holiday and non-holiday sales.

Draw the relationships and the fact table sits in the middle with foreign keys radiating out like rays — hence **star**.

<div class="figure">
<svg class="dg" viewBox="0 0 560 260" role="img" aria-label="Star schema: fact_sales in the centre, five dimension tables around it">
  <rect class="boxc" x="200" y="100" width="160" height="60" rx="8"/><text x="280" y="125" text-anchor="middle" font-weight="700">fact_sales</text><text x="280" y="143" text-anchor="middle" class="sub">quantity, net_price, …</text>
  <rect class="boxa" x="30" y="20" width="130" height="40" rx="8"/><text x="95" y="45" text-anchor="middle">dim_date</text>
  <rect class="boxa" x="400" y="20" width="130" height="40" rx="8"/><text x="465" y="45" text-anchor="middle">dim_product</text>
  <rect class="boxa" x="30" y="200" width="130" height="40" rx="8"/><text x="95" y="225" text-anchor="middle">dim_customer</text>
  <rect class="boxa" x="400" y="200" width="130" height="40" rx="8"/><text x="465" y="225" text-anchor="middle">dim_promotion</text>
  <rect class="boxa" x="215" y="2" width="130" height="36" rx="8"/><text x="280" y="25" text-anchor="middle">dim_store</text>
  <path class="ln" d="M200 110 L160 50 M360 110 L400 50 M200 150 L160 210 M360 150 L400 210 M280 100 V38"/>
</svg>
</div>
:::

:::details Snowflakes, width, and the queries
**Snowflake schema**: dimensions are broken further into sub-dimensions — e.g. separate `dim_brand` and `dim_category` tables referenced from `dim_product`. More normalized, but star schemas are often preferred because they're **simpler for analysts** to work with (p. 91).

**Warehouse tables are wide**: fact tables often have over 100 columns, sometimes several hundred; dimension tables are wide too (a store's services, in-store bakery, square footage, opening date, last remodel, distance to the nearest highway…).

A typical analytic query (Example 3-1, p. 93) — are people more inclined to buy fresh fruit or candy depending on the day of the week?

```sql
SELECT dim_date.weekday, dim_product.category,
       SUM(fact_sales.quantity) AS quantity_sold
FROM fact_sales
  JOIN dim_date    ON fact_sales.date_key   = dim_date.date_key
  JOIN dim_product ON fact_sales.product_sk = dim_product.product_sk
WHERE dim_date.year = 2013
  AND dim_product.category IN ('Fresh fruit', 'Candy')
GROUP BY dim_date.weekday, dim_product.category;
```

Notice what it touches: a **huge number of rows** (every fruit or candy purchase in 2013), but only **three columns** of `fact_sales` (`date_key`, `product_sk`, `quantity`). Hold that thought — it's the whole motivation for tomorrow's lesson.
:::

:::practice 10-star-schema | Query a small warehouse
Write Example 3-1 and a holiday-revenue query against 300,000 synthetic sales, then build a materialized aggregate and compare speed and flexibility. (A weekend pattern is hidden in the data — find it.)
:::

:::quiz
### mcq
In a star schema, what does each row of the **fact table** represent?
- [ ] One product in the catalogue
- [ ] One store
- [x] One event that occurred at a particular time, such as a product being purchased
- [ ] A daily summary of sales
>>>
Facts are individual events, kept for maximum flexibility. Dimension rows describe the who/what/where/when of those events.

### mcq
Why is the date usually modelled as a **dimension table** rather than just a timestamp column?
- [ ] Timestamps can't be stored in fact tables
- [x] So extra information about dates (weekday, public holidays, fiscal periods) can be attached and used in queries
- [ ] To save space in the fact table
- [ ] Because SQL doesn't support date functions
>>>
A `dim_date` row can say "2014-01-01 is a Wednesday and a holiday", letting queries compare holiday and non-holiday sales (p. 91).

### tradeoff
Snowflake vs star: what's the trade-off?
- [x] Snowflake schemas are more normalized (sub-dimensions such as brand and category tables), but star schemas are simpler for analysts to query
- [ ] Star schemas are more normalized
- [ ] Snowflake schemas don't have fact tables
- [ ] There's no difference
>>>
Normalization reduces duplication of strings like brand names, but means more joins in every analyst's query. Analysts often prefer the star (p. 91).

### predict
Example 3-1 runs over a fact table with 120 columns and 5 billion rows. Roughly how many of those columns does it actually need?
- [ ] All 120
- [ ] About 60
- [x] 3 — date_key, product_sk and quantity
- [ ] None; it only uses dimension tables
>>>
Analytic queries typically touch only 4 or 5 columns of a wide fact table (p. 93). A row-oriented store would still read all 120 columns of every row it touches.

### design
Design a star schema for a music-streaming service that wants to analyse listening. What is the fact table, which columns does it have, and which dimension tables surround it?
>>>
Fact table: `fact_plays`, one row per play event: `date_key`, `time_key` (or a timestamp), `user_sk`, `track_sk`, `device_sk`, `country_sk`, `playlist_sk` (nullable), plus attributes like `seconds_played`, `skipped` (bool), `was_offline`. Dimensions: `dim_date` (weekday, holidays), `dim_user` (plan type, signup date, age band), `dim_track` (artist, album, genre, duration, release date — in a snowflake, artist and album might be separate tables), `dim_device`, `dim_country`, `dim_playlist`. Each play is an individual event so analysts can later slice by any combination (e.g. skip rate by genre per country on weekends).
:::

:::connect Where this goes next
Fact tables with trillions of rows and 100+ columns, queried 3 columns at a time: tomorrow we store them **by column** instead of by row. And the fact table's nature — an append-only history of events — makes it a cousin of the logs you built last week.
:::
