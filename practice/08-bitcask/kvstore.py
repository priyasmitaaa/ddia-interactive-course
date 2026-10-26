"""
Exercise 08 — Build a Bitcask-style log-structured key-value store (book pp. 70-74).

On-disk record format (all integers little-endian unsigned 32-bit):

    crc32 | key_len | value_len | key bytes | value bytes

- value_len == TOMBSTONE (0xFFFFFFFF) means "this key was deleted" (no value bytes follow).
- crc32 is computed over everything AFTER the crc field (key_len .. end of value), so torn
  or corrupted records can be detected during recovery.

The in-memory "keydir" maps each key to where its latest value lives:
    key -> (segment_id, value_offset_in_file, value_len)

Run the tests:  python practice/08-bitcask/test_kvstore.py
"""
import os
import struct
import zlib

HEADER = struct.Struct("<III")  # crc, key_len, value_len  (12 bytes)
TOMBSTONE = 0xFFFFFFFF


def encode_record(key: bytes, value: bytes | None) -> bytes:
    """TODO 1: build crc | key_len | value_len | key | value.
    Hints: body = struct.pack("<II", len(key), vlen) + key + value_bytes
           crc  = zlib.crc32(body);  return struct.pack("<I", crc) + body"""
    raise NotImplementedError


class Bitcask:
    def __init__(self, directory: str, max_segment_bytes: int = 1 << 20, sync: bool = False):
        self.dir = directory
        self.max_segment_bytes = max_segment_bytes
        self.sync = sync                      # if True, fsync after every write (durable but slow)
        os.makedirs(directory, exist_ok=True)
        self.keydir: dict[bytes, tuple[int, int, int]] = {}
        # Segment files are named 000001.data, 000002.data, ... (higher = newer).
        self.segments = sorted(int(f.split(".")[0]) for f in os.listdir(directory) if f.endswith(".data"))
        for seg in self.segments:             # oldest first, so newer records overwrite older ones
            self._load_segment(seg)
        if not self.segments:
            self.segments = [1]
        self.active_id = self.segments[-1]
        self.active = open(self._path(self.active_id), "ab")
        self.readers: dict[int, object] = {}

    # ----- helpers (given) -----
    def _path(self, seg: int) -> str:
        return os.path.join(self.dir, f"{seg:06d}.data")

    def _reader(self, seg: int):
        if seg not in self.readers:
            self.readers[seg] = open(self._path(seg), "rb")
        return self.readers[seg]

    # ----- your work -----
    def _load_segment(self, seg: int) -> None:
        """TODO 4 (crash recovery): read the whole segment file and walk through it record by record.
        For each record: unpack the header, check that the full record fits in the file AND that the
        crc matches. If not, it's a torn/corrupt write: stop, and truncate the file at the end of
        the last good record (so future appends start clean).
        Otherwise update self.keydir (or remove the key for a tombstone)."""
        raise NotImplementedError

    def _append(self, key: bytes, value: bytes | None) -> int:
        """TODO 2: append one encoded record to the active segment and return the offset where the
        RECORD starts. Call self.active.flush() (and os.fsync if self.sync).
        TODO 5 (later): before writing, if self.active.tell() >= self.max_segment_bytes, close the
        active file and start a new segment: active_id + 1, append it to self.segments, open it."""
        raise NotImplementedError

    def put(self, key: bytes, value: bytes) -> None:
        """TODO 2: append, then point keydir[key] at (active_id, offset_of_value, len(value)).
        The value starts HEADER.size + len(key) bytes after the record start."""
        raise NotImplementedError

    def get(self, key: bytes) -> bytes | None:
        """TODO 2: look up keydir; seek to the value offset in that segment (use self._reader(seg));
        read value_len bytes. One seek per read — the whole point of the hash index.
        (If the value is in the active segment, call self.active.flush() first.)"""
        raise NotImplementedError

    def delete(self, key: bytes) -> None:
        """TODO 3: append a tombstone and remove the key from keydir."""
        raise NotImplementedError

    def compact(self) -> None:
        """TODO 6 (stretch): merge all CLOSED segments (all except the active one) into a single new
        segment containing only the latest live value of each key (tombstoned keys vanish).
        Suggested approach: close self.readers; write live records to 'merge.tmp'; fsync it;
        delete the old closed segment files; os.replace the temp file to the path of the newest
        closed segment id; update keydir entries that pointed into closed segments;
        set self.segments = [merged_id, self.active_id]."""
        raise NotImplementedError

    def close(self) -> None:
        self.active.close()
        for f in self.readers.values():
            f.close()

    def disk_usage(self) -> int:
        return sum(os.path.getsize(self._path(s)) for s in self.segments if os.path.exists(self._path(s)))
