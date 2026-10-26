"""
Reference solution for exercise 12: a small LSM-tree (book pp. 74-77).

Layout in the data directory:
    wal.log              append-only log of writes not yet flushed (for crash recovery)
    sst-000001.dat       SSTable: records sorted by key, each record = klen|vlen|key|value
    sst-000001.idx       sparse index + bloom filter, as JSON (small, loaded into memory)
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
    def __init__(self, n_bits=8192, n_hashes=4, bits=None):
        self.n_bits, self.n_hashes = n_bits, n_hashes
        self.bits = bits if bits is not None else 0

    def _positions(self, key: bytes):
        h = hashlib.sha256(key).digest()
        for i in range(self.n_hashes):
            yield int.from_bytes(h[i * 4:(i + 1) * 4], "little") % self.n_bits

    def add(self, key: bytes):
        for p in self._positions(key):
            self.bits |= 1 << p

    def might_contain(self, key: bytes) -> bool:
        return all((self.bits >> p) & 1 for p in self._positions(key))


def _encode(key: bytes, value):
    vlen = TOMBSTONE if value is None else len(value)
    return REC.pack(len(key), vlen) + key + (value or b"")


def _decode_all(data: bytes, pos=0):
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
        self.prefix = path_prefix
        with open(path_prefix + ".idx") as f:
            meta = json.load(f)
        self.index_keys = [bytes.fromhex(k) for k in meta["keys"]]
        self.index_offsets = meta["offsets"]
        self.bloom = BloomFilter(meta["bloom_bits"], meta["bloom_hashes"], int(meta["bloom"], 16))
        self.reads = 0  # how many times we touched the data file (for stats)

    @staticmethod
    def write(path_prefix: str, items, sparse_every=16, n_bits=8192):
        keys, offsets = [], []
        bloom = BloomFilter(n_bits)
        with open(path_prefix + ".dat", "wb") as f:
            for i, (k, v) in enumerate(items):
                if i % sparse_every == 0:
                    keys.append(k.hex()); offsets.append(f.tell())
                bloom.add(k)
                f.write(_encode(k, v))
            f.flush(); os.fsync(f.fileno())
        with open(path_prefix + ".idx", "w") as f:
            json.dump({"keys": keys, "offsets": offsets, "bloom": hex(bloom.bits),
                       "bloom_bits": bloom.n_bits, "bloom_hashes": bloom.n_hashes}, f)
        return SSTable(path_prefix)

    def get(self, key: bytes):
        """Returns (found, value). value None + found True means tombstone."""
        if not self.bloom.might_contain(key):
            return False, None
        i = bisect.bisect_right(self.index_keys, key) - 1
        if i < 0:
            return False, None
        start = self.index_offsets[i]
        end = self.index_offsets[i + 1] if i + 1 < len(self.index_offsets) else None
        self.reads += 1
        with open(self.prefix + ".dat", "rb") as f:
            f.seek(start)
            block = f.read() if end is None else f.read(end - start)
        for _, k, v in _decode_all(block):
            if k == key:
                return True, v
            if k > key:
                break
        return False, None

    def items(self):
        with open(self.prefix + ".dat", "rb") as f:
            data = f.read()
        for _, k, v in _decode_all(data):
            yield k, v

    def delete_files(self):
        for ext in (".dat", ".idx"):
            os.remove(self.prefix + ext)


class LSMTree:
    def __init__(self, directory: str, memtable_limit=1000, sparse_every=16):
        self.dir = directory
        self.limit = memtable_limit
        self.sparse_every = sparse_every
        os.makedirs(directory, exist_ok=True)
        ids = sorted(int(f[4:10]) for f in os.listdir(directory) if f.startswith("sst-") and f.endswith(".idx"))
        self.sstables = [SSTable(self._prefix(i)) for i in ids]   # oldest first
        self.next_id = (ids[-1] + 1) if ids else 1
        self.memtable: dict[bytes, bytes | None] = {}
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
        self.wal.write(_encode(key, value)); self.wal.flush()
        self.memtable[key] = value
        if len(self.memtable) >= self.limit:
            self.flush()

    def put(self, key: bytes, value: bytes):
        self._write(key, value)

    def delete(self, key: bytes):
        self._write(key, None)

    def flush(self):
        if not self.memtable:
            return
        items = sorted(self.memtable.items())
        self.sstables.append(SSTable.write(self._prefix(self.next_id), items, self.sparse_every))
        self.next_id += 1
        self.memtable = {}
        self.wal.close()
        os.remove(self.wal_path)
        self.wal = open(self.wal_path, "ab")

    def get(self, key: bytes):
        if key in self.memtable:
            return self.memtable[key]
        for sst in reversed(self.sstables):                       # newest first
            found, v = sst.get(key)
            if found:
                return v
        return None

    def scan(self, lo: bytes, hi: bytes):
        """All live (key, value) with lo <= key < hi, in key order. Newer sources win."""
        sources = [sorted((k, v) for k, v in self.memtable.items() if lo <= k < hi)]
        for sst in reversed(self.sstables):
            sources.append([(k, v) for k, v in sst.items() if lo <= k < hi])
        # tag each item with source rank so heapq.merge yields newest version first for equal keys
        tagged = [[(k, rank, v) for k, v in src] for rank, src in enumerate(sources)]
        last = None
        for k, rank, v in heapq.merge(*tagged):
            if k == last:
                continue
            last = k
            if v is not None:
                yield k, v

    def compact(self):
        """Merge all SSTables into one, newest value wins, tombstones dropped (safe: we merge everything)."""
        if len(self.sstables) < 2:
            return
        tagged = [[(k, -i, v) for k, v in sst.items()] for i, sst in enumerate(self.sstables)]  # newer = more negative
        merged, last = [], None
        for k, neg_i, v in heapq.merge(*tagged):
            if k == last:
                continue
            last = k
            if v is not None:
                merged.append((k, v))
        new = SSTable.write(self._prefix(self.next_id), merged, self.sparse_every)
        self.next_id += 1
        for sst in self.sstables:
            sst.delete_files()
        self.sstables = [new]

    def close(self):
        self.wal.close()
