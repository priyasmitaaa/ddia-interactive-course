---
title: B-Trees — Pages, Splits and the Write-Ahead Log
kind: lesson
minutes: 90
chapter: 3
objectives:
- Explain how a B-tree organises fixed-size pages into a balanced tree, and how a lookup proceeds
- Explain inserts, page splits, and why the tree stays balanced with O(log n) depth
- Explain why update-in-place needs a write-ahead log and latches
- Describe common B-tree optimisations (copy-on-write, key abbreviation, sequential leaves, sibling pointers)
reading:
- B-trees | 77-80
- Update-in-place vs. append-only logging | 80-81
- B-tree optimizations | 81
complete:
- You can explain a page split with a drawing
- You watched a root split in the simulator and can say why the tree's height grows so slowly
- You answered the quiz
---

:::problem The most widely used index of all
Log-structured indexes are gaining acceptance, but they are not the most common. That title belongs to the **B-tree**, introduced in 1970 and called "ubiquitous" less than ten years later (p. 78). It's the standard index in almost every relational database — PostgreSQL, MySQL, Oracle, SQL Server, SQLite — and in many non-relational ones.

Like SSTables, B-trees keep keys sorted, so lookups and range queries are efficient. But the design philosophy is the opposite: instead of appending and merging later, a B-tree keeps a single sorted structure on disk and **updates it in place**.
:::

:::intuition A tree of pages
Log-structured engines use variable-size segments of several MB, always written sequentially. B-trees break the database into **fixed-size pages** (traditionally **4 KB**) and read or write one page at a time — matching how disks are organised into fixed-size blocks.

Each page has an address, so one page can refer to another — like pointers, but on disk. One page is the **root**. A page holds *k* keys and *k + 1* references to child pages; each child is responsible for a **continuous range of keys**, and the keys in the parent mark the boundaries (Figure 3-6). To look up key 251: in the root, follow the reference between boundaries 200 and 300; that page splits 200–300 into sub-ranges; follow 250–270; eventually you reach a **leaf page** holding the keys themselves, with the values inline or references to where they are.

The number of child references per page is the **branching factor** — in real systems, several hundred. That's why B-trees are shallow: with a branching factor around 500, each extra level multiplies capacity by 500. Most databases fit in a B-tree three or four levels deep.

Analogy: a library's directory signs. Floor signs → aisle signs → shelf labels → the book. A handful of signs to find any book among millions.
:::

:::visual BTreeSim | Insert, split, look up
Pages here hold only 3 keys (real ones hold hundreds), so you can watch splits happen.

**Try this:**
1. Insert 10, 20, 30, then 40: the leaf overflows and **splits** into two half-full pages; a new root appears with the boundary key.
2. Press **+10 random keys** a few times. Watch which pages are **read** (blue) on the way down and **written** (orange) by each insert. Most inserts write one page; splits write three or more.
3. Look up a key: the path from root to leaf is exactly *height* pages.
4. Insert **+10 ascending keys** repeatedly: every insert lands in the rightmost leaf. Notice the half-full pages left behind.
5. Change "Keys per page" to 6 and repeat: same number of keys, fewer levels.
:::

:::details Updates, splits and crash safety
**Update an existing key**: find its leaf page, change the value, write the page back. References to that page stay valid. **Insert**: find the page whose range covers the key and add it. If the page is full, **split** it into two half-full pages and update the parent to reflect the new boundary (Figure 3-7). If the parent overflows, it splits too, and so on up; a root split adds a new root. This keeps the tree **balanced**: a B-tree with *n* keys always has depth O(log *n*). (Deletion while keeping balance is more involved.) If you know red-black or 2-3 trees, a B-tree is similar but with a much larger branching factor.

### Update-in-place vs append-only (pp. 80–81)
A B-tree's basic write **overwrites a page on disk**, assuming its location doesn't change. On a spinning disk that means moving the head, waiting for the platter to rotate to the right position, and overwriting a sector; on SSDs it's more complex but similarly slow.

Some operations overwrite **several pages** — a split writes two pages *and* their parent. If the database crashes after writing only some of them, the index is **corrupted** (e.g. an orphan page with no parent). So B-trees keep a **write-ahead log (WAL, a.k.a. redo log)**: an append-only file where every modification is written *before* it is applied to the tree's pages. After a crash, the WAL restores the tree to a consistent state.

