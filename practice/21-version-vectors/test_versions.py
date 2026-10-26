"""
Tests for exercise 21.
    python practice/21-version-vectors/test_versions.py              # your versions.py
    python practice/21-version-vectors/test_versions.py --solution   # reference
"""
import importlib.util
import pathlib
import sys
import unittest

HERE = pathlib.Path(__file__).resolve().parent
use_solution = "--solution" in sys.argv
if use_solution:
    sys.argv.remove("--solution")
target = (HERE.parent / "_solutions" / "21-version-vectors" / "versions.py") if use_solution else (HERE / "versions.py")
spec = importlib.util.spec_from_file_location("versions", target)
V = importlib.util.module_from_spec(spec)
spec.loader.exec_module(V)


def union(values):
    out = []
    for v in values:
        for item in v:
            if item not in out:
                out.append(item)
    return out


class T1_Figure_5_13(unittest.TestCase):
    def test_shopping_cart(self):
        db = V.SingleReplicaStore()
        # 1. client 1 adds milk (no prior read)
        c1_ver, c1_vals = db.write(["milk"], None)
        self.assertEqual((c1_ver, c1_vals), (1, [["milk"]]))
        # 2. client 2 adds eggs, not knowing about milk
        c2_ver, c2_vals = db.write(["eggs"], None)
        self.assertEqual(c2_ver, 2)
        self.assertEqual(sorted(map(tuple, c2_vals)), [("eggs",), ("milk",)])
        # 3. client 1 adds flour, based on version 1
        c1_ver, c1_vals = db.write(union(c1_vals) + ["flour"], c1_ver)
        self.assertEqual(c1_ver, 3)
        self.assertEqual(sorted(map(tuple, c1_vals)), [("eggs",), ("milk", "flour")])
        # 4. client 2 merges its two siblings and adds ham, based on version 2
        c2_ver, c2_vals = db.write(union(c2_vals) + ["ham"], c2_ver)
        self.assertEqual(c2_ver, 4)
        self.assertEqual(len(c2_vals), 2, "[milk, flour] (v3) is concurrent with this write and must be kept")
        # 5. client 1 adds bacon, based on version 3
        c1_ver, c1_vals = db.write(union(c1_vals) + ["bacon"], c1_ver)
        self.assertEqual(c1_ver, 5)
        self.assertEqual(len(c1_vals), 2)
        merged = set(union(c1_vals))
        self.assertEqual(merged, {"milk", "flour", "eggs", "bacon", "ham"}, "no write was lost")

    def test_write_without_version_overwrites_nothing(self):
        db = V.SingleReplicaStore()
        db.write("a", None)
        _, vals = db.write("b", None)
        self.assertEqual(sorted(vals), ["a", "b"])


class T2_Compare(unittest.TestCase):
    def test_compare(self):
        self.assertEqual(V.compare({"A": 1}, {"A": 2}), "before")
        self.assertEqual(V.compare({"A": 2, "B": 1}, {"A": 1}), "after")
        self.assertEqual(V.compare({"A": 1}, {"B": 1}), "concurrent")
        self.assertEqual(V.compare({"A": 2, "B": 1}, {"A": 1, "B": 2}), "concurrent")
        self.assertEqual(V.compare({"A": 1, "B": 0}, {"A": 1}), "equal")


class T3_MultiReplica(unittest.TestCase):
    def test_concurrent_writes_on_two_replicas_become_siblings(self):
        a, b = V.VVReplica("A"), V.VVReplica("B")
        a.write("x=1", {})
        b.write("x=2", {})                       # concurrent: neither knew about the other
        b.receive(a.siblings)
        _, vals = b.read()
        self.assertEqual(sorted(vals), ["x=1", "x=2"])

    def test_read_from_one_replica_write_to_another(self):
        a, b = V.VVReplica("A"), V.VVReplica("B")
        a.write("v1", {})
        b.receive(a.siblings)
        ctx, vals = a.read()                     # client reads from A ...
        b.write("v2", ctx)                       # ... and writes the update to B
        a.receive(b.siblings)
        self.assertEqual(a.read()[1], ["v2"], "v2 supersedes v1 everywhere: it was based on v1")
        self.assertEqual(b.read()[1], ["v2"])

    def test_no_lost_updates_under_concurrency(self):
        a, b = V.VVReplica("A"), V.VVReplica("B")
        ctx, _ = a.write(["milk"], {})
        b.receive(a.siblings)
        a.write(["milk", "flour"], ctx)          # two clients both based on [milk] ...
        b.write(["milk", "eggs"], ctx)           # ... on different replicas
        a.receive(b.siblings); b.receive(a.siblings)
        self.assertEqual(sorted(map(tuple, a.read()[1])), [("milk", "eggs"), ("milk", "flour")])
        self.assertEqual(sorted(map(tuple, b.read()[1])), sorted(map(tuple, a.read()[1])), "replicas converge")


if __name__ == "__main__":
    print(f"Testing {target}")
    unittest.main(verbosity=2)
