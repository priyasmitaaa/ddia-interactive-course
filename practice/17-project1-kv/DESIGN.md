# KV store v2 — design document

*(Fill this in as you build. One page is enough. Write for an engineer who has never seen your code.)*

## 1. Predictions (before coding)

1. Restart speed-up from hint files:
2. What v2 must do / never do with v1 data:
3. Ratio of fsync-per-write vs one fsync per 100 writes:
4. Effect of background compaction on p50 and p99:

## 2. On-disk format

Describe the v1 and v2 record formats, the segment header, and the hint file format.
How does a reader know which format a segment uses?

## 3. Write path and durability

What happens on `put`, `delete`, `write_batch`? When is a write durable?
Which crashes can lose acknowledged data?

## 4. Recovery

What happens at startup? What is scanned, what is loaded from hints?
How are torn writes handled?

## 5. Compaction

How does background compaction work? What holds the lock, and for how long?
What happens to a key that is written while compaction runs?

## 6. Measurements

Paste the output of `bench.py`, then interpret it:

```
(paste here)
```

- Throughput and latency vs SQLite:
- Durability cost:
- Compaction and tail latency:

## 7. Trade-offs and limits

What would you change for: 1 billion keys? range queries? multiple machines (preview of Part II)?

## 8. Answers to the README questions
