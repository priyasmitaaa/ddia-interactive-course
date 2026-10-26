"""Tests for Lab 44. Run: python practice/44-exactly-once/test_processor.py"""
import os
import random
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from processor import Processor, expected_balances, make_log, run_with_crashes  # noqa: E402


def lines(path):
    with open(path, encoding="utf-8") as f:
        return f.read().splitlines()


class Base(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)      # registered first, so it runs last (after the databases are closed)
        self.log = os.path.join(self.tmp.name, "payments.log")
        self.events = make_log(self.log)

    def run_mode(self, mode, crashes, **kw):
        p = run_with_crashes(self.tmp.name, self.log, mode, crashes, **kw)
        self.addCleanup(p.db.close)
        return p


class T0_AtLeastOnce(Base):
    def test_crashes_cause_double_counting(self):
        p = self.run_mode("at_least_once", [23, 40, 17])
        self.assertGreater(sum(p.balances().values()), sum(e["amount"] for e in self.events))


class T1_Idempotent(Base):
    def test_correct_despite_replays(self):
        p = self.run_mode("idempotent", [23, 40, 17, 61])
        self.assertEqual(p.balances(), expected_balances(self.events))

    def test_many_random_crash_schedules(self):
        rnd = random.Random(1)
        for trial in range(5):
            with tempfile.TemporaryDirectory() as d:
                log = os.path.join(d, "p.log")
                ev = make_log(log, seed=trial)
                p = run_with_crashes(d, log, "idempotent", [rnd.randrange(1, 60) for _ in range(4)])
                self.assertEqual(p.balances(), expected_balances(ev))
                p.db.close()


class T2_Transactional(Base):
    def test_correct_despite_crashes(self):
        p = self.run_mode("transactional", [1, 23, 40, 17, 61])
        self.assertEqual(p.balances(), expected_balances(self.events))

    def test_offset_lives_with_the_state(self):
        p = self.run_mode("transactional", [30])
        self.assertEqual(p.db.execute("SELECT next_offset FROM progress").fetchone()[0], len(self.events))
        self.assertFalse(os.path.exists(os.path.join(self.tmp.name, "consumer-offset.txt")),
                         "no separate offset file: state and offset commit together")


class T3_Notifications(Base):
    def test_one_email_per_large_payment(self):
        p = self.run_mode("transactional", [23, 40, 17], notify=True)
        emails = lines(p.notifications_path)
        self.assertEqual(len(emails), len([e for e in self.events if e["amount"] >= 500]))

    def test_repeated_notify_is_deduplicated(self):
        p = Processor(self.tmp.name, self.log)
        self.addCleanup(p.db.close)
        e = {"offset": 99, "account": "acct1", "amount": 500}
        p.notify(e)
        p.notify(e)                       # e.g. replayed after a crash
        self.assertEqual(len(lines(p.notifications_path)), 1)


if __name__ == "__main__":
    unittest.main(verbosity=2)
