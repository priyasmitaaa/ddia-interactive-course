"""
Exercise 12 — Build a small LSM-tree (book pp. 74-77).

Layout in the data directory:
    wal.log              append-only log of writes not yet flushed (for crash recovery)
    sst-000001.dat       SSTable data: records SORTED BY KEY, each = klen | vlen | key | value
    sst-000001.idx       sparse index + Bloom filter, as JSON (small, loaded into memory)

vlen == TOMBSTONE marks a delete. Run the tests:  python practice/12-lsm-tree/test_lsm.py
"""
import bisect
import hashlib
import heapq
import json
import os
import struct

REC = struct.Struct("<II")
TOMBSTONE = 0xFFFFFFFF


class BloomFilter:
    """A set that can say "definitely not present" or "maybe present". Bits stored in a Python int."""

    def __init__(self, n_bits=8192, n_hashes=4, bits=None):
        self.n_bits, self.n_hashes = n_bits, n_hashes
        self.bits = bits if bits is not None else 0

    def _positions(self, key: bytes):
        """Given: n_hashes bit positions derived from one SHA-256 of the key."""
        h = hashlib.sha256(key).digest()
        for i in range(self.n_hashes):
            yield int.from_bytes(h[i * 4:(i + 1) * 4], "little") % self.n_bits

    def add(self, key: bytes):
        """TODO 1: set the bit at every position."""
        raise NotImplementedError

    def might_contain(self, key: bytes) -> bool:
        """TODO 1: True only if ALL positions are set."""
        raise NotImplementedError


def _encode(key: bytes, value):
    vlen = TOMBSTONE if value is None else len(value)
    return REC.pack(len(key), vlen) + key + (value or b"")


def _decode_all(data: bytes, pos=0):
    """Given: yields (offset, key, value_or_None) for each record in `data`."""
    while pos + REC.size <= len(data):
        klen, vlen = REC.unpack_from(data, pos)
        k = data[pos + REC.size: pos + REC.size + klen]
        start = pos + REC.size + klen
        if vlen == TOMBSTONE:
            yield pos, k, None
            pos = start
        else:
            yield pos, k, data[start:start + vlen]
            pos = start + vlen


class SSTable:
    def __init__(self, path_prefix: str):
        """Given: loads the sparse index and Bloom filter from the .idx file."""
        self.prefix = path_prefix
        with open(path_prefix + ".idx") as f:
            meta = json.load(f)
        self.index_keys = [bytes.fromhex(k) for k in meta["keys"]]
        self.index_offsets = meta["offsets"]
        self.bloom = BloomFilter(meta["bloom_bits"], meta["bloom_hashes"], int(meta["bloom"], 16))
        self.reads = 0  # increment every time get() reads from the .dat file

    @staticmethod
    def write(path_prefix: str, items, sparse_every=16, n_bits=8192):
        """TODO 2: `items` is a list of (key, value_or_None) ALREADY SORTED by key.
        Write each record with _encode into path_prefix + ".dat". For every `sparse_every`-th
        record (i % sparse_every == 0), remember its key and byte offset. Add every key to a
        BloomFilter(n_bits). fsync the file. Then write path_prefix + ".idx" as JSON:
            {"keys": [hex strings], "offsets": [...], "bloom": hex(bloom.bits),
             "bloom_bits": ..., "bloom_hashes": ...}
        and return SSTable(path_prefix)."""
        raise NotImplementedError

    def get(self, key: bytes):
        """TODO 3: return (found, value). (True, None) means a tombstone was found.
        1. If the Bloom filter says no → (False, None) without touching the disk.
        2. bisect the sparse index for the last indexed key <= key.
        3. Read only the block from that offset to the next indexed offset (self.reads += 1),
           decode it, and look for the key (records are sorted: you can stop early)."""
        raise NotImplementedError

    def items(self):
        """Given: all (key, value_or_None) in key order."""
        with open(self.prefix + ".dat", "rb") as f:
            data = f.read()
        for _, k, v in _decode_all(data):
            yield k, v

    def delete_files(self):
        for ext in (".dat", ".idx"):
            os.remove(self.prefix + ext)


class LSMTree:
    def __init__(self, directory: str, memtable_limit=1000, sparse_every=16):
        """Given: loads existing SSTables (oldest first) and replays the WAL into the memtable."""
        self.dir = directory
        self.limit = memtable_limit
        self.sparse_every = sparse_every
        os.makedirs(directory, exist_ok=True)
        ids = sorted(int(f[4:10]) for f in os.listdir(directory) if f.startswith("sst-") and f.endswith(".idx"))
        self.sstables = [SSTable(self._prefix(i)) for i in ids]   # oldest first
        self.next_id = (ids[-1] + 1) if ids else 1
        self.memtable: dict[bytes, bytes | None] = {}             # we sort at flush time
        self.wal_path = os.path.join(directory, "wal.log")
        if os.path.exists(self.wal_path):                        # crash recovery
            with open(self.wal_path, "rb") as f:
                data = f.read()
            for _, k, v in _decode_all(data):
                self.memtable[k] = v
        self.wal = open(self.wal_path, "ab")

    def _prefix(self, i):
        return os.path.join(self.dir, f"sst-{i:06d}")

    def _write(self, key: bytes, value):
        """TODO 4: append the record to the WAL (and flush the file object), put it in the memtable,
        and call self.flush() when the memtable reaches self.limit entries."""
        raise NotImplementedError

    def put(self, key: bytes, value: bytes):
        self._write(key, value)

    def delete(self, key: bytes):
        self._write(key, None)

    def flush(self):
        """TODO 4: write the memtable, sorted, as a new SSTable (self.next_id), append it to
        self.sstables, clear the memtable, and start a fresh empty WAL (it's no longer needed)."""
        raise NotImplementedError

    def get(self, key: bytes):
        """TODO 5: memtable first, then SSTables NEWEST first. Return None for missing or deleted."""
        raise NotImplementedError

    def scan(self, lo: bytes, hi: bytes):
        """TODO 6: yield live (key, value) for lo <= key < hi, in key order, newest version winning.
        Hint: build one sorted list per source (memtable, then SSTables newest→oldest), tag items as
        (key, source_rank, value) with rank 0 = newest, and use heapq.merge; skip repeated keys."""
        raise NotImplementedError

    def compact(self):
        """TODO 7: merge ALL SSTables into one new SSTable (newest value wins; drop tombstones —
        safe only because we merge everything), delete the old files, self.sstables = [new]."""
        raise NotImplementedError

    def close(self):
        self.wal.close()
