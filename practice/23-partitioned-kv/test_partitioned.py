"""
Tests for exercise 23.
    python practice/23-partitioned-kv/test_partitioned.py              # your partitioned.py
    python practice/23-partitioned-kv/test_partitioned.py --solution   # reference
"""
import importlib.util
import pathlib
import random
import sys
import unittest

HERE = pathlib.Path(__file__).resolve().parent
use_solution = "--solution" in sys.argv
if use_solution:
    sys.argv.remove("--solution")
target = (HERE.parent / "_solutions" / "23-partitioned-kv" / "partitioned.py") if use_solution else (HERE / "partitioned.py")
spec = importlib.util.spec_from_file_location("partitioned", target)
M = importlib.util.module_from_spec(spec)
spec.loader.exec_module(M)

COLORS = ["red", "black", "silver", "blue"]
MAKES = ["Honda", "Ford", "Volvo", "Audi", "Dodge"]


def load(router, n=400, seed=1):
    r = random.Random(seed)
    ref = {}
    for i in range(n):
        car = {"color": r.choice(COLORS), "make": r.choice(MAKES)}
        router.put(f"car:{i}", car)
        ref[f"car:{i}"] = car
    return ref


class T1_PutGet(unittest.TestCase):
    def test_routing_and_ownership(self):
        c = M.Cluster(n_partitions=32, n_nodes=3)
        r = M.Router(c)
        ref = load(r)
        for k, v in ref.items():
            self.assertEqual(r.get(k), v)
        # each record lives on exactly one node: the owner of its partition
        for k in list(ref)[:50]:
            p = c.partition_of(k)
            holders = [n for n in c.nodes.values() if k in n.partitions.get(p, {})]
            self.assertEqual([h.id for h in holders], [c.meta.assignment[p]])

    def test_wrong_node_rejected(self):
        c = M.Cluster(n_partitions=8, n_nodes=2)
        p = 0
        wrong = next(n for n in c.nodes.values() if c.meta.assignment[p] != n.id)
        with self.assertRaises(M.WrongNode):
            wrong.get(p, "x")


class T2_Rebalance(unittest.TestCase):
    def test_add_node_moves_whole_partitions_fairly(self):
        c = M.Cluster(n_partitions=32, n_nodes=3)
        r = M.Router(c)
        ref = load(r)
        before = dict(c.meta.assignment)
        moved = c.add_node()
        self.assertEqual(len(c.nodes), 4)
        changed = [p for p in before if before[p] != c.meta.assignment[p]]
        self.assertEqual(sorted(changed), sorted(moved))
        self.assertTrue(all(c.meta.assignment[p] == "n3" for p in changed), "partitions only move TO the new node")
        counts = {}
        for n in c.meta.assignment.values():
            counts[n] = counts.get(n, 0) + 1
        self.assertLessEqual(max(counts.values()) - min(counts.values()), 1, f"unbalanced: {counts}")
        self.assertGreater(c.meta.epoch, 1, "every assignment change must bump the epoch")
        # a FRESH router sees all data
        fresh = M.Router(c)
        for k, v in ref.items():
            self.assertEqual(fresh.get(k), v)


class T3_StaleRouting(unittest.TestCase):
    def test_old_router_recovers_by_refreshing(self):
        c = M.Cluster(n_partitions=32, n_nodes=3)
        old = M.Router(c)
        ref = load(old)
        c.add_node()                           # old router's cached assignment is now stale
        for k, v in ref.items():
            self.assertEqual(old.get(k), v)
        self.assertGreaterEqual(old.refreshes, 1, "the router must refresh after a WrongNode error")
        self.assertEqual(old.epoch, c.meta.epoch)


class T4_SecondaryIndex(unittest.TestCase):
    def test_scatter_gather(self):
        c = M.Cluster(n_partitions=32, n_nodes=3)
        r = M.Router(c)
        ref = load(r)
        r.put("car:5", {"color": "green", "make": "Audi"})     # update moves car:5 between index entries
        ref["car:5"] = {"color": "green", "make": "Audi"}
        reds, contacted = r.query("color", "red")
        self.assertEqual(set(reds), {k for k, v in ref.items() if v["color"] == "red"})
        self.assertEqual(contacted, 3, "a local (document-partitioned) index needs every node")
        greens, _ = r.query("color", "green")
        self.assertEqual(set(greens), {"car:5"})
        c.add_node()
        reds2, contacted2 = r.query("color", "red")
        self.assertEqual(set(reds2), set(reds), "indexes must move with their partitions")
        self.assertEqual(contacted2, 4)


class T5_HotKey(unittest.TestCase):
    def test_salting_spreads_writes(self):
        c = M.Cluster(n_partitions=32, n_nodes=4)
        keys = M.salted_keys("celebrity:42", 20)
        self.assertEqual(len(set(keys)), 20)
        parts = {c.partition_of(k) for k in keys}
        self.assertGreater(len(parts), 8, "salted sub-keys should land on many partitions")


if __name__ == "__main__":
    print(f"Testing {target}")
    unittest.main(verbosity=2)
