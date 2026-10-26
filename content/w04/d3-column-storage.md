---
title: Column-Oriented Storage and Compression
kind: lesson
minutes: 95
chapter: 3
objectives:
- Explain row-oriented vs column-oriented layout and why columns win for analytic scans
- Explain bitmap encoding and run-length encoding, and how bitmaps answer IN and AND queries
- Explain why CPU efficiency (cache, SIMD, vectorized processing) matters in analytics
- Explain how rows are reassembled from column files
reading:
- Column-oriented storage | 93-94
- Column compression | 94-96
- Memory bandwidth and pipelined execution | 96
complete:
- You can explain why a row store reads 100 columns to use 3
- You can compute a bitmap and its run-length encoding by hand for a short column
- You did Tasks 1–2 of the column-store exercise
- You answered the quiz
---

:::problem Reading 100 columns to use 3
A fact table has trillions of rows and petabytes of data, over 100 columns wide; Example 3-1 needs only 3 of them (p. 93). In most OLTP databases — and in document databases — storage is **row-oriented**: all values of a row are stored next to each other (think of the CSV log in Figure 3-1). Even with indexes on `date_key` and `product_sk` that find the right rows, a row store must load each matching row — all 100+ attributes — from disk into memory, parse it, and throw most of it away. For a query touching billions of rows, that's an enormous waste of disk bandwidth.
:::

:::intuition Store each column separately
The idea is simple: **don't store all values of a row together; store all values of each column together** — each column in its own file (Figure 3-10). A query reads and parses only the columns it uses.

This relies on every column file holding the rows **in the same order**: to reassemble row 23, take the 23rd entry from each column file.

Think of a school's records. A row store keeps one folder per student (name, address, grades, attendance, allergies…). To compute the average maths grade, you open every folder. A column store keeps one list per subject. To average maths, you read one list.

Column storage applies to non-relational data too: **Parquet** is a columnar format for a document data model, based on Google's Dremel.
:::

:::visual ColumnStoreViz | Rows vs columns, bitmaps, sort order
**Try this:**
1. **Tab 1:** with Example 3-1's columns ticked, compare "Values read from disk" in row vs column layout. Tick and untick columns.
2. **Tab 2:** this is Figure 3-11. Read the bitmap and RLE for `product_sk = 31`. Tick values to build `product_sk IN (…)` (a bitwise OR), then add `AND store_sk = 3` (a bitwise AND).
3. **Tab 3** is tomorrow's topic (sort order) — have a peek.
:::

:::details Compression and the CPU
### Column compression (pp. 94–96)
Besides reading fewer columns, we can **compress** them — and columns compress well because their values are often repetitive. One technique that's especially effective in warehouses is **bitmap encoding** (Figure 3-11).

The number of **distinct values** in a column is often small compared to the number of rows: billions of sales, but maybe 100,000 products; a `country` column has about 200 values. Turn a column with *n* distinct values into *n* **bitmaps** — one per value, one bit per row: 1 if that row has the value.

- If *n* is small, store the bitmaps directly, one bit per row.
- If *n* is larger, most bitmaps are mostly zeros (**sparse**), so additionally **run-length encode** them: store the lengths of alternating runs of zeros and ones. For `product_sk = 31` in Figure 3-11, the bitmap `000001111000111000` becomes `5, 4, 3, 3` (5 zeros, 4 ones, 3 zeros, 3 ones, rest zeros). This can make a column remarkably compact.

Bitmap indexes fit warehouse queries perfectly:

- `WHERE product_sk IN (30, 68, 69)` → load three bitmaps and compute their **bitwise OR** — very fast.
- `WHERE product_sk = 31 AND store_sk = 3` → load one bitmap from each column and compute the **bitwise AND**. This works because all columns store rows in the same order, so bit *k* in one bitmap is the same row as bit *k* in the other.

(There are many other compression schemes for different data; the book points to a survey.)

