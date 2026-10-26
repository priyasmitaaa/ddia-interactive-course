"""
Reference solution for Project 1: KV store v2.

Builds on the Bitcask store (exercise 08) with:
  M1  hint files       — a closed segment's keydir saved next to it, so restarts don't scan data
  M2  format v2        — records carry a timestamp; segments start with a header naming their format,
                         so v2 code still reads v1 segments (backward compatible, like an Avro file header)
  M3  group commit     — write_batch() makes many writes durable with ONE fsync
  M4  background compaction — merges closed segments in a thread while reads and writes continue

Segment formats
  v1 (no header):  crc32 | key_len | value_len | key | value                  (exercise 08)
  v2 (header b"KV2\\n"): crc32 | timestamp_ms(u64) | key_len | value_len | key | value
crc32 covers everything after the crc field. value_len == TOMBSTONE marks a delete.
"""
import json
import os
import struct
import threading
import time
import zlib

V1_HEADER = struct.Struct("<III")        # crc, klen, vlen
V2_HEADER = struct.Struct("<IQII")       # crc, ts, klen, vlen
MAGIC_V2 = b"KV2\n"
TOMBSTONE = 0xFFFFFFFF


def encode_v2(key: bytes, value: bytes | None, ts: int) -> bytes:
    vlen = TOMBSTONE if value is None else len(value)
    body = struct.pack("<QII", ts, len(key), vlen) + key + (value or b"")
    return struct.pack("<I", zlib.crc32(body)) + body


def encode_v1(key: bytes, value: bytes | None) -> bytes:
    vlen = TOMBSTONE if value is None else len(value)
    body = struct.pack("<II", len(key), vlen) + key + (value or b"")
    return struct.pack("<I", zlib.crc32(body)) + body


