"""Tests for Lab 31. Run: python practice/31-linearizability-checker/test_linearizability.py"""
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from linearizability import Op, check_recorded, figure_9_4, linearize, step  # noqa: E402


def fig92(a_mid, b_first, b_second):
    return [
        Op("A", "read", 2, 16, value=0), Op("A", "read", 34, 48, value=a_mid), Op("A", "read", 76, 92, value=1),
        Op("B", "read", 22, 40, value=b_first), Op("B", "read", 52, 66, value=b_second),
        Op("C", "write", 28, 72, value=1),
    ]


class T1_Step(unittest.TestCase):
    def test_semantics(self):
        self.assertEqual(step(Op("c", "write", 0, 1, value=5), 0), 5)
        self.assertEqual(step(Op("c", "read", 0, 1, value=5), 5), 5)
        self.assertIsNone(step(Op("c", "read", 0, 1, value=4), 5))
        self.assertEqual(step(Op("c", "cas", 0, 1, old=5, new=6, ok=True), 5), 6)
        self.assertIsNone(step(Op("c", "cas", 0, 1, old=5, new=6, ok=True), 4))
        self.assertEqual(step(Op("c", "cas", 0, 1, old=5, new=6, ok=False), 4), 4)
        self.assertIsNone(step(Op("c", "cas", 0, 1, old=5, new=6, ok=False), 5))


class T2_Figure_9_2(unittest.TestCase):
    def test_concurrent_reads_may_return_either(self):
        self.assertIsNotNone(linearize(fig92(0, 0, 1)))
        self.assertIsNotNone(linearize(fig92(1, 1, 1)))
        self.assertIsNotNone(linearize(fig92(0, 1, 1)))

    def test_no_flip_back(self):
        self.assertIsNone(linearize(fig92(1, 0, 0)), "A read 1, then B (starting later) read 0")
        self.assertIsNone(linearize(fig92(0, 1, 0)), "B read 1 then 0")

    def test_order_respects_real_time(self):
        order = linearize(fig92(0, 0, 1))
        first_read = order.index(next(o for o in order if o.client == "A" and o.start == 2))
        write = order.index(next(o for o in order if o.kind == "write"))
        self.assertLess(first_read, write, "A's first read finished before the write started")


class T3_Figure_9_4(unittest.TestCase):
    def test_shaded_read(self):
        self.assertIsNone(linearize(figure_9_4(2)))
        self.assertIsNotNone(linearize(figure_9_4(4)))

    def test_failed_cas_is_checked(self):
        h = figure_9_4(4)
        h[6] = Op("D", "cas", 55, 68, old=0, new=3, ok=True)   # pretend D's cas succeeded
        self.assertIsNone(linearize(h))


class T4_Figure_9_6(unittest.TestCase):
    def test_quorum_race(self):
        h = [Op("W", "write", 5, 95, value=1), Op("A", "read", 20, 40, value=1), Op("B", "read", 50, 70, value=0)]
        self.assertIsNone(linearize(h))


class T5_Recorded(unittest.TestCase):
    def test_leader_reads_are_linearizable(self):
        total, bad = check_recorded(from_followers=False)
        self.assertGreater(total, 5)
        self.assertEqual(bad, 0)

    def test_follower_reads_are_not(self):
        total, bad = check_recorded(from_followers=True)
        self.assertGreater(bad, 0)


if __name__ == "__main__":
    unittest.main(verbosity=2)
