"""
Tests for Project 1. Run from the ddia-course folder:

    python practice/17-project1-kv/test_project1.py              # your kvstore2.py
    python practice/17-project1-kv/test_project1.py --solution   # reference
"""
import importlib.util
import os
import pathlib
import random
import shutil
import struct
import sys
import tempfile
import threading
import time
import unittest
import zlib

HERE = pathlib.Path(__file__).resolve().parent
use_solution = "--solution" in sys.argv
if use_solution:
    sys.argv.remove("--solution")
target = (HERE.parent / "_solutions" / "17-project1-kv" / "kvstore2.py") if use_solution else (HERE / "kvstore2.py")
spec = importlib.util.spec_from_file_location("kvstore2", target)
kv = importlib.util.module_from_spec(spec)
spec.loader.exec_module(kv)


def v1_record(key: bytes, value: bytes | None) -> bytes:
    """The exercise-08 format, written independently here so the test doesn't trust your code."""
    vlen = 0xFFFFFFFF if value is None else len(value)
    body = struct.pack("<II", len(key), vlen) + key + (value or b"")
    return struct.pack("<I", zlib.crc32(body)) + body


class Base(unittest.TestCase):
    def setUp(self):
        self.dir = tempfile.mkdtemp(prefix="p1-")

    def tearDown(self):
        shutil.rmtree(self.dir, ignore_errors=True)

    def fill(self, db, n=3000, keys=300, seed=1):
        rand = random.Random(seed)
        ref = {}
        for i in range(n):
            k = f"key-{rand.randrange(keys)}".encode()
            if rand.random() < 0.05 and k in ref:
                db.delete(k); ref.pop(k)
            else:
                v = f"value-{i}-".encode() * rand.randint(1, 4); db.put(k, v); ref[k] = v
        return ref


class M0_Basics(Base):
    def test_put_get_delete_restart(self):
        db = kv.KVStore(self.dir, max_segment_bytes=4096)
        ref = self.fill(db)
        db.close()
        db = kv.KVStore(self.dir, max_segment_bytes=4096)
        for i in range(300):
            k = f"key-{i}".encode()
            self.assertEqual(db.get(k), ref.get(k))
        db.close()


class M1_HintFiles(Base):
    def test_hint_files_written_for_closed_segments(self):
        db = kv.KVStore(self.dir, max_segment_bytes=4096)
        self.fill(db)
        db.close()
        hints = [f for f in os.listdir(self.dir) if f.endswith(".hint")]
        datas = [f for f in os.listdir(self.dir) if f.endswith(".data")]
        self.assertGreaterEqual(len(hints), len(datas) - 1, "every closed segment should have a hint file")

    def test_restart_uses_hints_and_is_correct(self):
        db = kv.KVStore(self.dir, max_segment_bytes=4096)
        ref = self.fill(db)
        db.close()
        db = kv.KVStore(self.dir, max_segment_bytes=4096)
        self.assertLessEqual(db.stats["segments_scanned"], 1, "only the active segment should be scanned")
        self.assertGreater(db.stats["hints_loaded"], 0)
        for i in range(300):
            k = f"key-{i}".encode()
            self.assertEqual(db.get(k), ref.get(k), f"wrong value for {k} after hint-based restart")
        db.close()


class M2_FormatV2(Base):
    def test_timestamps(self):
        db = kv.KVStore(self.dir)
        before = int(time.time() * 1000)
        db.put(b"k", b"v")
        value, ts = db.get_with_timestamp(b"k")
        self.assertEqual(value, b"v")
        self.assertGreaterEqual(ts, before - 1)
        db.close()
        db = kv.KVStore(self.dir)
        self.assertEqual(db.get_with_timestamp(b"k")[1], ts, "the timestamp must be stored on disk")
        db.close()

    def test_reads_old_v1_segments(self):
        # A store written by the exercise-08 code: one v1 segment, no header.
        with open(os.path.join(self.dir, "000001.data"), "wb") as f:
            f.write(v1_record(b"old", b"from v1") + v1_record(b"gone", b"x") + v1_record(b"gone", None))
        db = kv.KVStore(self.dir)
        self.assertEqual(db.get(b"old"), b"from v1", "v2 code must read v1 data (backward compatibility)")
        self.assertIsNone(db.get(b"gone"))
        db.put(b"new", b"from v2")
        db.close()
        with open(os.path.join(self.dir, "000001.data"), "rb") as f:
            self.assertFalse(f.read().endswith(b"from v2"), "never append v2 records into a v1 file")
        db = kv.KVStore(self.dir)
        self.assertEqual(db.get(b"old"), b"from v1")
        self.assertEqual(db.get(b"new"), b"from v2")
        db.close()


class M3_GroupCommit(Base):
    def test_batch_is_durable_and_correct(self):
        db = kv.KVStore(self.dir)
        db.write_batch([(f"k{i}".encode(), str(i).encode()) for i in range(500)] + [(b"k3", None)])
        self.assertEqual(db.get(b"k499"), b"499")
        self.assertIsNone(db.get(b"k3"))
        db.close()
        db = kv.KVStore(self.dir)
        self.assertEqual(db.get(b"k0"), b"0")
        self.assertIsNone(db.get(b"k3"))
        db.close()

    def test_batch_is_much_faster_than_fsync_per_write(self):
        db = kv.KVStore(self.dir, sync=True)
        t = time.perf_counter()
        for i in range(100):
            db.put(f"a{i}".encode(), b"x" * 50)
        each = time.perf_counter() - t
        t = time.perf_counter()
        db.write_batch([(f"b{i}".encode(), b"x" * 50) for i in range(100)])
        batch = time.perf_counter() - t
        db.close()
        self.assertLess(batch * 3, each, f"100 fsyncs took {each:.3f}s, one batch took {batch:.3f}s")


class M4_BackgroundCompaction(Base):
    def test_compaction_while_writing(self):
        db = kv.KVStore(self.dir, max_segment_bytes=2048)
        ref = self.fill(db, n=4000)
        before = db.disk_usage()
        t = db.compact(background=True)
        rand = random.Random(9)
        for i in range(500):                       # keep writing while compaction runs
            k = f"key-{rand.randrange(300)}".encode()
            v = f"during-{i}".encode(); db.put(k, v); ref[k] = v
        t.join()
        self.assertLess(db.disk_usage(), before)
        for i in range(300):
            k = f"key-{i}".encode()
            self.assertEqual(db.get(k), ref.get(k), f"{k} wrong after concurrent compaction")
        db.close()
        db = kv.KVStore(self.dir, max_segment_bytes=2048)
        for i in range(300):
            k = f"key-{i}".encode()
            self.assertEqual(db.get(k), ref.get(k), f"{k} wrong after restart")
        db.close()


if __name__ == "__main__":
    print(f"Testing {target}")
    unittest.main(verbosity=2)