def scan_segment(data: bytes):
    """Yield (record_start, key, value_or_None, value_offset, value_len, ts) for every valid record.
    Stops at the first torn or corrupt record. Returns (via StopIteration value) the end of good data."""
    if data.startswith(MAGIC_V2):
        pos, hdr, v2 = len(MAGIC_V2), V2_HEADER, True
    else:
        pos, hdr, v2 = 0, V1_HEADER, False
    while pos + hdr.size <= len(data):
        if v2:
            crc, ts, klen, vlen = hdr.unpack_from(data, pos)
        else:
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
            if self.use_hints and os.path.exists(self._hint_path(seg)) and seg != self.segments[-1]:
                self._load_hint(seg)
            else:
                self._load_segment(seg)
        if not self.segments:
            self.segments = [1]
        elif os.path.getsize(self._path(self.segments[-1])) > 0:
            with open(self._path(self.segments[-1]), "rb") as f:
                if f.read(len(MAGIC_V2)) != MAGIC_V2:
                    # never mix formats in one file: leave the old v1 segment closed, start a v2 one
                    self.segments.append(self.segments[-1] + 1)
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
        if f.tell() == 0:
            f.write(MAGIC_V2)              # new segments are always written in format v2
            f.flush()
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
        good_end = 0 if not data.startswith(MAGIC_V2) else len(MAGIC_V2)
        while True:
            try:
                start, key, value, voff, vlen, ts = next(it)
            except StopIteration as e:
                good_end = e.value if e.value is not None else good_end
                break
            if value is None:
                self.keydir.pop(key, None)
            else:
                self.keydir[key] = (seg, voff, vlen, ts)
        if good_end < len(data):
            with open(self._path(seg), "r+b") as f:
                f.truncate(good_end)

    def _write_hint(self, seg):
        """M1: keydir entries for one closed segment, plus tombstoned keys, as JSON lines."""
        live = {k.hex(): [v[1], v[2], v[3]] for k, v in self.keydir.items() if v[0] == seg}
        with open(self._path(seg), "rb") as f:
            data = f.read()
        dead = sorted({k.hex() for _, k, val, *_ in scan_segment(data) if val is None})
        tmp = self._hint_path(seg) + ".tmp"
        with open(tmp, "w") as f:
            json.dump({"live": live, "deleted": dead}, f)
        os.replace(tmp, self._hint_path(seg))

    def _load_hint(self, seg):
        with open(self._hint_path(seg)) as f:
            h = json.load(f)
        self.stats["hints_loaded"] += 1
        for k in h["deleted"]:
            self.keydir.pop(bytes.fromhex(k), None)
        for k, (voff, vlen, ts) in h["live"].items():
            self.keydir[bytes.fromhex(k)] = (seg, voff, vlen, ts)

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
            if self.use_hints:
                self._write_hint(closed)

    def _append(self, key, value, ts):
        self._roll_if_needed()
        offset = self.active.tell()
        rec = encode_v2(key, value, ts)
        self.active.write(rec)
        return offset

    def _apply(self, key, value, offset, ts):
        if value is None:
            self.keydir.pop(key, None)
        else:
            self.keydir[key] = (self.active_id, offset + V2_HEADER.size + len(key), len(value), ts)

    def put(self, key: bytes, value: bytes) -> None:
        with self.lock:
            ts = int(time.time() * 1000)
            off = self._append(key, value, ts)
            self.active.flush()
            if self.sync:
                os.fsync(self.active.fileno())
            self._apply(key, value, off, ts)

    def delete(self, key: bytes) -> None:
        with self.lock:
            if key not in self.keydir:
                return
            off = self._append(key, None, int(time.time() * 1000))
            self.active.flush()
            if self.sync:
                os.fsync(self.active.fileno())
            self.keydir.pop(key, None)

    def write_batch(self, items) -> None:
        """M3 group commit: append all records, then flush + fsync ONCE. Durable when this returns."""
        with self.lock:
            ts = int(time.time() * 1000)
            applied = []
            for key, value in items:
                off = self._append(key, value, ts)
                applied.append((key, value, off, self.active_id))
            self.active.flush()
            os.fsync(self.active.fileno())
            for key, value, off, seg in applied:
                if value is None:
                    self.keydir.pop(key, None)
                else:
                    self.keydir[key] = (seg, off + V2_HEADER.size + len(key), len(value), ts)

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
        with self.lock:
            loc = self.keydir.get(key)
        return (self.get(key), loc[3]) if loc else (None, None)

    # ----- compaction (M4) -----
    def compact(self, background=False):
        if background:
            self._compactor = threading.Thread(target=self.compact, daemon=True)
            self._compactor.start()
            return self._compactor
        with self.lock:
            closed = [s for s in self.segments if s != self.active_id]
            if len(closed) < 2:
                return None
            snapshot = {k: v for k, v in self.keydir.items() if v[0] in closed}
        merged_id = closed[-1]
        tmp = os.path.join(self.dir, "merge.tmp")
        new_locs = {}
        with open(tmp, "wb") as out:                     # heavy copying happens WITHOUT the lock
            out.write(MAGIC_V2)
            for key, (seg, voff, vlen, ts) in snapshot.items():
                with open(self._path(seg), "rb") as f:
                    f.seek(voff)
                    value = f.read(vlen)
                off = out.tell()
                out.write(encode_v2(key, value, ts))
                new_locs[key] = (merged_id, off + V2_HEADER.size + len(key), vlen, ts)
            out.flush()
            os.fsync(out.fileno())
        with self.lock:                                  # short critical section: swap files and keydir
            for f in self.readers.values():
                f.close()
            self.readers = {}
            for s in closed:
                os.remove(self._path(s))
                if os.path.exists(self._hint_path(s)):
                    os.remove(self._hint_path(s))
            os.replace(tmp, self._path(merged_id))
            for key, loc in new_locs.items():
                cur = self.keydir.get(key)
                if cur is not None and cur[0] in closed:  # not overwritten during compaction
                    self.keydir[key] = loc
            self.segments = [merged_id] + [s for s in self.segments if s not in closed]
            if self.use_hints:
                self._write_hint(merged_id)
        return None

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
