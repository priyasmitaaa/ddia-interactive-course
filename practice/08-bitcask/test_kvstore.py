"""
Tests for exercise 08. Run from the ddia-course folder:

    python practice/08-bitcask/test_kvstore.py              # tests YOUR kvstore.py
    python practice/08-bitcask/test_kvstore.py --solution   # tests the reference solution

Tests are ordered roughly in the order you'll implement things.
"""
import importlib.util
import os
import pathlib
import random
import shutil
import sys
import tempfile
import unittest

HERE = pathlib.Path(__file__).resolve().parent
use_solution = "--solution" in sys.argv
if use_solution:
    sys.argv.remove("--solution")
target = (HERE.parent / "_solutions" / "08-bitcask" / "kvstore.py") if use_solution else (HERE / "kvstore.py")
spec = importlib.util.spec_from_file_location("kvstore", target)
kv = importlib.util.module_from_spec(spec)
spec.loader.exec_module(kv)


class Base(unittest.TestCase):
    def setUp(self):
        self.dir = tempfile.mkdtemp(prefix="bitcask-")

    def tearDown(self):
        shutil.rmtree(self.dir, ignore_errors=True)

    def open(self, **kw):
        return kv.Bitcask(self.dir, **kw)


class T1_Encoding(Base):
    def test_record_layout(self):
        rec = kv.encode_record(b"cat", b"meow")
        self.assertEqual(len(rec), 12 + 3 + 4)
        self.assertEqual(rec[12:15], b"cat")
        self.assertEqual(rec[15:], b"meow")

    def test_tombstone_has_no_value_bytes(self):
        rec = kv.encode_record(b"cat", None)
        self.assertEqual(len(rec), 12 + 3)


class T2_PutGet(Base):
    def test_put_then_get(self):
        db = self.open()
        db.put(b"42", b'{"name":"San Francisco"}')
        db.put(b"123456", b'{"name":"London"}')
        self.assertEqual(db.get(b"42"), b'{"name":"San Francisco"}')
        self.assertEqual(db.get(b"123456"), b'{"name":"London"}')
        self.assertIsNone(db.get(b"nope"))
        db.close()

    def test_overwrite_returns_latest(self):
        db = self.open()
        for i in range(100):
            db.put(b"mew", str(1078 + i).encode())
        self.assertEqual(db.get(b"mew"), b"1177")
        db.close()

    def test_append_only(self):
        db = self.open()
        db.put(b"k", b"v1")
        size1 = db.disk_usage()
        db.put(b"k", b"v2")
        self.assertGreater(db.disk_usage(), size1, "overwriting must APPEND, not modify in place")
        db.close()


class T3_Delete(Base):
    def test_delete(self):
        db = self.open()
        db.put(b"k", b"v")
        db.delete(b"k")
        self.assertIsNone(db.get(b"k"))
        db.close()


class T4_Recovery(Base):
    def test_reopen_rebuilds_keydir(self):
        db = self.open()
        db.put(b"a", b"1"); db.put(b"b", b"2"); db.put(b"a", b"3"); db.delete(b"b")
        db.close()
        db = self.open()
        self.assertEqual(db.get(b"a"), b"3")
        self.assertIsNone(db.get(b"b"), "a deleted key must stay deleted after restart")
        db.close()

    def test_torn_write_is_ignored(self):
        db = self.open()
        db.put(b"good", b"value")
        db.put(b"torn", b"x" * 100)
        db.close()
        # Simulate a crash halfway through writing the last record: chop off its tail.
        seg = sorted(f for f in os.listdir(self.dir) if f.endswith(".data"))[-1]
        path = os.path.join(self.dir, seg)
        with open(path, "r+b") as f:
            f.truncate(os.path.getsize(path) - 30)
        db = self.open()
        self.assertEqual(db.get(b"good"), b"value")
        self.assertIsNone(db.get(b"torn"), "a partially written record must be detected (CRC/length) and ignored")
        db.put(b"after", b"crash")   # the store must remain writable after recovery
        db.close()
        db = self.open()
        self.assertEqual(db.get(b"after"), b"crash")
        db.close()

    def test_corruption_detected_by_checksum(self):
        db = self.open()
        db.put(b"k", b"hello world")
        db.close()
        seg = sorted(f for f in os.listdir(self.dir) if f.endswith(".data"))[-1]
        path = os.path.join(self.dir, seg)
        with open(path, "r+b") as f:
            f.seek(-3, 2)
            f.write(b"XYZ")   # flip some value bytes, length still valid
        db = self.open()
        self.assertIsNone(db.get(b"k"), "a record with a bad CRC must be ignored")
        db.close()


class T5_SegmentsAndCompaction(Base):
    def test_segments_roll_over(self):
        db = self.open(max_segment_bytes=200)
        for i in range(50):
            db.put(f"key{i % 5}".encode(), f"value-{i}".encode())
        files = [f for f in os.listdir(self.dir) if f.endswith(".data")]
        self.assertGreater(len(files), 2, "with a 200-byte limit, writes must roll over into new segment files")
        for i in range(5):
            self.assertEqual(db.get(f"key{i}".encode()), f"value-{45 + i}".encode())
        db.close()

    def test_compaction_shrinks_and_preserves_data(self):
        db = self.open(max_segment_bytes=300)
        rand = random.Random(1)
        expected = {}
        for i in range(400):
            k = f"cat-video-{rand.randrange(10)}".encode()
            if rand.random() < 0.1 and k in expected:
                db.delete(k); expected.pop(k)
            else:
                v = str(i).encode(); db.put(k, v); expected[k] = v
        before = db.disk_usage()
        db.compact()
        after = db.disk_usage()
        self.assertLess(after, before / 3, f"compaction should drop obsolete records ({before} -> {after} bytes)")
        for k in [f"cat-video-{i}".encode() for i in range(10)]:
            self.assertEqual(db.get(k), expected.get(k))
        db.close()
        db = self.open(max_segment_bytes=300)   # and it must survive a restart
        for k in [f"cat-video-{i}".encode() for i in range(10)]:
            self.assertEqual(db.get(k), expected.get(k))
        db.close()


if __name__ == "__main__":
    print(f"Testing {target}")
    unittest.main(verbosity=2)
