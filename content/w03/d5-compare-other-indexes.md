---
title: B-Trees vs LSM-Trees, Secondary Indexes, and In-Memory Databases
kind: lesson
minutes: 100
chapter: 3
objectives:
- Compare B-trees and LSM-trees on write throughput, read performance, tail latency and transactional fit
- Explain secondary indexes, heap files, clustered and covering indexes
- Explain concatenated and multi-dimensional indexes, and fuzzy indexes
- Explain why in-memory databases are fast (it's not "no disk reads")
reading:
- Comparing B-trees to LSM-trees | 81-82
- Other indexing structures (secondary, clustered, covering, multi-column, fuzzy) | 82-85
- Keeping everything in memory | 85-87
complete:
- You can give the "rule of thumb" for LSM vs B-tree, and say why benchmarks are needed anyway
- You ran the SQLite index experiments and can read a query plan
- You answered the quiz
---

:::problem Which engine, which index?
Now you know two storage engine families. Real systems pick one — MySQL's InnoDB and PostgreSQL use B-trees; Cassandra, HBase and RocksDB use LSM-trees — and then add more indexes on top: by email, by last name and first name, by location on a map, by approximately-matching words. How do you reason about these choices instead of guessing?
:::

:::intuition The rule of thumb, and why it's only a rule of thumb
B-tree implementations are generally **more mature**; LSM-trees are promising because of their performance (p. 81). As a rule of thumb, **LSM-trees are typically faster for writes, B-trees are thought to be faster for reads** — but real benchmarks are often inconclusive and sensitive to the workload.

| | LSM-tree | B-tree |
|---|---|---|
| Random writes | Turned into sequential writes → very high throughput | Overwrites pages in place + WAL |
| Reads | May check memtable + several SSTables (Bloom filters help) | One path from root to leaf |
| Tail latency | Compaction competes for disk bandwidth → occasional high p99 | More predictable |
| Each key lives… | possibly in several segments | in exactly one place |
| Transactions | harder to attach range locks | locks on key ranges attach directly to the tree |
| Disk layout | Merging keeps sequential keys together | Leaves can scatter over time |

Two points deserve emphasis. First, **compaction can hurt tail latency** (p. 82): the disk has limited bandwidth, and a request may wait behind an expensive compaction — small effect on averages, big at high percentiles (remember Week 1). Second, because a key exists in **one place** in a B-tree, many relational databases implement transaction isolation with locks on key ranges attached to the tree (Chapter 7). The book's verdict: B-trees are too ingrained to go away; log-structured indexes are increasingly popular in new datastores; **test empirically**.
:::

:::details Other indexing structures
### Secondary indexes (pp. 82–83)
A **primary key** uniquely identifies a row/document/vertex. **Secondary indexes** (`CREATE INDEX`) index other columns and are crucial for efficient joins — e.g. an index on `user_id` in Figure 2-1's tables. Their keys are **not unique**: either store a list of matching row IDs per key (like a postings list) or make keys unique by appending the row ID. Both B-trees and LSM-trees can be secondary indexes.

### Where does the row live?
- **Heap file**: rows stored in no particular order; each index stores a *reference* to a heap location. Avoids duplicating data across many indexes. Updating a value in place is easy if it doesn't grow; if it grows and must move, either update all indexes or leave a forwarding pointer.
- **Clustered index**: store the row *inside* the index, saving the extra hop. In MySQL InnoDB, the primary key is always clustered and secondary indexes refer to the primary key. SQL Server allows one clustered index per table.
- **Covering index** (index with included columns): stores *some* columns in the index, so certain queries are answered from the index alone — the index *covers* the query.

Like any duplication, clustered and covering indexes speed up reads but cost storage and write overhead, and the database must keep them transactionally consistent.

### Multi-column indexes (pp. 84–85)
- **Concatenated index**: several fields combined into one key, in a defined order — like a phone book sorted by (last name, first name). Useful for last name, or last+first; **useless for first name alone**.
- **Multi-dimensional indexes**: needed for queries like "restaurants within this map rectangle":
  ```sql
  SELECT * FROM restaurants WHERE latitude > 51.4946 AND latitude < 51.5079
                              AND longitude > -0.1162 AND longitude < -0.1004;
  ```
  A B-tree on latitude gives you a stripe of the globe, not a box. Options: map 2-D points to one number with a **space-filling curve** and use a B-tree, or (more commonly) a specialised **R-tree** (PostGIS on PostgreSQL's GiST). Not only for maps: (red, green, blue) for colour search, or (date, temperature) for weather data (HyperDex).

### Fuzzy indexes (p. 85)
For searching *similar* keys (misspellings), e.g. Lucene finds words within an **edit distance** (1 = one letter added, removed or replaced). Its in-memory index over the SSTable-like term dictionary is a **finite-state automaton** (similar to a trie), which can be transformed into a **Levenshtein automaton** for efficient edit-distance search.

### Keeping everything in memory (pp. 85–87)
Everything so far works around disks' awkwardness, tolerated because disks are **durable** and **cheaper per GB**. As RAM gets cheaper, many datasets fit in memory (perhaps across machines) → **in-memory databases**. Memcached is cache-only (data loss on restart is OK). Others aim for durability via battery-backed RAM, a **log of changes** on disk, periodic **snapshots**, or **replication**; reads are still served entirely from memory. Examples: VoltDB, MemSQL, Oracle TimesTen (relational), RAMCloud (log-structured, durable), Redis and Couchbase (weak durability, async disk writes).

**Counter-intuitively, they're not fast because they avoid disk reads** — a disk-based engine with enough RAM rarely reads disk either, thanks to the OS page cache. They're fast because they **avoid the overhead of encoding in-memory data structures into a disk format** (p. 86). They also enable data models that are hard on disk — Redis's priority queues and sets. Research on **anti-caching** evicts least-recently-used records to disk when memory runs out, at record granularity (still needs indexes in memory).
:::

:::practice 09-sqlite-indexes | Read real query plans
SQLite stores tables and indexes as B-trees. Fill in four `CREATE INDEX` statements and watch scans turn into searches, a covering index skip the table, and inserts slow down as indexes are added.
:::

:::quiz
### tradeoff
A metrics service ingests 500,000 small writes per second and serves occasional dashboard reads. Which storage engine family is the more natural starting point?
- [x] An LSM-tree, because it turns random writes into sequential writes and sustains very high write throughput
- [ ] A B-tree, because it has a write-ahead log
- [ ] A hash index, because metrics need range queries
- [ ] An in-memory database without any durability
>>>
High write throughput is the LSM-tree's strength (p. 82). Dashboards often need time-range scans, which sorted SSTables support. Still, the book's advice stands: benchmark with your actual workload.

### mcq
Why might an LSM-based database show worse **p99** read latency than a B-tree, even if its average is similar?
- [ ] LSM-trees don't support indexes
- [x] Background compaction competes for limited disk bandwidth, so some requests occasionally wait behind an expensive compaction
- [ ] B-trees cache everything in memory
- [ ] LSM-trees sort data on every read
>>>
The impact on throughput and average response time is small, but at high percentiles it shows; B-trees can be more predictable (p. 82).

### predict
A table has a concatenated index on `(last_name, first_name)`. Which query can use it efficiently?
- [ ] `WHERE first_name = 'Ada'`
- [x] `WHERE last_name = 'Lovelace'`
- [ ] `WHERE first_name LIKE 'A%'`
- [ ] None of them, concatenated indexes only work for both columns
>>>
Like a phone book sorted by last name then first name: great for last name, or last+first; useless for first name alone (p. 84). You saw this in the SQLite plans.

### mcq
What is a **covering index**?
- [ ] An index on every column
- [ ] An index stored in a heap file
- [x] An index that stores some of the table's columns, so certain queries can be answered from the index alone
- [ ] A clustered index on the primary key
>>>
It's a compromise between a clustered index (all row data in the index) and a non-clustered one (only references). In SQLite's plan you saw "USING COVERING INDEX".

### mcq
According to the book, why are in-memory databases faster?
- [ ] Because they never read from disk, unlike disk-based databases
- [x] Because they avoid the overhead of encoding in-memory data structures in a form that can be written to disk
- [ ] Because RAM has no latency
- [ ] Because they don't support durability
>>>
A disk-based engine with enough memory also rarely reads disk (OS page cache). The real win is not having to maintain disk-oriented data structures (p. 86).

### design
A restaurant app must show all restaurants within the map area a user is viewing, and supports search by restaurant name with typos. Which index types would you use, and why won't a single B-tree on latitude do?
>>>
For the map: a **multi-dimensional (spatial) index** such as an R-tree (e.g. PostGIS), or a space-filling-curve key in a B-tree. A B-tree on latitude only returns a band of all longitudes around the globe (and vice versa); it can't narrow both dimensions at once (p. 84). For typo-tolerant name search: a **fuzzy index**, e.g. a full-text engine like Lucene/Elasticsearch searching within an edit distance via Levenshtein automata (p. 85). Plus an ordinary B-tree on the restaurant ID for lookups.
:::

:::connect Where this goes next
So far all these engines serve **OLTP**: look up a few records by key. Next week flips the access pattern: **analytics**, where queries scan millions of rows but only a few columns — and where indexes matter much less than storing data compactly by column.
:::
