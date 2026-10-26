"""MiniKV milestones 5 and 6 - partitioning with rebalancing, and a change stream (Chapters 6 and 11).

M5: the key space is split into a FIXED number of partitions (Chapter 6, "fixed number of partitions"):
    partition = crc32(key) % NUM_PARTITIONS. Each partition is a ReplicaSet. A partition map assigns partitions to
    "groups" (think: sets of machines). Adding a group moves whole partitions to it, never splitting keys - so only
    the moved partitions' data travels. Compare with hash(key) mod N, where adding a node moves most keys.

M6: each partition leader's replication log doubles as a CHANGE STREAM (CDC, Chapter 11). A ChangeConsumer keeps a
    per-partition offset (= last sequence number applied) and maintains a derived secondary index value -> keys.
    Applying is idempotent by sequence number, so re-delivering the same entries is harmless.
"""
from __future__ import annotations

import os
import zlib
from collections import defaultdict

from replication import ReplicaSet

NUM_PARTITIONS = 8


def partition_of(key: str) -> int:
    return zlib.crc32(key.encode()) % NUM_PARTITIONS


class Cluster:
    def __init__(self, directory: str, groups=("g1", "g2")):
        self.dir = directory
        self.partitions = {p: ReplicaSet(os.path.join(directory, f"p{p}"), memtable_limit=16) for p in range(NUM_PARTITIONS)}
        self.groups = list(groups)
        self.assignment = {p: self.groups[p % len(self.groups)] for p in range(NUM_PARTITIONS)}
        self.moves = 0

    # ------------------------------------------------------------------ M5: routing and rebalancing
    def put(self, key: str, value: str) -> None:
        self.partitions[partition_of(key)].write(key, value)

    def delete(self, key: str) -> None:
        self.partitions[partition_of(key)].write(key, None)

    def get(self, key: str) -> str | None:
        return self.partitions[partition_of(key)].read(key)

    def group_of(self, key: str) -> str:
        return self.assignment[partition_of(key)]

    def partitions_per_group(self) -> dict[str, int]:
        out = {g: 0 for g in self.groups}
        for g in self.assignment.values():
            out[g] += 1
        return out

    def add_group(self, name: str) -> list[int]:
        """Add a group and move whole partitions to it, taking them from the most loaded groups, until it holds its fair
        share (NUM_PARTITIONS // number_of_groups). Returns the partitions moved. (In a real system, moving means
        copying the partition's data to the new machines, then switching the assignment; here the ReplicaSet object
        simply changes owner, which is the part that matters for routing.)"""
        self.groups.append(name)
        share = NUM_PARTITIONS // len(self.groups)
        moved = []
        while self.partitions_per_group()[name] < share:
            counts = self.partitions_per_group()
            donor = max((g for g in self.groups if g != name), key=lambda g: counts[g])
            p = max(p for p, g in self.assignment.items() if g == donor)
            self.assignment[p] = name
            moved.append(p)
        self.moves += len(moved)
        return moved

    def close(self) -> None:
        for rs in self.partitions.values():
            rs.close()

    def replicate_all(self) -> None:
        for rs in self.partitions.values():
            rs.replicate()


class ChangeConsumer:
    """Builds a derived index {value: set(keys)} from every partition's change stream (the leader's log)."""

    def __init__(self, cluster: Cluster):
        self.cluster = cluster
        self.offsets = defaultdict(int)          # partition -> last applied seq
        self.current: dict[str, str] = {}        # key -> value currently indexed
        self.by_value: dict[str, set[str]] = defaultdict(set)

    def _apply(self, key: str, value: str | None) -> None:
        old = self.current.pop(key, None)
        if old is not None:
            self.by_value[old].discard(key)
        if value is not None:
            self.current[key] = value
            self.by_value[value].add(key)

    def poll(self) -> int:
        """Apply new entries from every partition leader's log, in order, skipping entries at or below the stored offset
        (so redelivery is harmless). Returns how many entries were applied."""
        n = 0
        for p, rs in self.cluster.partitions.items():
            for e in rs.nodes[rs.leader].log:
                if e.seq <= self.offsets[p]:
                    continue
                self._apply(e.key, e.value)
                self.offsets[p] = e.seq
                n += 1
        return n

    def lookup(self, value: str) -> set[str]:
        return set(self.by_value.get(value, set()))
