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
        # TODO: bisect_right on index_keys to find the block that could hold `key`; read only the bytes from
        #       that block's offset to the next index offset (or the end), decode them and scan.
        raise NotImplementedError

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
        # TODO: decode_stream(wal bytes); put every record into the memtable; if valid_length < file size,
        #       truncate the file to valid_length (the torn record was never acknowledged).
        raise NotImplementedError

    def _append_wal(self, key: str, value: str | None) -> None:
        self.wal.write(encode_record(Record(key, value)))
        self.wal.flush()
        os.fsync(self.wal.fileno())

    def put(self, key: str, value: str) -> None:
        # TODO: WAL first (durability), then memtable; flush when the memtable reaches memtable_limit.
        raise NotImplementedError

    def delete(self, key: str) -> None:
        self._append_wal(key, TOMBSTONE)
        self.memtable[key] = TOMBSTONE
        if len(self.memtable) >= self.memtable_limit:
            self.flush()

    def get(self, key: str) -> str | None:
        # TODO: memtable first, then SSTables newest to oldest; a found tombstone (None) means "deleted".
        raise NotImplementedError

    def flush(self) -> None:
        """Write the memtable as a new SSTable, then start a fresh WAL."""
        # TODO: SSTable.write(path, sorted(memtable.items())) with a new increasing sst-NNNNNN.db name, append
        #       it to self.sstables, clear the memtable, then reopen the WAL with mode "wb" to truncate it.
        raise NotImplementedError

    def compact(self) -> None:
        """Merge every SSTable into one; newest value per key wins; tombstones are dropped (this is a full merge)."""
        # TODO: read all SSTables oldest->newest into a dict, drop tombstones, write one new SSTable, swap it in,
        #       then delete the old files.
        raise NotImplementedError

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
