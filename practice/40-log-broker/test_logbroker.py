"""Tests for Exercise 40. Run: python practice/40-log-broker/test_logbroker.py"""
import os
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from logbroker import SEGMENT_SIZE, Broker, Consumer, OffsetOutOfRange  # noqa: E402


class Base(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.b = Broker(self.tmp.name, partitions=3)

    def tearDown(self):
        self.tmp.cleanup()

    def fill(self, n=40):
        for i in range(n):
            self.b.append(f"user{i % 7}", {"i": i})


class T1_Append(Base):
    def test_offsets_increase_per_partition_and_segments_roll(self):
        self.fill()
        for p in range(3):
            msgs = self.b.read(p, 0, 1000)
            self.assertEqual([m["offset"] for m in msgs], list(range(len(msgs))))
            segs = self.b.segments(p)
            self.assertEqual(segs, list(range(0, len(msgs), SEGMENT_SIZE)), "segments named by their first offset")

    def test_same_key_same_partition_in_order(self):
        self.fill()
        p = self.b.partition_for("user3")
        mine = [m["value"]["i"] for m in self.b.read(p, 0, 1000) if m["key"] == "user3"]
        self.assertEqual(mine, sorted(mine))
        self.assertEqual(len(mine), len([i for i in range(40) if i % 7 == 3]))


class T2_Read(Base):
    def test_read_from_middle(self):
        self.fill()
        p = 0
        all_msgs = self.b.read(p, 0, 1000)
        self.assertEqual(self.b.read(p, 5, 3), all_msgs[5:8])
        self.assertEqual(self.b.read(p, len(all_msgs), 10), [], "end of log")


class T3_Offsets(Base):
    def test_consumer_resumes_from_committed_offset(self):
        self.fill()
        c = Consumer(self.b, "g", [0, 1, 2])
        first = c.poll(2)
        c.commit()
        second_consumer = Consumer(self.b, "g", [0, 1, 2])        # e.g. after a restart
        nxt = second_consumer.poll(2)
        self.assertFalse({(m["partition"], m["offset"]) for m in first} & {(m["partition"], m["offset"]) for m in nxt})

    def test_crash_before_commit_reprocesses(self):
        self.fill()
        c = Consumer(self.b, "g", [0])
        a = c.poll(3)                    # processed, but no commit: crash!
        again = Consumer(self.b, "g", [0]).poll(3)
        self.assertEqual(a, again, "messages after the last commit are processed a second time")

    def test_groups_are_independent_fan_out(self):
        self.fill()
        a = Consumer(self.b, "search-indexer", [1]).poll(100)
        b = Consumer(self.b, "analytics", [1]).poll(100)
        self.assertEqual(a, b)


class T4_Retention(Base):
    def test_retention_deletes_whole_segments_and_lagging_consumers_get_an_error(self):
        self.fill(60)
        deleted = self.b.apply_retention(keep_segments=2)
        self.assertGreater(deleted, 0)
        for p in range(3):
            self.assertLessEqual(len(self.b.segments(p)), 2)
            self.assertGreaterEqual(self.b.end_offset(p), 1, "offsets are never reused")
        with self.assertRaises(OffsetOutOfRange):
            self.b.read(0, 0)
        oldest = self.b.segments(0)[0]
        self.assertEqual(self.b.read(0, oldest, 1)[0]["offset"], oldest)


if __name__ == "__main__":
    unittest.main(verbosity=2)
