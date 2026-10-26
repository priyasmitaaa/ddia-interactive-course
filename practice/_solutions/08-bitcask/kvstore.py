"""
Reference solution for exercise 08: a Bitcask-style log-structured key-value store.

On-disk record format (all integers little-endian unsigned 32-bit):
    crc32 | key_len | value_len | key bytes | value bytes
value_len == TOMBSTONE means "this key was deleted" (no value bytes follow).
The CRC covers everything after the crc field, so torn or corrupted records are detected.
"""
import os
import struct
import zlib

HEADER = struct.Struct("<III")  # crc, key_len, value_len
TOMBSTONE = 0xFFFFFFFF


def encode_record(key: bytes, value: bytes | None) -> bytes:
    vlen = TOMBSTONE if value is None else len(value)
    body = struct.pack("<II", len(key), vlen) + key + (value or b"")
    return struct.pack("<I", zlib.crc32(body)) + body


class Bitcask:
    def __init__(self, directory: str, max_segment_bytes: int = 1 << 20, sync: bool = False):
        self.dir = directory
        self.max_segment_bytes = max_segment_bytes
        self.sync = sync
        os.makedirs(directory, exist_ok=True)
        # keydir: key -> (segment_id, value_offset, value_len)
        self.keydir: dict[bytes, tuple[int, int, int]] = {}
        self.segments = sorted(int(f.split(".")[0]) for f in os.listdir(directory) if f.endswith(".data"))
        for seg in self.segments:
            self._load_segment(seg)
        if not self.segments:
            self.segments = [1]
        self.active_id = self.segments[-1]
        self.active = open(self._path(self.active_id), "ab")
        self.readers: dict[int, object] = {}

    # ----- helpers -----
    def _path(self, seg: int) -> str:
        return os.path.join(self.dir, f"{seg:06d}.data")

    def _reader(self, seg: int):
        if seg not in self.readers:
            self.readers[seg] = open(self._path(seg), "rb")
        return self.readers[seg]

    def _load_segment(self, seg: int) -> None:
        """Crash recovery: scan the segment, rebuild keydir, stop at the first torn/corrupt record."""
        path = self._path(seg)
        with open(path, "rb") as f:
            data = f.read()
        pos = 0
        good_end = 0
        while pos + HEADER.size <= len(data):
            crc, klen, vlen = HEADER.unpack_from(data, pos)
            vbytes = 0 if vlen == TOMBSTONE else vlen
            end = pos + HEADER.size + klen + vbytes
            if end > len(data) or zlib.crc32(data[pos + 4:end]) != crc:
                break  # partially written (or corrupted) record: ignore it and everything after
            key = data[pos + HEADER.size: pos + HEADER.size + klen]
            if vlen == TOMBSTONE:
                self.keydir.pop(key, None)
            else:
                self.keydir[key] = (seg, pos + HEADER.size + klen, vlen)
            pos = end
            good_end = end
        if good_end < len(data):
            with open(path, "r+b") as f:  # chop off the torn tail so new appends start clean
                f.truncate(good_end)

    def _append(self, key: bytes, value: bytes | None) -> int:
        if self.active.tell() >= self.max_segment_bytes:
            self.active.close()
            self.active_id += 1
            self.segments.append(self.active_id)
            self.active = open(self._path(self.active_id), "ab")
        rec = encode_record(key, value)
        offset = self.active.tell()
        self.active.write(rec)
        self.active.flush()
        if self.sync:
            os.fsync(self.active.fileno())
        return offset

    # ----- public API -----
    def put(self, key: bytes, value: bytes) -> None:
        offset = self._append(key, value)
        self.keydir[key] = (self.active_id, offset + HEADER.size + len(key), len(value))

    def get(self, key: bytes) -> bytes | None:
        loc = self.keydir.get(key)
        if loc is None:
            return None
        seg, voff, vlen = loc
        if seg == self.active_id:
            self.active.flush()
        f = self._reader(seg)
        f.seek(voff)
        return f.read(vlen)

    def delete(self, key: bytes) -> None:
        if key in self.keydir:
            self._append(key, None)
            del self.keydir[key]

    def compact(self) -> None:
        """Merge all closed segments into one new segment holding only live values."""
        closed = [s for s in self.segments if s != self.active_id]
        if not closed:
            return
        for f in self.readers.values():
            f.close()
        self.readers = {}
        # New merged segment gets an id below the active one by renaming via a temp file.
        merged_id = closed[-1]
        tmp = os.path.join(self.dir, "merge.tmp")
        new_locs = {}
        with open(tmp, "wb") as out:
            for key, (seg, voff, vlen) in self.keydir.items():
                if seg == self.active_id:
                    continue
                with open(self._path(seg), "rb") as f:
                    f.seek(voff)
                    value = f.read(vlen)
                off = out.tell()
                out.write(encode_record(key, value))
                new_locs[key] = (merged_id, off + HEADER.size + len(key), vlen)
            out.flush()
            os.fsync(out.fileno())
        for s in closed:
            os.remove(self._path(s))
        os.replace(tmp, self._path(merged_id))
        self.keydir.update(new_locs)
        self.segments = [merged_id, self.active_id]

    def close(self) -> None:
        self.active.close()
        for f in self.readers.values():
            f.close()

    def disk_usage(self) -> int:
        return sum(os.path.getsize(self._path(s)) for s in self.segments if os.path.exists(self._path(s)))
