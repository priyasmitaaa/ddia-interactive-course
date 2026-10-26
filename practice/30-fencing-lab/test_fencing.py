"""Tests for Lab 30. Run: python practice/30-fencing-lab/test_fencing.py"""
import os
import sys
import time
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from fencing import (BrokenTokenService, LockService, Request, Storage, check_safety,  # noqa: E402
                     figure_8_4, stress_tokens)


class T1_LockService(unittest.TestCase):
    def test_grant_and_exclusion(self):
        ls = LockService(0.2)
        a = ls.acquire("a")
        self.assertIsNotNone(a)
        self.assertEqual(a.token, 33)
        self.assertIsNone(ls.acquire("b"), "b must not get a lease that a still holds")

    def test_renewal_keeps_token(self):
        ls = LockService(0.2)
        a1 = ls.acquire("a")
        a2 = ls.acquire("a")
        self.assertEqual(a1.token, a2.token)
        self.assertGreaterEqual(a2.expires_at, a1.expires_at)

    def test_expiry_gives_larger_token(self):
        ls = LockService(0.1)
        a = ls.acquire("a")
        time.sleep(0.15)
        b = ls.acquire("b")
        self.assertIsNotNone(b, "an expired lease must be grantable")
        self.assertGreater(b.token, a.token)


class T2_Storage(unittest.TestCase):
    def test_without_fencing_accepts_everything(self):
        s = Storage(fencing=False)
        self.assertTrue(s.write("c2", 34, "x"))
        self.assertTrue(s.write("c1", 33, "y"))
        self.assertTrue(s.corrupted())

    def test_with_fencing_rejects_older_token(self):
        s = Storage(fencing=True)
        self.assertTrue(s.write("c2", 34, "x"))
        self.assertFalse(s.write("c1", 33, "y"))
        self.assertTrue(s.write("c2", 34, "z"), "the same token may write repeatedly")
        self.assertFalse(s.corrupted())


class T3_Figures(unittest.TestCase):
    def test_figure_8_4_corrupts(self):
        st = figure_8_4(fencing=False)
        self.assertEqual([c for c, _, _ in st.accepted], ["client2", "client1"])
        self.assertTrue(st.corrupted())

    def test_figure_8_5_fences(self):
        st = figure_8_4(fencing=True)
        self.assertEqual([(c, t) for c, t, _ in st.accepted], [("client2", 34)])
        self.assertEqual([(c, t) for c, t, _ in st.rejected], [("client1", 33)])


class T4_Safety(unittest.TestCase):
    def test_checker_finds_violations(self):
        h = [Request("a", 0, 1, 5), Request("b", 2, 3, 5)]
        self.assertTrue(any("uniqueness" in p for p in check_safety(h)))
        h = [Request("a", 0, 1, 7), Request("b", 2, 3, 6)]
        self.assertTrue(any("monotonic" in p for p in check_safety(h)))
        h = [Request("a", 0, 2, 7), Request("b", 1, 3, 6)]   # overlapping: any order is allowed
        self.assertEqual(check_safety(h), [])

    def test_lock_service_is_safe_under_concurrency(self):
        ls = LockService(0.0)              # every acquire is a fresh grant
        history = stress_tokens(lambda c: ls.acquire(c).token)
        self.assertEqual(len(history), 500)
        self.assertEqual(check_safety(history), [])

    def test_two_counters_break_uniqueness(self):
        broken = BrokenTokenService()
        problems = check_safety(stress_tokens(broken.acquire, n_threads=4, per_thread=10))
        self.assertTrue(problems)


if __name__ == "__main__":
    unittest.main(verbosity=2)
