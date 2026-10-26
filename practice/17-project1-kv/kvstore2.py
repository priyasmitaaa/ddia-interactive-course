"""
Project 1 — KV store v2. Start here (or paste in your own exercise-08 code in the same shape).

This file is a COMPLETE, working Bitcask-style store in the v1 format of exercise 08 (milestone M0
passes as-is). Your project is to evolve it, milestone by milestone, without breaking old data:

  M1  hint files       — when a segment is closed, save its part of the keydir next to it
                         ("000003.hint"); on startup, load hints instead of scanning closed segments.
  M2  format v2        — every record also stores a timestamp (ms). New segments start with the
                         4-byte header MAGIC_V2; segments without it are v1 and must still be readable.
                         Never append v2 records into a v1 file.
  M3  group commit     — write_batch(items): append all, then flush + fsync ONCE.
  M4  background compaction — compact(background=True) returns a started thread; heavy copying must
                         happen without holding self.lock; only the final swap is under the lock;
                         keys overwritten during compaction must keep their newer location.

Formats
  v1 (no header):           crc32 | key_len(u32) | value_len(u32) | key | value
  v2 (header b"KV2\\n"):     crc32 | timestamp_ms(u64) | key_len(u32) | value_len(u32) | key | value
  crc32 covers everything after the crc field; value_len == TOMBSTONE marks a delete.

Tests:  python practice/17-project1-kv/test_project1.py
"""
import json
import os
import struct
import threading
import time
import zlib

V1_HEADER = struct.Struct("<III")        # crc, klen, vlen
V2_HEADER = struct.Struct("<IQII")       # crc, ts, klen, vlen      (for M2)
MAGIC_V2 = b"KV2\n"
TOMBSTONE = 0xFFFFFFFF


def encode_v1(key: bytes, value: bytes | None) -> bytes:
    vlen = TOMBSTONE if value is None else len(value)
    body = struct.pack("<II", len(key), vlen) + key + (value or b"")
    return struct.pack("<I", zlib.crc32(body)) + body


def encode_v2(key: bytes, value: bytes | None, ts: int) -> bytes:
    """M2 TODO: like encode_v1 but with the u64 timestamp right after the crc."""
    raise NotImplementedError


def scan_segment(data: bytes):
    """Yields (record_start, key, value_or_None, value_offset, value_len, ts) for each valid record and
    RETURNS (StopIteration.value) the offset where good data ends.
    M2 TODO: if data starts with MAGIC_V2, skip the header and parse V2_HEADER records instead."""
    pos, hdr = 0, V1_HEADER
    while pos + hdr.size <= len(data):
        crc, klen, vlen = hdr.unpack_from(data, pos)
        ts = 0
        vbytes = 0 if vlen == TOMBSTONE else vlen
        end = pos + hdr.size + klen + vbytes
        if end > len(data) or zlib.crc32(data[pos + 4:end]) != crc:
            break
        key = data[pos + hdr.size: pos + hdr.size + klen]
        voff = pos + hdr.size + klen
        yield pos, key, (None if vlen == TOMBSTONE else data[voff:end]), voff, vbytes, ts
        pos = end
    return pos


