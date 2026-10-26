"""Exercise 38 - recomputation needs deterministic operators (pp. 410-411), and pipelining vs materialization.

Dataflow engines like Spark and Flink don't write intermediate state to a distributed filesystem. If a machine dies,
lost partitions are RECOMPUTED from their inputs. That is only safe if recomputing gives exactly the same output as
the first time - otherwise downstream operators that already consumed the old output see contradictions.

Non-determinism creeps in easily (p. 410): hash-table iteration order, random numbers, the system clock. Python is a
real example: the iteration order of a set of strings changes between processes (string hashing is randomised per
process via PYTHONHASHSEED). We "recompute" each operator in fresh processes with different hash seeds and compare.

  TODO 1  first_distinct_fixed   (instead of first_distinct_broken)
  TODO 2  sample_fixed           (instead of sample_broken)
  TODO 3  tag_with_batch_fixed   (instead of tag_with_batch_broken)

Part B compares a pipelined chain of operators (generators) with a materialized one (lists), like Unix pipes vs
MapReduce's intermediate files (pp. 407-408, 411).
"""
from __future__ import annotations

import json
import os
import random
import subprocess
import sys
import time
import tracemalloc
from datetime import datetime, timezone

RECORDS = [f"user{i % 37}:{['click', 'view', 'buy'][i % 3]}" for i in range(500)]


# ------------------------------------------------------------------ non-deterministic operators (given)

def first_distinct_broken(records: list[str], k: int) -> list[str]:
    """'Give me k distinct users' - iterates over a set, whose order depends on the process's hash seed."""
    return list({r.split(":")[0] for r in records})[:k]


def sample_broken(records: list[str], k: int, partition: int) -> list[str]:
    """Random sample with an unseeded RNG - different every time."""
    return random.sample(records, k)


def tag_with_batch_broken(records: list[str]) -> list[str]:
    """Tags every record with 'the current hour' from the system clock - a recomputation an hour later differs."""
    hour = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H")
    return [f"{hour}|{r}" for r in records[:3]]


# ------------------------------------------------------------------ your deterministic versions

def first_distinct_fixed(records: list[str], k: int) -> list[str]:
    # TODO 1 (solution)
    return sorted({r.split(":")[0] for r in records})[:k]


def sample_fixed(records: list[str], k: int, partition: int) -> list[str]:
    # TODO 2 (solution)
    return random.Random(f"job-42/partition-{partition}").sample(records, k)


def tag_with_batch_fixed(records: list[str], batch_time: str) -> list[str]:
    # TODO 3 (solution)
    return [f"{batch_time}|{r}" for r in records[:3]]


# ------------------------------------------------------------------ recomputation harness (given)

CALLS = {
    "first_distinct_broken": "first_distinct_broken(RECORDS, 5)",
    "first_distinct_fixed": "first_distinct_fixed(RECORDS, 5)",
    "sample_broken": "sample_broken(RECORDS, 3, partition=7)",
    "sample_fixed": "sample_fixed(RECORDS, 3, partition=7)",
    "tag_with_batch_fixed": "tag_with_batch_fixed(RECORDS, batch_time='2016-07-11T00')",
}


def recompute(call: str, hash_seed: int) -> list[str]:
    """Run one operator call in a FRESH Python process with the given hash seed, as a recomputation would."""
    here = os.path.dirname(os.path.abspath(__file__))
    code = f"import json, sys; sys.path.insert(0, {here!r}); from operators import *; print(json.dumps({call}))"
    env = dict(os.environ, PYTHONHASHSEED=str(hash_seed))
    out = subprocess.run([sys.executable, "-c", code], env=env, capture_output=True, text=True)
    if out.returncode != 0:
        raise RuntimeError(out.stderr.strip().splitlines()[-1])
    return json.loads(out.stdout)


def is_deterministic(name: str, runs: int = 5) -> bool:
    outputs = {json.dumps(recompute(CALLS[name], seed)) for seed in range(1, runs + 1)}
    return len(outputs) == 1


# ------------------------------------------------------------------ Part B: pipelined vs materialized

def parse(lines):
    for line in lines:
        user, action = line.split(":")
        yield {"user": user, "action": action}


def only_buys(recs):
    for r in recs:
        if r["action"] == "buy":
            yield r


def enrich(recs):
    for r in recs:
        work = sum(i * i for i in range(200))   # pretend each record costs a little CPU work
        yield {**r, "segment": (int(r["user"][4:]) + work) % 5}


def time_to_first_and_peak(materialize: bool, n: int = 60_000):
    data = RECORDS * (n // len(RECORDS))
    tracemalloc.start()
    t0 = time.perf_counter()
    if materialize:                           # each stage fully written out before the next starts
        stage = list(enrich(list(only_buys(list(parse(data))))))
        first = stage[0]
        t_first = time.perf_counter() - t0
        total = len(stage)
    else:                                     # pipelined, like `cmd1 | cmd2 | cmd3`
        it = enrich(only_buys(parse(data)))
        first = next(it)
        t_first = time.perf_counter() - t0
        total = 1 + sum(1 for _ in it)
    t_all = time.perf_counter() - t0
    _, peak = tracemalloc.get_traced_memory()
    tracemalloc.stop()
    assert first["action"] == "buy"
    return t_first, t_all, peak / 1e6, total


if __name__ == "__main__":
    print("Recomputing each operator in 5 fresh processes with different hash seeds:")
    for name in CALLS:
        try:
            verdict = "deterministic" if is_deterministic(name) else "NON-DETERMINISTIC"
        except RuntimeError as e:
            verdict = f"error: {e}"
        print(f"  {name:<24} {verdict}")
    print("\nPart B - three chained operators over 60,000 records:")
    for mat in (True, False):
        tf, ta, mb, n = time_to_first_and_peak(mat)
        print(f"  {'materialized' if mat else 'pipelined':<13} first output after {tf:6.3f} s, all done after {ta:5.2f} s,"
              f" peak memory {mb:6.1f} MB ({n} output records)")
