---
title: Transaction Processing or Analytics?
kind: lesson
minutes: 75
chapter: 3
objectives:
- Distinguish OLTP and OLAP access patterns using the five properties of Table 3-1
- Explain why companies run analytics in a separate data warehouse
- Describe the ETL process
- Explain why OLTP databases and warehouses diverged internally despite a shared SQL interface
reading:
- Transaction Processing or Analytics? | 87-88
- Data warehousing and ETL | 88-90
complete:
- You can classify a query as OLTP or OLAP and say why
- You can draw Figure 3-8 (ETL into a warehouse) roughly from memory
- You answered the quiz
---

:::problem Two very different kinds of question
"Show me order #18342" and "What was the total revenue of each store in January?" are both SQL queries on sales data. But the first touches one row via an index, while the second must read millions of rows and add them up. If you run the second kind on the database serving your website, every customer feels it.

These two patterns are so different that they've led to different databases, different schemas, and — as you'll see on Wednesday — different ways of laying bytes on disk.
:::

:::intuition OLTP vs OLAP
Originally a database write corresponded to a commercial transaction (a sale, an order, a salary payment). The word **transaction** stuck, now meaning a group of reads and writes forming a logical unit. (It doesn't require ACID properties — that's Chapter 7. Transaction processing just means low-latency reads and writes, as opposed to periodic batch jobs.)

Interactive applications look up a small number of records by key and insert/update records from user input: **online transaction processing (OLTP)**. Analytics scans huge numbers of records and computes aggregates (count, sum, average) for business analysts — **online analytic processing (OLAP)**. Typical analytic questions (p. 87): total revenue per store in January; how many more bananas than usual during a promotion; which baby food brand is most often bought with brand X diapers.

**Table 3-1** (p. 88):

| Property | OLTP | OLAP |
|---|---|---|
| Main read pattern | Small number of records per query, fetched by key | Aggregate over a large number of records |
| Main write pattern | Random-access, low-latency writes from user input | Bulk import (ETL) or event stream |
| Primarily used by | End user/customer, via web application | Internal analyst, for decision support |
| What data represents | Latest state of data (current point in time) | History of events that happened over time |
| Dataset size | Gigabytes to terabytes | Terabytes to petabytes |
:::

:::details Data warehousing
At first the same databases served both, and SQL handles both styles well. But from the late 1980s, companies moved analytics into a separate **data warehouse** (p. 88).

Why? An enterprise may have dozens of OLTP systems — website, point of sale, inventory, vehicle routing, suppliers, HR — each maintained by its own team and largely autonomous. They must be **highly available and low-latency**, so administrators guard them and are reluctant to let analysts run expensive ad-hoc queries that scan large parts of the data and hurt concurrent transactions.

A **data warehouse** is a separate database analysts can query freely. It holds a **read-only copy** of data from all the OLTP systems. Data is **extracted** (periodic dumps or a continuous stream of updates), **transformed** into an analysis-friendly schema and cleaned, then **loaded**: **Extract–Transform–Load (ETL)** (Figure 3-8).

<div class="figure">
<svg class="dg" viewBox="0 0 640 210" role="img" aria-label="ETL from three OLTP databases into a data warehouse">
  <rect class="boxa" x="20" y="20" width="150" height="44" rx="8"/><text x="95" y="40" text-anchor="middle">E-commerce site</text><text x="95" y="56" text-anchor="middle" class="sub">Sales DB</text>
  <rect class="boxa" x="245" y="20" width="150" height="44" rx="8"/><text x="320" y="40" text-anchor="middle">Stock-keeping app</text><text x="320" y="56" text-anchor="middle" class="sub">Inventory DB</text>
  <rect class="boxa" x="470" y="20" width="150" height="44" rx="8"/><text x="545" y="40" text-anchor="middle">Route planner</text><text x="545" y="56" text-anchor="middle" class="sub">Geo DB</text>
  <path class="ln" d="M95 64 V110 H300 M320 64 V110 M545 64 V110 H340"/>
  <text x="320" y="100" text-anchor="middle" class="sub">extract → transform → load</text>
  <rect class="boxc" x="220" y="120" width="200" height="44" rx="8"/><text x="320" y="140" text-anchor="middle">Data warehouse</text><text x="320" y="156" text-anchor="middle" class="sub">read-only copy, analysis schema</text>
  <path class="lna" d="M420 142 H520"/><text x="575" y="146" text-anchor="middle">Business analyst</text>
  <text x="30" y="200" class="sub">OLTP: low latency, high availability, guarded</text>
  <text x="400" y="200" class="sub">OLAP: big scans, ad-hoc queries</text>