class KVStore:
    def __init__(self, directory, max_segment_bytes=1 << 20, sync=False, use_hints=True):
        self.dir = directory
        self.max_segment_bytes = max_segment_bytes
        self.sync = sync
        self.use_hints = use_hints
        os.makedirs(directory, exist_ok=True)
        self.lock = threading.RLock()
        # keydir: key -> (segment_id, value_offset, value_len, timestamp_ms)
        self.keydir: dict[bytes, tuple[int, int, int, int]] = {}
        self.stats = {"segments_scanned": 0, "hints_loaded": 0}
        self.segments = sorted(int(f.split(".")[0]) for f in os.listdir(directory) if f.endswith(".data"))
        for seg in self.segments:
            # M1 TODO: for closed segments that have a hint file, call self._load_hint(seg) instead.
            self._load_segment(seg)
        if not self.segments:
            self.segments = [1]
        # M2 TODO: if the last segment is a non-empty v1 file, start a NEW segment instead of appending to it.
        self.active_id = self.segments[-1]
        self.active = self._open_active(self.active_id)
        self.readers: dict[int, object] = {}
        self._compactor: threading.Thread | None = None

    # ----- paths and files -----
    def _path(self, seg):
        return os.path.join(self.dir, f"{seg:06d}.data")

    def _hint_path(self, seg):
        return os.path.join(self.dir, f"{seg:06d}.hint")

    def _open_active(self, seg):
        f = open(self._path(seg), "ab")
        # M2 TODO: if the file is new (f.tell() == 0), write MAGIC_V2 first.
        return f

    def _reader(self, seg):
        if seg not in self.readers:
            self.readers[seg] = open(self._path(seg), "rb")
        return self.readers[seg]

    # ----- recovery -----
    def _load_segment(self, seg):
        with open(self._path(seg), "rb") as f:
            data = f.read()
        self.stats["segments_scanned"] += 1
        it = scan_segment(data)
        good_end = 0
        while True:
            try:
                start, key, value, voff, vlen, ts = next(it)
            except StopIteration as e:
                good_end = e.value
                break
            if value is None:
                self.keydir.pop(key, None)
            else:
                self.keydir[key] = (seg, voff, vlen, ts)
        if good_end < len(data):
            with open(self._path(seg), "r+b") as f:
                f.truncate(good_end)

    def _write_hint(self, seg):
        """M1 TODO: write the keydir entries that point into `seg`, AND the keys tombstoned in `seg`
        (a later restart must still apply those deletes), to self._hint_path(seg). JSON is fine:
        bytes keys can be stored with .hex(). Write to a temp file and os.replace() it."""
        raise NotImplementedError

    def _load_hint(self, seg):
        """M1 TODO: apply the hint's deletes, then its live entries, to self.keydir.
        Increment self.stats["hints_loaded"]."""
        raise NotImplementedError

    # ----- writing -----
    def _roll_if_needed(self):
        if self.active.tell() >= self.max_segment_bytes:
            self.active.flush()
            os.fsync(self.active.fileno())
            self.active.close()
            closed = self.active_id
            self.active_id += 1
            self.segments.append(self.active_id)
            self.active = self._open_active(self.active_id)
            # M1 TODO: if self.use_hints, write a hint file for `closed`.

    def _append(self, key, value, ts):
        self._roll_if_needed()
        offset = self.active.tell()
        self.active.write(encode_v1(key, value))      # M2 TODO: write encode_v2(key, value, ts)
        return offset

    def put(self, key: bytes, value: bytes) -> None:
        with self.lock:
            ts = int(time.time() * 1000)
            off = self._append(key, value, ts)
            self.active.flush()
            if self.sync:
                os.fsync(self.active.fileno())
            # M2 TODO: the value offset must use V2_HEADER.size once records are v2
            self.keydir[key] = (self.active_id, off + V1_HEADER.size + len(key), len(value), ts)

    def delete(self, key: bytes) -> None:
        with self.lock:
            if key not in self.keydir:
                return
            self._append(key, None, int(time.time() * 1000))
            self.active.flush()
            if self.sync:
                os.fsync(self.active.fileno())
            self.keydir.pop(key, None)

    def write_batch(self, items) -> None:
        """M3 TODO: items is a list of (key, value_or_None). Append them all, then flush and fsync
        ONCE, then update the keydir. When this returns, every write in the batch is durable."""
        raise NotImplementedError

    # ----- reading -----
    def get(self, key: bytes) -> bytes | None:
        with self.lock:
            loc = self.keydir.get(key)
            if loc is None:
                return None
            seg, voff, vlen, _ = loc
            if seg == self.active_id:
                self.active.flush()
            f = self._reader(seg)
            f.seek(voff)
            return f.read(vlen)

    def get_with_timestamp(self, key: bytes):
        """Returns (value, timestamp_ms) or (None, None). Correct once M2 stores real timestamps."""
        with self.lock:
            loc = self.keydir.get(key)
        return (self.get(key), loc[3]) if loc else (None, None)

    # ----- compaction -----
    def compact(self, background=False):
        """M4 TODO: merge all closed segments into one (live values only, keeping timestamps).
        With background=True, run in a threading.Thread and return the started thread.
        Plan: (1) under the lock, snapshot keydir entries pointing into closed segments;
        (2) WITHOUT the lock, copy those values into merge.tmp (v2 format) and fsync it;
        (3) under the lock: close readers, delete old segment and hint files, os.replace the temp
        file to the path of the newest closed segment, update keydir entries that STILL point into
        closed segments, set self.segments, and write a hint for the merged segment."""
        raise NotImplementedError

    def close(self):
        if self._compactor:
            self._compactor.join()
        with self.lock:
            self.active.flush()
            self.active.close()
            for f in self.readers.values():
                f.close()

    def disk_usage(self):
        return sum(os.path.getsize(self._path(s)) for s in self.segments if os.path.exists(self._path(s)))
