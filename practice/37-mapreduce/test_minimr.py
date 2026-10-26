"""Tests for Lab 37. Run: python practice/37-mapreduce/test_minimr.py"""
import os
import sys
import tempfile
import unittest
from collections import Counter

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from minimr import Job, join_events_with_users, split_into, stable_hash, top_urls  # noqa: E402

TEXT = ["the cat sat", "the dog sat", "a cat and a dog", "the end"]


def wordcount(workdir, reducers=3, fail_once=()):
    job = Job(mapper=lambda line: [(w, 1) for w in line.split()], reducer=lambda w, ones: [[w, sum(ones)]],
              num_reducers=reducers, workdir=workdir, fail_once=set(fail_once))
    return job, job.run(split_into(TEXT, 2))


def log_lines(n=300):
    urls = ["/", "/a", "/b", "/c", "/d", "/e", "/f"]
    return [f'1.2.3.4 - - [27/Feb/2015:17:55:11 +0000] "GET {urls[(i * i) % 7 if i % 3 else 0]} HTTP/1.1" 200 1 "-" "x"'
            for i in range(n)]


class Base(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.d = self.tmp.name

    def tearDown(self):
        self.tmp.cleanup()


class T1_Map(Base):
    def test_partitions_are_sorted_and_hash_partitioned(self):
        wordcount(os.path.join(self.d, "wc"))
        for m in range(2):
            for r in range(3):
                with open(os.path.join(self.d, "wc", f"m{m}-r{r}.jsonl"), encoding="utf-8") as f:
                    keys = [line.split('"')[1] for line in f]
                self.assertEqual(keys, sorted(keys), "each partition file must be sorted by key")
                for k in keys:
                    self.assertEqual(stable_hash(k) % 3, r)


class T2_Reduce(Base):
    def test_wordcount(self):
        _, out = wordcount(os.path.join(self.d, "wc"))
        expected = Counter(w for line in TEXT for w in line.split())
        self.assertEqual({w: c for w, c in out}, dict(expected))
        self.assertEqual(len(out), len(expected), "each key reduced exactly once")

    def test_result_independent_of_reducer_count(self):
        results = []
        for r in (1, 2, 5):
            _, out = wordcount(os.path.join(self.d, f"wc{r}"), reducers=r)
            results.append(sorted(map(tuple, out)))
        self.assertEqual(results[0], results[1])
        self.assertEqual(results[0], results[2])


class T3_FaultTolerance(Base):
    def test_failed_attempts_leave_no_trace(self):
        job, out = wordcount(os.path.join(self.d, "wc"), fail_once={"map-0", "reduce-1"})
        expected = Counter(w for line in TEXT for w in line.split())
        self.assertEqual({w: c for w, c in out}, dict(expected), "output as if no faults had occurred")
        self.assertEqual(job.attempts["map-0"], 2)
        self.assertEqual(job.attempts["reduce-1"], 2)
        leftovers = [f for f in os.listdir(os.path.join(self.d, "wc")) if "attempt" in f]
        self.assertEqual(leftovers, [], "partial output of failed attempts must be discarded")


class T4_Workflows(Base):
    def test_two_chained_jobs_find_top_urls(self):
        lines = log_lines()
        expected = Counter(l.split()[6] for l in lines).most_common()
        top = top_urls(lines, 3, os.path.join(self.d, "top"))
        self.assertEqual([u for u, _ in top], [u for u, _ in sorted(expected, key=lambda x: (-x[1], x[0]))[:3]])
        self.assertEqual([c for _, c in top], [c for _, c in sorted(expected, key=lambda x: (-x[1], x[0]))[:3]])


class T5_Join(Base):
    users = [{"id": 103, "dob": 1947}, {"id": 104, "dob": 1989}, {"id": 1000, "dob": 2000}]
    events = [{"user": 104, "url": "/z", "ts": 3}, {"user": 104, "url": "/x", "ts": 1}, {"user": 103, "url": "/q", "ts": 2},
              {"user": 999, "url": "/ghost", "ts": 4}, {"user": 1000, "url": "/k", "ts": 5}, {"user": 104, "url": "/y", "ts": 2}]

    def test_join_matches_nested_loop(self):
        got = join_events_with_users(self.events, self.users, os.path.join(self.d, "j"))
        dob = {u["id"]: u["dob"] for u in self.users}
        expected = sorted([e["url"], 2016 - dob[e["user"]]] for e in self.events if e["user"] in dob)
        self.assertEqual(sorted(got), expected)

    def test_secondary_sort_orders_events_by_timestamp(self):
        got = join_events_with_users(self.events, self.users, os.path.join(self.d, "j2"), reducers=1)
        user104 = [u for u, age in got if age == 27]
        self.assertEqual(user104, ["/x", "/y", "/z"], "user record first, then that user's events in ts order")


if __name__ == "__main__":
    unittest.main(verbosity=2)
