---
title: The log-analysis pipeline, and sorting more data than fits in memory
chapter: 10
topic: Unix pipelines, in-memory aggregation vs sorting, external merge sort
minutes: 45
---

## Objective

Answer the question from p. 379, "what are the 5 most popular pages?", in two ways and compare
them. One is in-memory aggregation with a hash table, like the Ruby script on p. 380. The other is
`sort | uniq -c | sort -r -n | head`, built around an **external merge sort** that never holds more
than a fixed number of lines in memory. It's the same "sort chunks, write sorted runs, merge
sequentially" idea as SSTables (Chapter 3) and GNU `sort` spilling to disk (p. 382). Then run the
real Unix pipeline on the same log.

## Setup

Python 3.10+, standard library only. Open `practice/36-external-sort/logsort.py`. It generates a
400,000-line synthetic nginx log with Zipf-like page popularity. A full run takes about 30 seconds.
Optional: any POSIX shell (Git Bash on Windows, or Terminal on macOS/Linux) for `pipeline.sh`.

## Predict first

1. With 100 distinct URLs, which approach needs more memory? With 200,000 distinct URLs?
2. Does the external sort's memory depend on the number of distinct URLs at all?
3. Which is faster here, and why might that change if the input were 50 GB?

## Your task

1. **TODO 1** `external_sort`: chunk, sort, write run files, `heapq.merge`.
2. **TODO 2** `uniq_c`: count runs of adjacent equal items, using constant memory.
3. **TODO 3** `top_k`: the k largest, in O(k) memory.

## Run it

```
python practice/36-external-sort/logsort.py
KEEP_LOG=1 python practice/36-external-sort/logsort.py && sh practice/36-external-sort/pipeline.sh access.log
```

(In Windows PowerShell, set the variable first: `$env:KEEP_LOG=1; python practice/36-external-sort/logsort.py`,
then run `sh practice/36-external-sort/pipeline.sh access.log` from Git Bash.)

## Observe

- The hash table's peak memory grows roughly a hundredfold when distinct URLs go from 100 to
  hundreds of thousands. The working set depends only on the number of *distinct* keys (p. 381).
  A million requests for one URL still take one entry.
- The external sort's peak stays flat. It's bounded by the chunk size, whatever the input.
- In this run the hash table is faster, because everything fits. Sorting pays for writing and reading
  the runs. Once the working set exceeds memory, the hash table starts swapping or crashes, while
  the sort keeps working with **sequential** disk I/O (p. 382).
- `pipeline.sh` produces the same top 5 as your Python code. GNU `sort` does the external merge
  sort for you, and also parallelizes across CPU cores.

## Questions

1. Why is `uniq -c` only correct on *sorted* input?
2. The book says the bottleneck of the Unix pipeline is likely "the rate at which the input file can be
   read from disk" (p. 382). Why not the sorting?
3. How does this exercise relate to MapReduce's "sort is the most important aspect" (p. 387)?
4. When would you pick the hash table anyway?

<details><summary>Discussion</summary>

1. `uniq` only compares *adjacent* lines. Sorting is what makes equal items adjacent, so their
   occurrences can be combined without keeping per-key state in memory (pp. 380, 387).
2. External sorting does a constant number of sequential passes over the data. Sequential disk
   throughput is high, and `sort` uses multiple cores, so reading the input once dominates (p. 382).
3. MapReduce's shuffle is exactly an external sort, partitioned and distributed. Mappers write
   sorted runs per reducer, and reducers merge them, so all values for a key arrive together without
   an in-memory table of all keys (pp. 389–390).
4. When the number of distinct keys comfortably fits in memory. It's simpler, single-pass and
   faster. That's why broadcast hash joins and in-memory aggregation are popular whenever the
   small side fits (p. 396).
</details>
