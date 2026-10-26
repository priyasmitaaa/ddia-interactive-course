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
        # TODO 1:
        #  - parts = one list per reducer
        #  - for each record (index i): for each (k, v) in self.mapper(record), append to
        #    parts[stable_hash(self.group_key(k)) % self.num_reducers]; then call self._maybe_crash(f"map-{m}", i)
        #  - sort each partition by norm(k) and write every pair as json.dumps([k, v]) + newline to out(r)
        raise NotImplementedError

    # --------------------------------------------------------------- reduce side
    def run_reduce_task(self, r: int, inputs: list[str], out) -> None:
        """Merge the sorted partition files for reducer r (one per mapper) WITHOUT re-sorting them all in memory,
        group adjacent records whose group_key(key) is equal, and call the reducer once per group with an iterator
        over the values. Write each reducer output as one JSON line to `out`."""
        # TODO 2:
        #  - open every input file; turn each into a generator of json.loads(line)
        #  - heapq.merge(*streams, key=lambda kv: norm(kv[0]))   <- merge, don't re-sort
        #  - itertools.groupby(merged, key=lambda kv: norm(self.group_key(kv[0])))
        #  - for each (index i, (key, group)): write every output of self.reducer(key, values-iterator) as a JSON
        #    line; then call self._maybe_crash(f"reduce-{r}", i)
        #  - close the files in a finally block
        raise NotImplementedError

    # --------------------------------------------------------------- task attempts
    def _attempt(self, task: str, final_path: str, body: Callable[[Callable[[str], Any]], None]) -> None:
        """Run `body` until it succeeds (at most 3 attempts). Each attempt writes into files named
        '<final>.attempt<N>' (body is given a function opening such a file for a final path); only when the body
        completes are they renamed to their final names. Leftover files from failed attempts are deleted."""
        # TODO 3: for attempt in 1..3: set self.attempts[task] = attempt; give `body` an open_out(path) function that
        #         opens (once per path) f"{path}.attempt{attempt}" for writing. If body raises TaskFailed: close and
        #         delete this attempt's files and try again. If it succeeds: close and os.replace() each attempt file
        #         to its final path (commit), then return. After 3 failures raise RuntimeError.
        raise NotImplementedError

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
    # TODO 4: write a mapper that emits ([id, 0], {"dob": ...}) for user records and ([user, 1, ts], {"url": ...})
    #         for events, and a reducer(user_id, values) that reads the first value (the user record, thanks to the
    #         secondary sort), skips the group if there is none, and yields [url, 2016 - dob] for each event.
    #         Run a Job with group_key=lambda k: k[0] over split_into(users + events, 3).
    raise NotImplementedError
