"""Exercise 40 - a log-based message broker on your disk (pp. 432-436, Figure 11-3).

A topic has N partitions. Each partition is a directory of SEGMENT files; each segment holds up to SEGMENT_SIZE
messages, one JSON line each. A message's OFFSET is its position in the partition (monotonically increasing,
never reused). Producers choose a partition by hashing the key, so all messages with the same key are in one
partition, in order. Consumer groups store one committed offset per partition - not one ack per message.

  TODO 1  Broker.append        - append to the partition's latest segment (start a new one when full)
  TODO 2  Broker.read          - read up to max_n messages starting at an offset
  TODO 3  Broker.commit/committed - consumer-group offsets, stored durably
  TODO 4  Broker.apply_retention  - delete whole old segments, keeping the newest `keep_segments` per partition
"""
from __future__ import annotations

import json
import os
import zlib

SEGMENT_SIZE = 4


class OffsetOutOfRange(Exception):
    """The requested offset was deleted by retention (the consumer fell too far behind)."""


class Broker:
    def __init__(self, directory: str, partitions: int = 3):
        self.dir = directory
        self.partitions = partitions
        for p in range(partitions):
            os.makedirs(self._pdir(p), exist_ok=True)

    # ------------------------------------------------------------------ helpers (given)
    def _pdir(self, p: int) -> str:
        return os.path.join(self.dir, f"partition-{p}")

    def segments(self, p: int) -> list[int]:
        """Base offsets of this partition's segment files, ascending. Segment '00000008.log' starts at offset 8."""
        return sorted(int(f.split(".")[0]) for f in os.listdir(self._pdir(p)) if f.endswith(".log"))

    def _seg_path(self, p: int, base: int) -> str:
        return os.path.join(self._pdir(p), f"{base:08d}.log")

    def _count(self, path: str) -> int:
        with open(path, encoding="utf-8") as f:
            return sum(1 for _ in f)

    def partition_for(self, key: str) -> int:
        return zlib.crc32(key.encode()) % self.partitions

    def end_offset(self, p: int) -> int:
        """The offset the next appended message will get."""
        segs = self.segments(p)
        if not segs:
            return 0
        return segs[-1] + self._count(self._seg_path(p, segs[-1]))

    # ------------------------------------------------------------------ producing
    def append(self, key: str, value) -> tuple[int, int]:
        """Append (key, value) to partition_for(key). Returns (partition, offset)."""
        # TODO 1: p = self.partition_for(key); offset = self.end_offset(p). If the partition has no segment yet, or its
        #         newest segment already holds SEGMENT_SIZE messages, start a new segment file named after `offset`
        #         (self._seg_path(p, offset)); otherwise append to the newest one. Write one JSON line
        #         {"offset", "key", "value"}. Return (p, offset).
        raise NotImplementedError

    # ------------------------------------------------------------------ consuming
    def read(self, p: int, offset: int, max_n: int = 100) -> list[dict]:
        """Messages with offsets offset, offset+1, ... (at most max_n). Raises OffsetOutOfRange if `offset` is older
        than the oldest retained message. Returns [] at the end of the log."""
        # TODO 2: if offset is older than the first retained segment's base offset, raise OffsetOutOfRange.
        #         Otherwise scan the segments in order (skip whole segments that end before `offset`) and collect
        #         messages whose offset >= offset, stopping after max_n.
        raise NotImplementedError

    # ------------------------------------------------------------------ consumer groups
    def _offsets_path(self, group: str) -> str:
        return os.path.join(self.dir, f"offsets-{group}.json")

    def commit(self, group: str, p: int, next_offset: int) -> None:
        """Durably record that `group` has processed everything in partition p before next_offset."""
        # TODO 3a: keep a JSON file {partition: next_offset} per group (self._offsets_path(group)). Update the entry
        #          for p and write the file atomically (write a temp file, then os.replace).
        raise NotImplementedError

    def committed(self, group: str, p: int) -> int:
        """The group's committed offset for p, or 0 if it never committed."""
        # TODO 3b: read the group's offsets file; return the entry for p, or 0.
        raise NotImplementedError

    # ------------------------------------------------------------------ retention
    def apply_retention(self, keep_segments: int) -> int:
        """Delete the oldest segment files so each partition keeps at most keep_segments. Never delete the newest
        (active) segment. Returns the number of segment files deleted."""
        # TODO 4: for each partition, delete all but the newest keep_segments segment files. Return how many you deleted.
        raise NotImplementedError


class Consumer:
    """A consumer in a group that owns some partitions. Given - it shows how offsets are used."""

    def __init__(self, broker: Broker, group: str, partitions: list[int]):
        self.b, self.group, self.parts = broker, group, partitions
        self.position = {p: broker.committed(group, p) for p in partitions}

    def poll(self, max_n: int = 10) -> list[dict]:
        out = []
        for p in self.parts:
            msgs = self.b.read(p, self.position[p], max_n)
            for m in msgs:
                m["partition"] = p
            out += msgs
            if msgs:
                self.position[p] = msgs[-1]["offset"] + 1
        return out

    def commit(self) -> None:
        for p, off in self.position.items():
            self.b.commit(self.group, p, off)


if __name__ == "__main__":
    import tempfile
    with tempfile.TemporaryDirectory() as d:
        b = Broker(d)
        for i in range(30):
            b.append(f"user{i % 5}", {"n": i})
        for p in range(3):
            print(f"partition {p}: segments {b.segments(p)}, end offset {b.end_offset(p)}")
        c = Consumer(b, "analytics", [0, 1, 2])
        first = c.poll(3)
        c.commit()
        print(f"analytics read {len(first)} messages and committed; offsets now {c.position}")
        print(f"retention deleted {b.apply_retention(keep_segments=2)} segment files")
        try:
            Consumer(b, "late-joiner", [2]).poll()
        except OffsetOutOfRange as e:
            print("late joiner:", e)
