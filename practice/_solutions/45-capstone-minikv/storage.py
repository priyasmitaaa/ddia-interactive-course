"""MiniKV milestone 2 - an LSM-tree storage engine with a write-ahead log (Chapter 3).

    writes  -> append to the WAL (durable) -> insert into the in-memory memtable
    memtable full -> flush to a new immutable SSTable file (sorted by key), then reset the WAL
    reads   -> memtable, then SSTables from newest to oldest; the first hit wins (a tombstone means "deleted")
    compact -> merge all SSTables into one, keeping only the newest value per key and dropping tombstones
    restart -> load SSTables, then replay the WAL into the memtable (recovering acknowledged writes)

Records use encoding.py's framing, so a torn write at the end of the WAL is detected and ignored.
Each SSTable keeps a sparse in-memory index (every INDEX_EVERY-th key -> byte offset) for fast lookups.
"""
from __future__ import annotations

import bisect
import os

from encoding import Record, decode_stream, encode_record

INDEX_EVERY = 16
TOMBSTONE = None


class SSTable:
    def __init__(self, path: str):
        self.path = path
        with open(path, "rb") as f:
            data = f.read()
        recs, _ = decode_stream(data)
        self.keys = [r.key for _, r in recs]
        self.index_keys = [r.key for i, (_, r) in enumerate(recs) if i % INDEX_EVERY == 0]
        self.index_offsets = [off for i, (off, _) in enumerate(recs) if i % INDEX_EVERY == 0]
        self.size = len(data)

    @staticmethod
    def write(path: str, items: list[tuple[str, str | None]]) -> "SSTable":
        """items must be sorted by key. Writes atomically (temp file + rename)."""
        tmp = path + ".tmp"
        with open(tmp, "wb") as f:
            for k, v in items:
                f.write(encode_record(Record(k, v)))
            f.flush()
            os.fsync(f.fileno())
        os.replace(tmp, path)
        return SSTable(path)

    def get(self, key: str) -> tuple[bool, str | None]:
        """(found, value). Uses the sparse index to read only one block of the file."""
        i = bisect.bisect_right(self.index_keys, key) - 1
        if i < 0:
            return False, None
        start = self.index_offsets[i]
        end = self.index_offsets[i + 1] if i + 1 < len(self.index_offsets) else self.size
        with open(self.path, "rb") as f:
            f.seek(start)
            block = f.read(end - start)
        for _, r in decode_stream(block)[0]:
            if r.key == key:
                return True, r.value
            if r.key > key:
                break
        return False, None

    def items(self):
        with open(self.path, "rb") as f:
            for _, r in decode_stream(f.read())[0]:
                yield r.key, r.value


class LSMStore:
    def __init__(self, directory: str, memtable_limit: int = 64):
        self.dir = directory
        os.makedirs(directory, exist_ok=True)
        self.memtable_limit = memtable_limit
        self.memtable: dict[str, str | None] = {}
        self.wal_path = os.path.join(directory, "wal.log")
        names = sorted(f for f in os.listdir(directory) if f.startswith("sst-") and f.endswith(".db"))
        self.sstables = [SSTable(os.path.join(directory, n)) for n in names]       # oldest first
        self.next_sst = 1 + max([int(n[4:10]) for n in names], default=0)
        self._recover()
        self.wal = open(self.wal_path, "ab")

    def _recover(self) -> None:
        """Replay the WAL into the memtable; truncate a torn tail."""
        if not os.path.exists(self.wal_path):
            return
        with open(self.wal_path, "rb") as f:
            data = f.read()
        recs, valid = decode_stream(data)
        for _, r in recs:
            self.memtable[r.key] = r.value
        if valid < len(data):
            with open(self.wal_path, "r+b") as f:
                f.truncate(valid)

    def _append_wal(self, key: str, value: str | None) -> None:
        self.wal.write(encode_record(Record(key, value)))
        self.wal.flush()
        os.fsync(self.wal.fileno())

    def put(self, key: str, value: str) -> None:
        self._append_wal(key, value)
        self.memtable[key] = value
        if len(self.memtable) >= self.memtable_limit:
            self.flush()

    def delete(self, key: str) -> None:
        self._append_wal(key, TOMBSTONE)
        self.memtable[key] = TOMBSTONE
        if len(self.memtable) >= self.memtable_limit:
            self.flush()

    def get(self, key: str) -> str | None:
        if key in self.memtable:
            return self.memtable[key]
        for sst in reversed(self.sstables):
            found, value = sst.get(key)
            if found:
                return value
        return None

    def flush(self) -> None:
        """Write the memtable as a new SSTable, then start a fresh WAL."""
        if not self.memtable:
            return
        path = os.path.join(self.dir, f"sst-{self.next_sst:06d}.db")
        self.next_sst += 1
        self.sstables.append(SSTable.write(path, sorted(self.memtable.items())))
        self.memtable = {}
        self.wal.close()
        self.wal = open(self.wal_path, "wb")       # truncate: everything is now in the SSTable

    def compact(self) -> None:
        """Merge every SSTable into one; newest value per key wins; tombstones are dropped (this is a full merge)."""
        if len(self.sstables) < 2:
            return
        merged: dict[str, str | None] = {}
        for sst in self.sstables:                      # oldest first, so newer values overwrite older
            for k, v in sst.items():
                merged[k] = v
        live = sorted((k, v) for k, v in merged.items() if v is not None)
        path = os.path.join(self.dir, f"sst-{self.next_sst:06d}.db")
        self.next_sst += 1
        new = SSTable.write(path, live)
        old = self.sstables
        self.sstables = [new]
        for s in old:
            os.remove(s.path)

    def scan(self, start: str = "", end: str = "￿"):
        """All live (key, value) with start <= key < end, in key order."""
        view: dict[str, str | None] = {}
        for sst in self.sstables:
            for k, v in sst.items():
                if start <= k < end:
                    view[k] = v
        for k, v in self.memtable.items():
            if start <= k < end:
                view[k] = v
        return [(k, v) for k, v in sorted(view.items()) if v is not None]

    def close(self) -> None:
        self.wal.close()
