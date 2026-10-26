"""Tests for Exercise 42. Run: python practice/42-event-sourcing/test_reservations.py"""
import os
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from reservations import (ConcurrencyConflict, EventStore, Rejected, cancellations_per_show, customer_history,  # noqa: E402
                          decide, evolve, handle, handle_with_retry, new_show, seat_map)

R = lambda seat, c: {"type": "Reserve", "seat": seat, "customer": c}  # noqa: E731
C = lambda seat, c: {"type": "Cancel", "seat": seat, "customer": c}   # noqa: E731


class T1_Decide(unittest.TestCase):
    def test_valid_and_invalid_commands(self):
        s = new_show()
        self.assertEqual(decide(s, R("A1", "ann"))[0]["type"], "SeatReserved")
        s.taken["A1"] = "ann"
        with self.assertRaises(Rejected):
            decide(s, R("A1", "bob"))
        with self.assertRaises(Rejected):
            decide(s, C("A1", "bob"))
        with self.assertRaises(Rejected):
            decide(s, R("Z9", "bob"))


class T2_Evolve(unittest.TestCase):
    def test_replay_derives_state(self):
        store = EventStore()
        for cmd in [R("A1", "ann"), R("A2", "bob"), C("A1", "ann"), R("A1", "cy")]:
            handle(store, "show", cmd)
        self.assertEqual(seat_map(store, "show"), {"A1": "cy", "A2": "bob"})
        self.assertEqual(len(store.events), 4, "a cancellation is a new event; nothing is deleted")

    def test_rejected_commands_leave_no_trace(self):
        store = EventStore()
        handle(store, "show", R("A1", "ann"))
        with self.assertRaises(Rejected):
            handle(store, "show", R("A1", "bob"))
        self.assertEqual(len(store.events), 1)


class T3_Concurrency(unittest.TestCase):
    def test_stale_version_is_rejected(self):
        store = EventStore()
        store.append("show", [{"type": "SeatReserved", "data": {"seat": "A1", "customer": "x"}}], expected_version=0)
        with self.assertRaises(ConcurrencyConflict):
            store.append("show", [{"type": "SeatReserved", "data": {"seat": "A2", "customer": "y"}}], expected_version=0)
        self.assertEqual([e["version"] for e in store.events], [1])

    def test_no_double_booking_under_concurrency(self):
        store = EventStore()
        other = lambda: handle(store, "show", R("A3", "eve"))  # noqa: E731
        with self.assertRaises(Rejected):
            handle_with_retry(store, "show", R("A3", "fay"), read_hook=other)
        self.assertEqual(seat_map(store, "show"), {"A3": "eve"})


class T4_Projections(unittest.TestCase):
    def test_new_projection_from_full_history_and_persistence(self):
        store = EventStore()
        for show in ("hamlet", "lear"):
            for cmd in [R("A1", "ann"), C("A1", "ann"), R("A1", "bob")]:
                handle(store, show, cmd)
        handle(store, "lear", C("A1", "bob"))
        self.assertEqual(cancellations_per_show(store), {"hamlet": 1, "lear": 2})
        self.assertIn("hamlet: ReservationCancelled A1", customer_history(store, "ann"))
        with tempfile.TemporaryDirectory() as d:
            p = os.path.join(d, "events.jsonl")
            store.save(p)
            again = EventStore.load(p)
        self.assertEqual(seat_map(again, "lear"), seat_map(store, "lear"), "state is reproducible from the log")

    def test_evolve_is_deterministic(self):
        events = [{"type": "SeatReserved", "data": {"seat": "A1", "customer": "a"}},
                  {"type": "ReservationCancelled", "data": {"seat": "A1", "customer": "a"}}]
        s1, s2 = new_show(), new_show()
        for e in events:
            s1 = evolve(s1, e)
            s2 = evolve(s2, e)
        self.assertEqual(s1.taken, s2.taken)


if __name__ == "__main__":
    unittest.main(verbosity=2)