</svg>
</div>

Warehouses exist in almost all large enterprises but are rare in small companies, which have few OLTP systems and little enough data to query in a conventional SQL database or even a spreadsheet.

The big advantage of a separate warehouse: it can be **optimised for analytic access patterns**. The indexes from the first half of the chapter work well for OLTP but are not very good at analytics.

### The divergence (pp. 89–90)
Warehouses are mostly relational, because SQL fits analytics and many graphical tools generate SQL (drill-down, slicing and dicing). On the surface a warehouse and an OLTP database look the same — both speak SQL — but internally they're optimised for very different query patterns, and many vendors now focus on one or the other. Products supporting both (SQL Server, SAP HANA) increasingly have two separate storage and query engines behind one SQL interface. Commercial warehouses (2016): Teradata, Vertica, SAP HANA, ParAccel (Amazon Redshift is hosted ParAccel). Open-source SQL-on-Hadoop: Hive, Spark SQL's predecessor Shark, Impala, Presto, Tajo, Drill — several inspired by Google's **Dremel**.
:::

:::extra Since 2016
Cloud data warehouses — Snowflake, Google BigQuery (built on Dremel), Amazon Redshift, Databricks SQL — have become the default for many companies, often reading open columnar formats (Parquet, ORC) on object storage, sometimes called a "lakehouse". The trend reversed one 2016 observation: warehouses are no longer only for large enterprises, because a startup can now rent one by the query. **ELT** (load raw data first, transform inside the warehouse, e.g. with dbt) has become common alongside classic ETL. The OLTP/OLAP distinction itself is unchanged.
:::

:::quiz
### mcq
Which of these is an **OLAP** query?
- [ ] Fetch the shopping cart of user 9182
- [ ] Insert a new order with 3 items
- [x] Average basket size per store per week over the last two years
- [ ] Update the shipping address of order 55
>>>
It aggregates a large number of records over history for decision support. The others touch a few records by key, driven by user input — OLTP.

### mcq
Why do companies usually not run analytics directly on their OLTP databases?
- [ ] SQL can't express analytic queries
- [x] Analytic queries scan large parts of the data and can hurt the performance of latency-critical transactions; also data is spread across many systems and needs transforming
- [ ] OLTP databases can't store history
- [ ] Analysts aren't allowed to use SQL
>>>
Both reasons from pp. 88–89: protect the OLTP systems, and integrate data from many autonomous systems into an analysis-friendly schema.

### mcq
In ETL, what does the "T" step typically involve?
- [ ] Transmitting data over the network
- [x] Transforming data into an analysis-friendly schema and cleaning it up
- [ ] Testing the warehouse
- [ ] Truncating old data
>>>
Extract from OLTP systems → transform into an analysis-friendly schema and clean → load into the warehouse (p. 89).

### predict
A data warehouse and an OLTP database both use SQL. What does the book predict about their internals?
- [ ] They will be identical, since they share a query language
- [x] They can look very different, because they're optimised for very different query patterns — even products that offer both increasingly use two separate engines
- [ ] The warehouse will always use B-trees
- [ ] The OLTP database will be column-oriented
>>>
Same interface, different engines (p. 90). That's the abstraction from Chapter 1 at work: SQL hides the storage layout.

### explain
Using Table 3-1, explain why the *data* in a warehouse is better described as "history of events" while OLTP holds "latest state".
>>>
An OLTP database keeps the current state that the application needs right now — the current balance, the current address, the current stock level; updates overwrite the previous state. A warehouse collects facts about events as they happened over time — every sale, every click — and keeps them, because analysts ask questions about trends and history (sales last January vs this January). That's why fact tables grow huge (terabytes to petabytes).
:::

:::connect Where this goes next
"History of events" vs "latest state" is a distinction that returns in a big way in Chapter 11: **event sourcing** stores the history of events as the source of truth and derives current state from it — like a warehouse's fact table, but as the primary database. Tomorrow: the schemas warehouses use.
:::
