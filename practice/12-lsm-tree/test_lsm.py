"""
Tests for exercise 12. Run from the ddia-course folder:

    python practice/12-lsm-tree/test_lsm.py              # tests YOUR lsm.py
    python practice/12-lsm-tree/test_lsm.py --solution   # tests the reference solution
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
target = (HERE.parent / "_solutions" / "12-lsm-tree" / "lsm.py") if use_solution else (HERE / "lsm.py")
spec = importlib.util.spec_from_file_location("lsm", target)
lsm = importlib.util.module_from_spec(spec)
spec.loader.exec_module(lsm)


class Base(unittest.TestCase):
    def setUp(self):
        self.dir = tempfile.mkdtemp(prefix="lsm-")

    def tearDown(self):
        shutil.rmtree(self.dir, ignore_errors=True)


class T1_Bloom(Base):
    def test_no_false_negatives(self):
        b = lsm.BloomFilter()
        keys = [f"key{i}".encode() for i in range(500)]
        for k in keys:
            b.add(k)
        self.assertTrue(all(b.might_contain(k) for k in keys))

    def test_few_false_positives(self):
        b = lsm.BloomFilter(n_bits=8192, n_hashes=4)
        for i in range(500):
            b.add(f"key{i}".encode())
        fp = sum(b.might_contain(f"other{i}".encode()) for i in range(2000))
        self.assertLess(fp, 40, f"{fp}/2000 false positives is too many for 500 keys in 8192 bits")


class T2_SSTable(Base):
    def test_write_and_get(self):
        items = sorted((f"k{i:05d}".encode(), f"v{i}".encode()) for i in range(300))
        sst = lsm.SSTable.write(os.path.join(self.dir, "t"), items, sparse_every=16)
        self.assertEqual(sst.get(b"k00042"), (True, b"v42"))
        self.assertEqual(sst.get(b"k00299"), (True, b"v299"))
        self.assertEqual(sst.get(b"k00000"), (True, b"v0"))
        self.assertEqual(sst.get(b"nope")[0], False)
        self.assertEqual(len(sst.index_keys), 19, "sparse index: one key every 16 records")

    def test_bloom_avoids_disk_reads(self):
        items = sorted((f"k{i:05d}".encode(), b"x") for i in range(300))
        sst = lsm.SSTable.write(os.path.join(self.dir, "t"), items)
        for i in range(1000):
            sst.get(f"missing{i}".encode())
        self.assertLess(sst.reads, 50, "most lookups of missing keys should be stopped by the Bloom filter")


class T3_Tree(Base):
    def test_put_get_overwrite_delete(self):
        t = lsm.LSMTree(self.dir, memtable_limit=50)
        for i in range(500):
            t.put(f"k{i % 120}".encode(), f"v{i}".encode())
        t.delete(b"k7")
        self.assertGreater(len(t.sstables), 3, "memtable should have been flushed several times")
        self.assertEqual(t.get(b"k5"), b"v485")
        self.assertIsNone(t.get(b"k7"))
        self.assertIsNone(t.get(b"zzz"))
        t.close()

    def test_wal_recovery(self):
        t = lsm.LSMTree(self.dir, memtable_limit=1000)
        t.put(b"only-in-memtable", b"precious")
        t.close()                      # "crash": memtable never flushed
        t = lsm.LSMTree(self.dir, memtable_limit=1000)
        self.assertEqual(t.get(b"only-in-memtable"), b"precious", "the WAL must be replayed on startup")
        t.close()

    def test_sstables_survive_restart(self):
        t = lsm.LSMTree(self.dir, memtable_limit=10)
        for i in range(55):
            t.put(f"k{i}".encode(), str(i).encode())
        t.close()
        t = lsm.LSMTree(self.dir, memtable_limit=10)
        self.assertEqual(t.get(b"k3"), b"3")
        self.assertEqual(t.get(b"k54"), b"54")
        t.close()


class T4_ScanAndCompact(Base):
    def test_range_scan(self):
        t = lsm.LSMTree(self.dir, memtable_limit=30)
        ref = {}
        rand = random.Random(4)
        for i in range(400):
            k = f"kitty{rand.randrange(200):05d}".encode()
            if rand.random() < 0.15:
                t.delete(k); ref.pop(k, None)
            else:
                v = str(i).encode(); t.put(k, v); ref[k] = v
        got = list(t.scan(b"kitty00050", b"kitty00100"))
        exp = sorted((k, v) for k, v in ref.items() if b"kitty00050" <= k < b"kitty00100")
        self.assertEqual(got, exp)
        t.close()

    def test_compaction(self):
        t = lsm.LSMTree(self.dir, memtable_limit=40)
        ref = {}
        rand = random.Random(5)
        for i in range(1000):
            k = f"k{rand.randrange(60)}".encode()
            if rand.random() < 0.1:
                t.delete(k); ref.pop(k, None)
            else:
                v = str(i).encode(); t.put(k, v); ref[k] = v
        t.flush()
        n_before = len(t.sstables)
        t.compact()
        self.assertEqual(len(t.sstables), 1)
        self.assertGreater(n_before, 10)
        for i in range(60):
            k = f"k{i}".encode()
            self.assertEqual(t.get(k), ref.get(k))
        n_entries = sum(1 for _ in t.sstables[0].items())
        self.assertEqual(n_entries, len(ref), "compacted table holds exactly one entry per live key")
        t.close()


if __name__ == "__main__":
    print(f"Testing {target}")
    unittest.main(verbosity=2)
