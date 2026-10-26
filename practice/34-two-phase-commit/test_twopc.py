"""Tests for Lab 34. Run: python practice/34-two-phase-commit/test_twopc.py"""
import os
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from twopc import Blocked, Coordinator, Crash, heuristic_abort, make_bank, transfer  # noqa: E402


class Base(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.db1, self.db2 = make_bank(self.tmp.name)
        self.c = Coordinator(self.tmp.name, {"db1": self.db1, "db2": self.db2})

    def tearDown(self):
        self.tmp.cleanup()

    def total(self):
        return self.db1.balances["alice"] + self.db2.balances["bob"]


class T1_Prepare(Base):
    def test_yes_vote_is_durable(self):
        self.db1.write("t", "alice", -10)
        self.assertTrue(self.db1.prepare("t"))
        self.db1.crash()
        self.db1.recover()
        self.assertEqual(self.db1.in_doubt(), ["t"], "a YES vote must survive a crash")

    def test_constraint_violation_votes_no(self):
        self.db1.write("t", "alice", -500)
        self.assertFalse(self.db1.prepare("t"))
        self.assertEqual(self.db1.state["t"], "aborted")
        self.assertNotIn("alice", self.db1.locks)


class T2_Commit(Base):
    def test_transfer(self):
        self.assertEqual(transfer(self.c, "t1", 30), "committed")
        self.assertEqual((self.db1.balances["alice"], self.db2.balances["bob"]), (70, 130))
        self.assertEqual(self.db1.locks, {})
        self.assertEqual(self.db2.locks, {})

    def test_no_vote_aborts_everywhere(self):
        self.assertEqual(transfer(self.c, "t1", 500), "aborted")
        self.assertEqual((self.db1.balances["alice"], self.db2.balances["bob"]), (100, 100))
        self.assertEqual(self.db2.state["t1"], "aborted")


class T3_CoordinatorRecovery(Base):
    def test_crash_after_decision_blocks_then_recovers(self):
        self.c.crash_at = "after_first_commit"
        with self.assertRaises(Crash):
            transfer(self.c, "t1", 30)
        self.assertEqual(self.db2.in_doubt(), ["t1"])
        with self.assertRaises(Blocked):
            self.db2.read("bob")                       # in-doubt locks block other transactions
        self.c.crash_at = None
        self.assertEqual(self.c.recover(), {"t1": "committed"})
        self.assertEqual(self.total(), 200)
        self.assertEqual(self.db2.balances["bob"], 130)

    def test_crash_before_decision_aborts(self):
        self.c.crash_at = "before_decision"
        with self.assertRaises(Crash):
            transfer(self.c, "t1", 30)
        self.assertEqual(sorted(self.db1.in_doubt() + self.db2.in_doubt()), ["t1", "t1"])
        self.c.crash_at = None
        self.assertEqual(self.c.recover(), {"t1": "aborted"})
        self.assertEqual((self.db1.balances["alice"], self.db2.balances["bob"]), (100, 100))
        self.assertEqual(self.db1.locks, {})

    def test_crash_right_after_decision_still_commits(self):
        self.c.crash_at = "after_decision"
        with self.assertRaises(Crash):
            transfer(self.c, "t1", 30)
        self.c.crash_at = None
        self.assertEqual(self.c.recover(), {"t1": "committed"}, "the decision in the log must be enforced")


class T4_ParticipantRecovery(Base):
    def test_in_doubt_survives_participant_restart_with_locks(self):
        self.c.crash_at = "after_first_commit"
        with self.assertRaises(Crash):
            transfer(self.c, "t1", 30)
        self.db2.crash()
        self.db2.recover()
        self.assertEqual(self.db2.in_doubt(), ["t1"])
        self.assertEqual(self.db2.locks.get("bob"), "t1", "a correct 2PC keeps in-doubt locks across reboots")
        self.c.crash_at = None
        self.c.recover()
        self.assertEqual(self.db2.balances["bob"], 130)

    def test_unprepared_work_is_lost_on_crash(self):
        self.db1.write("t", "alice", -10)
        self.db1.crash()
        self.db1.recover()
        self.assertEqual(self.db1.in_doubt(), [])
        self.assertEqual(self.db1.balances["alice"], 100)

    def test_committed_state_survives_restart(self):
        transfer(self.c, "t1", 30)
        self.db1.crash()
        self.db1.recover()
        self.assertEqual(self.db1.balances["alice"], 70)


class T5_Heuristics(Base):
    def test_heuristic_decision_breaks_atomicity(self):
        self.c.crash_at = "after_first_commit"
        with self.assertRaises(Crash):
            transfer(self.c, "t1", 30)
        heuristic_abort(self.db2, "t1")               # an operator "unsticks" db2 without the coordinator
        self.assertNotEqual(self.total(), 200, "money has vanished: db1 committed, db2 aborted")


if __name__ == "__main__":
    unittest.main(verbosity=2)