### Memory bandwidth and vectorized processing (p. 96)
Disk-to-memory bandwidth is a big bottleneck for scanning millions of rows, but not the only one. Analytic engines also care about memory-to-CPU-cache bandwidth, avoiding branch mispredictions and pipeline bubbles, and using **SIMD** instructions. Column layouts help here too: the engine can take a chunk of compressed column data that fits in the CPU's **L1 cache** and run through it in a tight loop, far faster than code that makes function calls and checks conditions per record. Compression fits more rows in the same cache. Operators like bitwise AND/OR can work **directly on chunks of compressed data**. This is **vectorized processing**.
:::

:::practice 11-column-store | Measure it
Write the same 400,000 × 20 table both ways, run the same query, and compare bytes read; then build bitmaps with RLE. Tasks 1–2 today; Task 3 (sort order) fits tomorrow's lesson.
:::

:::quiz
### mcq
How does a column store reassemble a full row?
- [ ] It stores a pointer from each value to its row
- [x] Every column file stores rows in the same order, so the k-th entry of each column belongs to row k
- [ ] It keeps a separate row-oriented copy of every table
- [ ] It can't; column stores only return aggregates
>>>
Position is the link between columns (p. 94). That's also why columns can't be sorted independently (tomorrow).

### predict
A column has values `7 7 3 7 3 3` (rows 1–6). What is the bitmap for value 3, and its run-length encoding in the book's format?
- [ ] `110100` → 2, 1, 1, 2
- [x] `001011` → 2, 1, 1, 2
- [ ] `001011` → 3, 3
- [ ] `110100` → 1, 1, 1, 3
>>>
Value 3 appears in rows 3, 5 and 6 → `0 0 1 0 1 1`. Runs, starting with zeros: 2 zeros, 1 one, 1 zero, 2 ones → `2, 1, 1, 2`.

### mcq
How is `WHERE product_sk = 31 AND store_sk = 3` answered with bitmap indexes?
- [ ] Scan all rows and check both columns
- [x] Bitwise AND of the bitmap for product_sk = 31 and the bitmap for store_sk = 3
- [ ] Bitwise OR of the two bitmaps
- [ ] Join two separate tables
>>>
AND of the two bitmaps gives a 1 exactly for rows matching both. It works because both columns store rows in the same order (p. 96).

### mcq
When does bitmap encoding with RLE work best?
- [ ] When almost every row has a distinct value (e.g. a unique transaction ID)
- [x] When the column has few distinct values relative to the number of rows, so bitmaps are small or sparse and compress well
- [ ] Only for text columns
- [ ] Only when the table has fewer than 1,000 rows
>>>
A unique ID column would need one bitmap per row — useless. Columns like country, product, store or status are ideal.

### explain
Explain "vectorized processing" in your own words and why column layouts make it possible.
>>>
Instead of processing one record at a time through general-purpose code (function calls, branches per row), the engine processes a whole chunk of values from one column at once in a tight loop — ideally a chunk that fits in the CPU's L1 cache — and can use SIMD instructions that apply one operation to many values. Column layouts make this natural because a column's values are stored contiguously and are all the same type; compression packs more values into the cache; and operators like bitwise AND/OR can work directly on compressed chunks (p. 96).

### tradeoff
Why don't OLTP databases (for your web app's orders table) simply switch to column-oriented storage?
- [ ] Column stores can't store numbers
- [x] OLTP queries usually fetch or update whole rows by key; in a column store each row is spread over many files, and in-place updates of compressed columns are hard — the layout is optimised for big read-only scans
- [ ] Column stores don't support SQL
- [ ] They already all do
>>>
OLTP reads a few complete rows; row layout puts each row in one place (good locality, cf. Chapter 2). Column layout wins only when you read few columns across many rows. Writes to column stores are tomorrow's topic.
:::

:::connect Where this goes next
Notice the mirror image of Chapter 2's **locality** argument: a document puts everything about *one entity* together because OLTP reads whole entities; a column store puts *one attribute of all entities* together because analytics reads one attribute across everything. Same principle — store together what is read together — opposite access patterns. Tomorrow: sort order, writes, and precomputed aggregates.
:::
