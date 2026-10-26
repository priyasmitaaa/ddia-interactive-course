---
title: Project 1, Day 4 — Measure Against SQLite and Write the Design Doc
kind: project
minutes: 90
objectives:
- Benchmark your store and SQLite on the same workload and report p50/p99/p99.9
- Interpret benchmark numbers using Chapters 1 and 3, without over-claiming
- Write a one-page design document explaining formats, durability, recovery and trade-offs
reading:
- Re-read Describing performance (percentiles) | 11-14
- Re-read Comparing B-trees to LSM-trees | 81-82
complete:
- bench.py output is pasted and interpreted in DESIGN.md
- All sections of DESIGN.md are filled in
- You answered the quiz
---

:::problem Numbers without understanding are noise
A benchmark result like "my store does 42,000 writes/s and SQLite does 20,000" is easy to produce and easy to misread. Is that a fair comparison? Same durability? Same data? Does the gap matter at the percentiles your users feel? The book's repeated advice — "there is no quick and easy rule… test empirically" (p. 82) — only works if you can interpret what you measured.
:::

:::intuition Questions to ask of any benchmark
1. **Same work?** Same keys, values, read/write mix and order. `bench.py` uses identical seeded workloads.
2. **Same durability?** Your store without fsync vs SQLite with `synchronous=OFF` is roughly comparable (neither waits for the disk). Comparing your un-synced store with a fully synced database would be meaningless.
3. **Which statistic?** Throughput, p50, p99 and p99.9 tell different stories (Chapter 1). A system can win on median and lose on tail.
4. **Open or closed loop?** `bench.py` is a closed-loop benchmark (one request after another) — remember Week 1: it hides queueing. Its percentiles are service times, not what users under load would see.
5. **What's not measured?** Range queries, larger-than-memory datasets, many concurrent clients, crash recovery time, disk usage.

A good write-up states the result, the conditions, and the limits.
:::

:::details What you'll probably see, and why
Typical results on a laptop (your numbers will differ):

| | throughput | p50 | p99 |
|---|---|---|---|
| KVStore put (no fsync) | ~40k/s | ~10 µs | ~35 µs |
| SQLite upsert (synchronous=OFF) | ~20k/s | ~35 µs | ~140 µs |
| KVStore get | ~160k/s | ~5 µs | ~20 µs |
| SQLite get | ~120k/s | ~7 µs | ~18 µs |
| KVStore get during compaction | lower | ~8 µs | ~3× higher |
| durable writes, batch of 100 | ~40k/s | | |
| durable writes, fsync each | ~1k/s | ~1 ms | ~2 ms |

Interpretation, in book terms:
- **Writes:** your store only appends (log-structured: random writes become sequential), while SQLite updates B-tree pages and its WAL. The rule of thumb "LSM faster for writes" shows up even at this tiny scale.
- **Reads:** both are a hash/B-tree lookup plus a read from the OS page cache — similar. Your store has *no* range queries; SQLite does.
- **Compaction:** median barely moves, p99 rises — Chapter 3, p. 82.
- **Durability:** fsync dominates everything; batching changes the picture by 40×.
- **Caveat:** all data fits in memory/page cache; a larger-than-RAM dataset would change the read story substantially.
:::

:::practice 17-project1-kv | Benchmark and design document
Run `bench.py`, paste its output into `DESIGN.md` section 6, and complete every section. Keep it to one page — explaining clearly in little space is a skill you'll use for the capstone and at work. Compare your numbers with `--solution` if you're curious.
:::

:::quiz
### mcq
Your store, without fsync, beats SQLite with full durability (`synchronous=FULL`) by 50× on writes. What's the right conclusion?
- [ ] Your store is 50× better than SQLite
- [x] Not much — the comparison is unfair because the two give different durability guarantees; compare like with like
- [ ] SQLite is broken
- [ ] B-trees are always slower
>>>
Durability is usually the biggest single factor in write cost. Benchmarks must hold guarantees constant.

### mcq
`bench.py` sends one request after another and measures each. Which Week 1 caveat applies to its percentiles?
- [ ] None — percentiles are always accurate
- [x] It's a closed-loop benchmark: it hides queueing delays, so these are closer to service times than to response times under real load
- [ ] It only measures the mean
- [ ] It measures network latency
>>>
Real clients arriving independently would queue behind slow operations (head-of-line blocking), making the tail worse (p. 14).

### tradeoff
Your benchmark shows similar point-read performance for your store and SQLite. A teammate proposes replacing SQLite with your store in the product. What should you check before agreeing?
- [ ] Nothing more
- [x] Whether the product needs range queries, transactions, secondary indexes, larger-than-memory data, concurrent access and operational tooling — none of which your store provides
- [ ] Only the p50
- [ ] Only disk usage
>>>
A benchmark covers one workload. Features and operational maturity matter (Chapter 1's maintainability; Chapter 3's "B-tree implementations are generally more mature").

### explain
In 3–4 sentences, explain your store's durability guarantee to a teammate: when is a `put` safe from a power cut, and what does `write_batch` add?
>>>
A sample answer: "With `sync=False`, `put` returns once the record is in the operating system's page cache — it survives a process crash but can be lost if the machine loses power before the OS writes it out. With `sync=True` each `put` is fsynced before returning, so it survives power loss, at roughly 1,000 writes/s. `write_batch` gives the same power-loss safety for a whole batch with a single fsync, so it's nearly as fast as unsynced writes. Batches are not atomic: after a crash during a batch, some prefix of it may survive."
:::

:::connect Where this goes next
You've now built and measured a real storage engine. Tomorrow's Part I exam checks the ideas behind it. Then Part II: what if this store has to survive losing the whole machine? (Copy the data — replication, Chapter 5.)
:::
