---
title: Percentiles, queueing and tail latency
chapter: 1
topic: Response time distributions, head-of-line blocking, percentile aggregation
minutes: 50
---

## Objective

Turn three claims from the book (pp. 11–15) into numbers you produced yourself:

1. A load tester that waits for each response before sending the next request hides queueing delays (p. 14).
2. Averaging percentiles from several machines is "mathematically meaningless"; you must add histograms (p. 14).
3. When a page needs many backend calls, a small fraction of slow calls makes a large fraction of pages slow (p. 14, Figure 1-5).

## Setup

Python 3.10+. Open `practice/03-percentiles/latency.py`. The simulated server has **one worker**
processing requests in arrival order. Most requests take ~10 ms; 1% take 300 ms (a "GC pause").
`open_loop()` simulates real users who arrive whenever they like; `closed_loop()` simulates a
naive benchmark that sends one request at a time.

## Predict first

1. The closed-loop test and the open-loop test at 50% utilisation use the *same* service times. Will their p99s be roughly equal, 2× apart, or 30× apart?
2. Server A has p99 = 1700 ms, server B has p99 = 500 ms, both handle equal traffic. Is the combined p99 about 1100 ms, below that, or above?
3. A page calls 100 backends in parallel. What share of page loads are slower than one backend's p99?

## Your task

1. **Task 1:** implement `percentile(values, p)` with the nearest-rank method. Run the file and compare the closed-loop line with the open-loop lines.
2. **Task 2:** implement `histogram`, `merge`, and `percentile_from_histogram`. Compare the three numbers printed.
3. **Task 3:** implement `fraction_of_slow_pages` by simulation (not by formula), then check it against 1 − 0.99ⁿ.

## Run it

```
python practice/03-percentiles/latency.py
```

## Observe

- In the closed loop, a 300 ms stall only delays *one* request. In the open loop, every request that arrives during the stall waits behind it — **head-of-line blocking** — so the tail is dramatically worse, and it worsens sharply as utilisation approaches 100%.
- The median stays low long after the p99 has exploded: the median hides what your unluckiest users see.
- Averaging p99s underestimates the true combined p99; merging histograms gets it right (to bucket precision).
- With 100 backend calls, roughly 63% of pages are slower than a single backend's p99.

## Questions

1. Why does a closed-loop load generator give misleadingly good results? What should a load generator do instead?
2. Why does the response-time tail grow so steeply between 80% and 90% utilisation?
3. Why is averaging two p99 values wrong, but adding two histograms right?
4. If you must call 50 backends per page, what are two ways to keep page latency under control?

<details><summary>Discussion</summary>

1. It never lets a queue form: while the server is stalled, the generator is stalled too, so no requests pile up. Real users keep arriving. A load generator should send requests on a schedule *independent* of response times (open loop), as the book says on p. 14.
2. Queueing delay depends on how often the server is busy when a request arrives. Near full utilisation, any stall creates a backlog that takes a long time to drain, because new work keeps arriving almost as fast as it can be processed.
3. A percentile is a property of the whole distribution; the p99 of the union depends on *where the other server's values fall*, which the two p99 numbers alone don't tell you. Histograms keep the counts, and counts add.
4. Examples: reduce the number of calls on the critical path (batching, caching, precomputing); make backends' tails shorter (fewer GC pauses, lower utilisation); send a hedged/backup request if the first is slow; return partial results if a non-essential backend is late.
</details>
