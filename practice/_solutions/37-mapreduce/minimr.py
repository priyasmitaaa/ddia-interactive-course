"""Lab 37 - build a tiny MapReduce engine, then use it for chained jobs and a reduce-side join (pp. 385-396).

The engine runs tasks one after another in this process, but it is structured exactly like Figure 10-1:

  map task m   : read input split m, call mapper(record) -> (key, value) pairs, partition by reducer,
                 sort each partition, write it to a "local disk" file  m{m}-r{r}.jsonl
  reduce task r: fetch partition r from every mapper (the shuffle), MERGE the sorted files (not re-sort),
                 group adjacent records by key, call reducer(key, values), write the output

Fault tolerance: a task attempt writes to a private temporary file; only a successful attempt is committed (renamed)
into place. Failed attempts are retried and their partial output is discarded - so the job's output is the same
as if no faults had occurred (p. 418).

  TODO 1  run_map_task
  TODO 2  run_reduce_task
  TODO 3  _attempt (retry + commit)
  TODO 4  join_events_with_users (reduce-side sort-merge join with a secondary sort)
"""
from __future__ import annotations

import heapq
import itertools
import json
import os
import zlib
from dataclasses import dataclass, field
from typing import Any, Callable, Iterable, Iterator


class TaskFailed(Exception):
    """Simulated crash of a task attempt."""


def stable_hash(key: Any) -> int:
    """Python's hash() of a str changes between runs (PYTHONHASHSEED), so partitioning must not use it."""
    return zlib.crc32(json.dumps(key).encode())


@dataclass
class Job:
    mapper: Callable[[Any], Iterable[tuple[Any, Any]]]
    reducer: Callable[[Any, Iterator[Any]], Iterable[Any]]
    num_reducers: int
    workdir: str
    # Secondary sort support: records are SORTED by the full key, PARTITIONED and GROUPED by group_key(key).
    group_key: Callable[[Any], Any] = lambda k: k
    fail_once: set[str] = field(default_factory=set)   # task names whose FIRST attempt crashes halfway
    attempts: dict[str, int] = field(default_factory=dict)

    # --------------------------------------------------------------- helpers (given)
    def _path(self, name: str) -> str:
        return os.path.join(self.workdir, name)

    def _maybe_crash(self, task: str, progress: int) -> None:
        if task in self.fail_once and self.attempts.get(task, 0) == 1 and progress >= 1:
            raise TaskFailed(task)

    # --------------------------------------------------------------- map side
    def run_map_task(self, m: int, split: list[Any], out: Callable[[int], Any]) -> None:
        """Run the mapper over every record of the split. Partition each (key, value) by
        stable_hash(group_key(key)) % num_reducers, sort each partition by key, and write partition r as JSON
        lines [key, value] to the file object returned by out(r)."""
        # TODO 1 (solution)
        parts: list[list[tuple[Any, Any]]] = [[] for _ in range(self.num_reducers)]
        for i, record in enumerate(split):
            for k, v in self.mapper(record):
                parts[stable_hash(self.group_key(k)) % self.num_reducers].append((k, v))
            self._maybe_crash(f"map-{m}", i)
        for r, kvs in enumerate(parts):
            kvs.sort(key=lambda kv: norm(kv[0]))
            f = out(r)
            for k, v in kvs:
                f.write(json.dumps([k, v]) + "\n")

    # --------------------------------------------------------------- reduce side
    def run_reduce_task(self, r: int, inputs: list[str], out) -> None:
        """Merge the sorted partition files for reducer r (one per mapper) WITHOUT re-sorting them all in memory,
        group adjacent records whose group_key(key) is equal, and call the reducer once per group with an iterator
        over the values. Write each reducer output as one JSON line to `out`."""
        # TODO 2 (solution)
        files = [open(p, encoding="utf-8") for p in inputs]
        try:
            streams = [(json.loads(line) for line in f) for f in files]
            merged = heapq.merge(*streams, key=lambda kv: norm(kv[0]))     # each file is already sorted
            groups = itertools.groupby(merged, key=lambda kv: norm(self.group_key(kv[0])))
            for i, (key, group) in enumerate(groups):
                for o in self.reducer(key, (v for _, v in group)):
                    out.write(json.dumps(o) + "\n")
                self._maybe_crash(f"reduce-{r}", i)
        finally:
            for f in files:
                f.close()

    # --------------------------------------------------------------- task attempts
    def _attempt(self, task: str, final_path: str, body: Callable[[Callable[[str], Any]], None]) -> None:
        """Run `body` until it succeeds (at most 3 attempts). Each attempt writes into files named
        '<final>.attempt<N>' (body is given a function opening such a file for a final path); only when the body
        completes are they renamed to their final names. Leftover files from failed attempts are deleted."""
        # TODO 3 (solution)
        for attempt in range(1, 4):
            self.attempts[task] = attempt
            opened: dict[str, Any] = {}

            def open_out(path: str):
                if path not in opened:
                    opened[path] = open(f"{path}.attempt{attempt}", "w", encoding="utf-8")
                return opened[path]
            try:
                body(open_out)
            except TaskFailed:
                for path, f in opened.items():
                    f.close()
                    os.remove(f"{path}.attempt{attempt}")
                continue
            for path, f in opened.items():
                f.close()
                os.replace(f"{path}.attempt{attempt}", path)      # commit
            return
        raise RuntimeError(f"{task} failed 3 times; the whole job fails and its partial output is discarded")

    # --------------------------------------------------------------- the job (given)
    def run(self, splits: list[list[Any]]) -> list[Any]:
        os.makedirs(self.workdir, exist_ok=True)
        R = self.num_reducers
        for m, split in enumerate(splits):
            paths = [self._path(f"m{m}-r{r}.jsonl") for r in range(R)]
            def body(open_out, m=m, split=split, paths=paths):
                files = [open_out(p) for p in paths]                # every partition file exists, maybe empty
                self.run_map_task(m, split, lambda r: files[r])
            self._attempt(f"map-{m}", paths[0], body)
        results = []
        for r in range(R):
            inputs = [self._path(f"m{m}-r{r}.jsonl") for m in range(len(splits))]
            out_path = self._path(f"part-{r}.jsonl")
            self._attempt(f"reduce-{r}", out_path, lambda open_out, r=r, inputs=inputs, out_path=out_path:
                          self.run_reduce_task(r, inputs, open_out(out_path)))
            with open(out_path, encoding="utf-8") as f:
                results.extend(json.loads(line) for line in f)
        return results


