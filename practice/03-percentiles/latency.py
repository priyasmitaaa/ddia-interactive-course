"""
Exercise 03 — Describing performance: percentiles, queueing and tail latency.

Run:  python practice/03-percentiles/latency.py
"""
import random

# ---------------------------------------------------------------------------
# A simulated server: one worker, requests are processed in arrival order (FIFO).
# Most requests take ~10 ms; 1% hit a 300 ms stall (think: garbage-collection pause).
# ---------------------------------------------------------------------------
def service_time(rand):
    return 300.0 if rand.random() < 0.01 else rand.uniform(6, 14)


def open_loop(rate_per_ms, n, seed=1):
    """Requests arrive at random times REGARDLESS of how the server is doing (like real users).
    Returns response times (queueing delay + service time) in ms."""
    rand = random.Random(seed)
    t = 0.0
    server_free_at = 0.0
    out = []
    for _ in range(n):
        t += rand.expovariate(rate_per_ms)          # next arrival
        start = max(t, server_free_at)              # wait if the server is busy
        server_free_at = start + service_time(rand)
        out.append(server_free_at - t)
    return out


def closed_loop(n, seed=1):
    """A naive load tester: sends the next request only after the previous one returns.
    The queue can never build up, so queueing delay is always zero."""
    rand = random.Random(seed)
    return [service_time(rand) for _ in range(n)]


# ---------------------------------------------------------------------------
# TASK 1: percentiles.
# Return the p-th percentile of `values` using the nearest-rank method:
# sort the values; the p-th percentile is the value at rank ceil(p/100 * n) (1-based).
# ---------------------------------------------------------------------------
def percentile(values, p):
    raise NotImplementedError


def summary(name, values):
    mean = sum(values) / len(values)
    p = {q: percentile(values, q) for q in (50, 95, 99, 99.9)}
    print(f"{name:<34} mean={mean:7.1f}  p50={p[50]:7.1f}  p95={p[95]:7.1f}  p99={p[99]:7.1f}  p99.9={p[99.9]:7.1f}  (ms)")


# ---------------------------------------------------------------------------
# TASK 2: combine data from two servers correctly.
# Build a histogram for each server (bucket = response time rounded down to a whole ms),
# ADD the histograms, and compute the p99 from the combined histogram.
# Compare with the (wrong) average of the two servers' p99s.
# ---------------------------------------------------------------------------
def histogram(values):
    """Return dict: bucket(int ms) -> count."""
    raise NotImplementedError


def merge(h1, h2):
    raise NotImplementedError


def percentile_from_histogram(hist, p):
    """Walk buckets in increasing order until you've passed ceil(p/100 * total) values."""
    raise NotImplementedError


# ---------------------------------------------------------------------------
# TASK 3: tail latency amplification.
# A web page calls N backends in parallel and must wait for the slowest one.
# Simulate 10,000 pages: for each, draw N response times from `backend` (sample with
# rand.choice) and take the max. What fraction of pages exceed the backend's own p99?
# ---------------------------------------------------------------------------
def fraction_of_slow_pages(backend, n_calls, pages=10_000, seed=3):
    raise NotImplementedError


if __name__ == "__main__":
    try:
        print("== Task 1: open-loop vs closed-loop load generation ==")
        summary("closed loop (naive load tester)", closed_loop(50_000))
        for util in (0.5, 0.8, 0.9):
            rate = util / 12.9          # mean service time is ~12.9 ms
            summary(f"open loop at {int(util*100)}% utilisation", open_loop(rate, 50_000))
    except NotImplementedError:
        print("Task 1 not implemented yet")

    try:
        print("\n== Task 2: aggregating two servers ==")
        busy = open_loop(0.9 / 12.9, 40_000, seed=5)
        quiet = open_loop(0.3 / 12.9, 40_000, seed=6)
        wrong = (percentile(busy, 99) + percentile(quiet, 99)) / 2
        right = percentile_from_histogram(merge(histogram(busy), histogram(quiet)), 99)
        exact = percentile(busy + quiet, 99)
        print(f"average of p99s = {wrong:.1f} ms  |  p99 of merged histograms = {right:.1f} ms  |  exact = {exact:.1f} ms")
    except NotImplementedError:
        print("Task 2 not implemented yet")

    try:
        print("\n== Task 3: tail latency amplification ==")
        backend = open_loop(0.5 / 12.9, 50_000, seed=9)
        for n in (1, 5, 10, 50, 100):
            print(f"page calls {n:>3} backends -> {fraction_of_slow_pages(backend, n)*100:5.1f}% of pages slower than backend p99")
    except NotImplementedError:
        print("Task 3 not implemented yet")
