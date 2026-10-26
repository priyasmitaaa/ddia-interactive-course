"""Exercise 36 - the log-analysis pipeline from p. 379, and sorting data bigger than your memory budget.

We generate a synthetic nginx access log, then answer "what are the 5 most requested URLs?" two ways:

  1. In-memory aggregation, like the Ruby script on p. 380: a hash table {url: count}.
  2. Like `sort | uniq -c | sort -r -n | head -n 5`, using an EXTERNAL merge sort that never holds more than
     `max_lines` lines in memory: sort chunks, write each as a sorted run file, then merge the runs
     (the SSTable idea from Chapter 3, p. 381-382).

  TODO 1  external_sort
  TODO 2  uniq_c
  TODO 3  top_k

We measure peak Python memory with tracemalloc to see the difference: the hash table's size grows with the number
of DISTINCT URLs, while the external sort's memory is bounded by max_lines whatever the input.
"""
from __future__ import annotations

import heapq
import os
import random
import tempfile
import time
import tracemalloc
from collections import Counter
from typing import Iterable, Iterator

LOG_FORMAT = '{ip} - - [27/Feb/2015:17:55:{sec:02d} +0000] "GET {url} HTTP/1.1" 200 {size} "-" "Mozilla/5.0"\n'


def generate_log(path: str, n_lines: int, n_urls: int, seed: int = 1) -> None:
    """Zipf-like popularity: a few URLs are very popular, most are rare (like real websites)."""
    rnd = random.Random(seed)
    weights = [1 / (i + 1) for i in range(n_urls)]
    urls = [f"/page/{i}/{'x' * (i % 40)}" for i in range(n_urls)]
    with open(path, "w", encoding="utf-8") as f:
        for i, u in enumerate(rnd.choices(urls, weights=weights, k=n_lines)):
            f.write(LOG_FORMAT.format(ip=f"10.0.{i % 250}.{i % 199}", sec=i % 60, url=u, size=1000 + i % 5000))


def extract_urls(path: str) -> Iterator[str]:
    """awk '{print $7}' : the 7th whitespace-separated field of each line."""
    with open(path, encoding="utf-8") as f:
        for line in f:
            yield line.split()[6]


def external_sort(items: Iterable[str], max_lines: int, tmpdir: str) -> Iterator[str]:
    """Yield `items` in sorted order while holding at most `max_lines` of them in memory at once.
    Read up to max_lines items, sort them, write them to a run file; repeat; then k-way merge all runs."""
    # TODO 1 (solution)
    runs: list[str] = []
    chunk: list[str] = []

    def flush():
        chunk.sort()
        fd, path = tempfile.mkstemp(dir=tmpdir, suffix=".run")
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            f.writelines(x + "\n" for x in chunk)
        runs.append(path)
        chunk.clear()

    for x in items:
        chunk.append(x)
        if len(chunk) >= max_lines:
            flush()
    if chunk:
        flush()
    files = [open(p, encoding="utf-8") for p in runs]
    try:
        for line in heapq.merge(*files):          # sequential reads of every run, one line at a time
            yield line.rstrip("\n")
    finally:
        for f in files:
            f.close()
        for p in runs:
            os.remove(p)


def uniq_c(sorted_items: Iterable[str]) -> Iterator[tuple[int, str]]:
    """`uniq -c`: collapse ADJACENT equal items into (count, item). Constant memory."""
    # TODO 2 (solution)
    cur, n = None, 0
    for x in sorted_items:
        if x == cur:
            n += 1
        else:
            if cur is not None:
                yield n, cur
            cur, n = x, 1
    if cur is not None:
        yield n, cur


def top_k(counted: Iterable[tuple[int, str]], k: int) -> list[tuple[int, str]]:
    """`sort -r -n | head -n k`, but without sorting everything: keep only the k largest seen so far."""
    # TODO 3 (solution)
    return heapq.nlargest(k, counted)


def via_hash_table(path: str, k: int = 5) -> list[tuple[int, str]]:
    counts = Counter(extract_urls(path))
    return sorted(((c, u) for u, c in counts.items()), reverse=True)[:k]


def via_sort(path: str, max_lines: int, tmpdir: str, k: int = 5) -> list[tuple[int, str]]:
    return top_k(uniq_c(external_sort(extract_urls(path), max_lines, tmpdir)), k)


def measure(fn, *args):
    tracemalloc.start()
    t0 = time.perf_counter()
    result = fn(*args)
    elapsed = time.perf_counter() - t0
    _, peak = tracemalloc.get_traced_memory()
    tracemalloc.stop()
    return result, peak / 1e6, elapsed


if __name__ == "__main__":
    with tempfile.TemporaryDirectory() as d:
        for n_urls in (100, 200_000):
            log = os.path.join(d, "access.log")
            generate_log(log, n_lines=400_000, n_urls=n_urls)
            r1, m1, t1 = measure(via_hash_table, log)
            r2, m2, t2 = measure(via_sort, log, 20_000, d)
            assert r1 == r2, "both methods must agree"
            print(f"\n400,000 log lines, {n_urls:,} distinct URLs. Top URL: {r1[0][1][:30]} ({r1[0][0]} requests)")
            print(f"  hash table : peak {m1:7.1f} MB   {t1:5.2f} s")
            print(f"  ext. sort  : peak {m2:7.1f} MB   {t2:5.2f} s   (never more than 20,000 lines in memory)")
        if os.environ.get("KEEP_LOG"):
            import shutil
            shutil.copy(log, "access.log")
            print("copied the last log to ./access.log - try: sh practice/36-external-sort/pipeline.sh access.log")