def norm(k):
    """Keys come back from JSON as lists; normalise tuples to lists so both compare the same way."""
    return [norm(x) for x in k] if isinstance(k, (list, tuple)) else k


def split_into(items: list[Any], n: int) -> list[list[Any]]:
    return [items[i::n] for i in range(n)]


# ===================================================================== using the engine

def top_urls(log_lines: list[str], k: int, workdir: str, reducers: int = 3) -> list[list[Any]]:
    """Two chained jobs, like the two sorts in the Unix pipeline: count per URL, then rank (pp. 387-390)."""
    counts = Job(mapper=lambda line: [(line.split()[6], 1)], reducer=lambda url, ones: [[url, sum(ones)]],
                 num_reducers=reducers, workdir=os.path.join(workdir, "job1")).run(split_into(log_lines, 3))
    # job 2: a single reducer sees every (−count, url) in sorted order and keeps the first k
    ranked = Job(mapper=lambda uc: [((-uc[1], uc[0]), uc)], reducer=lambda key, vals: list(vals),
                 num_reducers=1, workdir=os.path.join(workdir, "job2")).run(split_into(counts, 2))
    return ranked[:k]


def join_events_with_users(events: list[dict], users: list[dict], workdir: str, reducers: int = 2) -> list[list[Any]]:
    """Reduce-side sort-merge join on user_id (Figure 10-3). Output: [url, viewer_age] for every event whose user
    exists. Use a secondary sort so that each reduce call sees the user record FIRST, then that user's events in
    timestamp order: emit keys like [user_id, 0] for user records and [user_id, 1, ts] for events, partition and
    group by user_id only (group_key)."""
    # TODO 4 (solution)
    def mapper(rec: dict):
        if "dob" in rec:
            yield [rec["id"], 0], {"dob": rec["dob"]}
        else:
            yield [rec["user"], 1, rec["ts"]], {"url": rec["url"]}

    def reducer(user_id, values):
        first = next(values, None)
        if first is None or "dob" not in first:
            return                                   # events for an unknown user: drop (inner join)
        age = 2016 - first["dob"]
        for v in values:
            yield [v["url"], age]

    job = Job(mapper=mapper, reducer=reducer, num_reducers=reducers, workdir=workdir,
              group_key=lambda k: k[0])
    return job.run(split_into(users + events, 3))