So a B-tree writes every piece of data **at least twice** — once to the WAL, once to the page (plus more on splits). Log-structured engines also rewrite data several times through repeated merging. One write to the database causing several writes to disk is called **write amplification** (it matters especially on SSDs, which wear out after a limited number of overwrites). Which is worse depends on workload and tuning — the book's verdict: *benchmark with your workload*.

**Concurrency**: with in-place updates, threads could see the tree mid-change, so its structures are protected with **latches** (lightweight locks). Log-structured engines are simpler here: they merge in the background and atomically swap segments.

### B-tree optimisations (p. 81)
- **Copy-on-write** instead of WAL (e.g. LMDB): write a modified page to a *new* location and create new versions of parent pages pointing to it. This also helps concurrency (it reappears in Chapter 7's snapshot isolation).
- **Abbreviated keys** in interior pages: they only need to act as range boundaries, so store less; more keys per page → higher branching factor → fewer levels. (This variant is sometimes called a **B+ tree**.)
- **Sequential leaf layout**: pages can live anywhere on disk, so a range scan may need a seek per page; implementations try to keep leaves in sequential order, which is hard to maintain as the tree grows. (LSM-trees rewrite big segments during merging, so they keep sequential keys together more easily.)
- **Sibling pointers** between leaf pages, so range scans don't jump back to parents.
- **Fractal trees** borrow log-structured ideas to reduce disk seeks (nothing to do with fractals).
:::

:::quiz
### mcq
In a B-tree, what does each child reference in an interior page correspond to?
- [ ] One specific key
- [x] A continuous range of keys, with the boundaries given by the keys in the parent page
- [ ] A segment file written at a certain time
- [ ] A hash bucket
>>>
A page with k keys has k+1 children; each child covers the range between two adjacent boundary keys (Figure 3-6).

### predict
A leaf page that can hold 4 keys contains [10, 20, 30, 40]. You insert 25. What happens?
- [ ] 25 is appended to a log and the page is unchanged
- [ ] The page is rejected and 25 goes to the root
- [x] The page splits into two half-full pages (e.g. [10, 20] and [25, 30, 40]), and the parent gains a new boundary key and child reference
- [ ] The tree is rebuilt from scratch
>>>
Overflowing pages split, and the parent is updated with the new boundary. If the parent overflows, it splits too; a root split adds a level. This is how the tree stays balanced.

### mcq
Why does a B-tree need a write-ahead log?
- [ ] To make reads faster
- [ ] To keep keys sorted
- [x] Because some operations overwrite several pages, and a crash part-way through could leave the tree corrupted; the WAL lets it be restored to a consistent state
- [ ] Because B-trees cannot store values
>>>
A page split writes two pages and the parent. Crash after one of them → orphan pages or wrong references. Writing every change to the append-only WAL first makes recovery possible (p. 80).

### mcq
Roughly how deep is a B-tree for a big database, and why?
- [ ] Thousands of levels, because each page holds one key
- [x] Usually 3–4 levels, because each page has a branching factor of several hundred, so capacity grows by that factor per level
- [ ] Always exactly 1 level
- [ ] It depends only on the number of tables
>>>
Depth is O(log n) with a large base. With ~500 children per page, four levels address hundreds of terabytes of 4 KB pages. Each lookup reads just a few pages, and the top levels are usually cached in memory.

### tradeoff
What is **write amplification**, and which engine family suffers from it?
- [ ] Only LSM-trees, because they append
- [ ] Only B-trees, because of the WAL
- [x] One database write causing multiple disk writes; both families have it (B-trees: WAL + page + splits; LSM-trees: repeated merging), and which is worse depends on workload and tuning
- [ ] Neither; it's a property of SSD firmware only
>>>
The book says it's not clear which is better in this respect — benchmark your workload (p. 80). Write amplification matters on SSDs because blocks wear out after a limited number of overwrites.

### explain
Contrast the two families' "design philosophies" in two or three sentences each.
>>>
**Log-structured (LSM, Bitcask):** never modify a file once written. Absorb writes in memory/append to a log, write immutable sorted segments sequentially, and merge them in the background later; reads may consult several segments. **Update-in-place (B-tree):** keep one sorted structure of fixed-size pages on disk; find the right page and overwrite it now, splitting pages as needed and protecting multi-page changes with a WAL and concurrency with latches. Each key exists in exactly one place.
:::

:::connect Where this goes next
Tomorrow you compare the two families head to head and meet secondary, clustered, covering, multi-column and fuzzy indexes — then measure them in SQLite (which uses B-trees). The fact that a B-tree key lives in exactly one place becomes important in Chapter 7, where locks on key ranges attach directly to the tree (index-range locking).
:::
