"""Tests for Lab 35. Run: python practice/35-leader-election/test_election.py"""
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from election import (Config, Node, election_safety_violations, fuzz, handle_heartbeat,  # noqa: E402
                      handle_request_vote, start_election)

CFG = Config()


class T1_RequestVote(unittest.TestCase):
    def test_refuses_older_term(self):
        v = Node(1, term=5)
        self.assertFalse(handle_request_vote(v, 4, 0, 0, 0, CFG))

    def test_one_vote_per_term(self):
        v = Node(1, term=3)
        self.assertTrue(handle_request_vote(v, 3, 0, 0, 0, CFG))
        self.assertFalse(handle_request_vote(v, 3, 2, 0, 0, CFG), "already voted for node 0 in term 3")
        self.assertTrue(handle_request_vote(v, 3, 0, 0, 0, CFG), "repeating the vote for the same node is fine")

    def test_newer_term_resets_vote_and_steps_down(self):
        v = Node(1, term=3, voted_for=0, role="leader")
        self.assertTrue(handle_request_vote(v, 4, 2, 0, 0, CFG))
        self.assertEqual((v.term, v.voted_for, v.role), (4, 2, "follower"))

    def test_log_must_be_up_to_date(self):
        v = Node(1, term=3, log=[1, 2, 3])
        self.assertFalse(handle_request_vote(v, 4, 0, 2, 5, CFG), "candidate's last term is older")
        self.assertFalse(handle_request_vote(Node(1, term=3, log=[1, 2, 3]), 4, 0, 3, 2, CFG), "same last term, shorter log")
        self.assertTrue(handle_request_vote(Node(1, term=3, log=[1, 2, 3]), 4, 0, 3, 3, CFG))


class T2_Election(unittest.TestCase):
    def test_majority_wins(self):
        nodes = [Node(i) for i in range(5)]
        self.assertTrue(start_election(nodes[0], nodes, lambda a, b: True, CFG))
        self.assertEqual((nodes[0].role, nodes[0].term), ("leader", 1))

    def test_minority_partition_cannot_elect(self):
        nodes = [Node(i) for i in range(5)]
        side = {0, 1}
        reach = lambda a, b: (a in side) == (b in side)
        self.assertFalse(start_election(nodes[0], nodes, reach, CFG))
        self.assertEqual(nodes[0].role, "candidate")
        self.assertTrue(start_election(nodes[2], nodes, reach, CFG), "3 of 5 is a majority")


class T3_Heartbeat(unittest.TestCase):
    def test_stale_leader_rejected(self):
        f = Node(1, term=7)
        self.assertFalse(handle_heartbeat(f, 6))
        self.assertEqual(f.term, 7)

    def test_current_leader_accepted(self):
        f = Node(1, term=6, role="candidate")
        self.assertTrue(handle_heartbeat(f, 7))
        self.assertEqual((f.term, f.role), (7, "follower"))


class T4_Safety(unittest.TestCase):
    def test_checker(self):
        self.assertEqual(election_safety_violations([(1, 0), (2, 3), (2, 3), (3, 1)]), [])
        self.assertEqual(election_safety_violations([(1, 0), (2, 3), (2, 4)]), [2])

    def test_correct_protocol_is_safe_under_fuzzing(self):
        elections, _ = fuzz(Config())
        self.assertGreater(len(elections), 1000, "the fuzzer should produce plenty of elections")
        self.assertEqual(election_safety_violations(elections), [])

    def test_bugs_are_caught(self):
        self.assertTrue(election_safety_violations(fuzz(Config(allow_double_vote=True))[0]))
        self.assertTrue(election_safety_violations(fuzz(Config(n=4, half_is_majority=True))[0]))


if __name__ == "__main__":
    unittest.main(verbosity=2)
