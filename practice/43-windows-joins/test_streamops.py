"""Tests for Exercise 43. Run: python practice/43-windows-joins/test_streamops.py"""
import os
import random
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from streamops import (batch_click_through, batch_counts, enrich_as_of, enrich_naive, make_events,  # noqa: E402
                       make_profile_changes, make_search_clicks, search_click_join, sessionize, tumbling_counts)


class T1_Windows(unittest.TestCase):
    def test_enough_lateness_equals_batch(self):
        evs = make_events()
        emitted, dropped, _ = tumbling_counts(evs, lateness=2000)
        self.assertEqual(dropped, 0)
        self.assertEqual(emitted, batch_counts(evs))

    def test_small_lateness_drops_stragglers_and_corrections_fix_it(self):
        evs = make_events()
        emitted, dropped, _ = tumbling_counts(evs, lateness=5)
        truth = batch_counts(evs)
        self.assertGreater(dropped, 0)
        self.assertEqual(sum(emitted.values()) + dropped, len(evs), "every event either counted or dropped")
        em2, _, corr = tumbling_counts(evs, lateness=5, corrections=True)
        self.assertEqual(em2, truth)
        self.assertEqual(len(corr), dropped)

    def test_no_late_events_no_drops(self):
        evs = make_events(late_fraction=0.0)
        _, dropped, _ = tumbling_counts(evs, lateness=6)
        self.assertEqual(dropped, 0)


class T2_Sessions(unittest.TestCase):
    def test_sessions_cover_every_event_and_respect_the_gap(self):
        evs = make_events()
        s = sessionize(evs, gap=30)
        self.assertEqual(sum(c for v in s.values() for _, _, c in v), len(evs))
        for sessions in s.values():
            for (a0, a1, _), (b0, _, _) in zip(sessions, sessions[1:]):
                self.assertLessEqual(a0, a1)
                self.assertGreater(b0 - a1, 30, "consecutive sessions are separated by more than the gap")

    def test_arrival_order_does_not_matter(self):
        evs = make_events()
        shuffled = evs[:]
        random.Random(1).shuffle(shuffled)
        self.assertEqual(sessionize(evs), sessionize(shuffled))


class T3_StreamStreamJoin(unittest.TestCase):
    def test_matches_batch_even_when_clicks_arrive_first(self):
        sc = make_search_clicks()
        self.assertTrue(any(c["arrival"] < s["arrival"] for c in sc if c["kind"] == "click"
                            for s in sc if s["kind"] == "search" and s["session"] == c["session"]),
                        "the test data must contain at least one click that arrives before its search")
        self.assertEqual(search_click_join(sc), batch_click_through(sc))

    def test_window_bound(self):
        sc = make_search_clicks()
        self.assertTrue(all(dt <= 3600 for _, dt in search_click_join(sc)))
        self.assertLess(len(search_click_join(sc, window=60)), len(search_click_join(sc)))


class T4_StreamTableJoin(unittest.TestCase):
    def test_as_of_join_is_deterministic_and_differs_from_arrival_order(self):
        evs, pc = make_events(), make_profile_changes()
        a = enrich_as_of(evs, pc)
        b = enrich_as_of(list(reversed(evs)), list(reversed(pc)))
        self.assertEqual(a, b, "the as-of join doesn't depend on arrival order")
        self.assertNotEqual(a, enrich_naive(evs, pc), "the arrival-order join gives different answers")


if __name__ == "__main__":
    unittest.main(verbosity=2)
