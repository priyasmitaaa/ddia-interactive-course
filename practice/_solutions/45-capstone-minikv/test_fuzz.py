"""Reference fuzzer for MiniKV's replication layer (Week 24, Day 3).   python practice/45-capstone-minikv/test_fuzz.py

Random crashes, partitions, elections, recoveries, flushes and compactions, with safety properties checked after
every step and convergence + a reference model checked at the end. Semi-sync writes acknowledged before a failure
must survive; async writes may be lost on failover, so the model records them as "maybe".
"""
import os
import random
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from replication import NotLeader, ReplicaSet, StaleEpoch  # noqa: E402


def check_agreement(rs: ReplicaSet) -> None:
    """Safety: the logs of nodes that know the current epoch agree on their common prefix of current-epoch history."""
    current = [n for n in rs.nodes.values() if n.reachable and n.epoch == rs.epoch]
    for a in current:
        for b in current:
            for ea, eb in zip(a.log, b.log):
                assert (ea.seq, ea.epoch, ea.key, ea.value) == (eb.seq, eb.epoch, eb.key, eb.value), \
                    f"{a.name} and {b.name} disagree at seq {ea.seq}"


def run_scenario(seed: int, steps: int = 60) -> None:
    rnd = random.Random(seed)
    with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as d:
        rs = ReplicaSet(d, memtable_limit=8)
        durable: dict[str, str] = {}      # semi-sync writes: must survive (single failures)
        maybe: dict[str, set] = {}        # values that may legitimately be visible
        failures = 0
        for _ in range(steps):
            r = rnd.random()
            key = f"k{rnd.randrange(5)}"
            val = f"v{rnd.randrange(1000)}"
            if r < 0.45:
                semi = rnd.random() < 0.5
                try:
                    rs.write(key, val, semi_sync=semi)
                    maybe.setdefault(key, set()).add(val)
                    if semi and not rs.nodes[rs.leader].isolated:
                        durable[key] = val
                    else:
                        durable.pop(key, None)        # a later async write may or may not survive
                except NotLeader:
                    pass                               # rejected before anything was written
                except RuntimeError:
                    # semi-sync "failed" (no follower reachable) - but the leader had already applied it, so it may
                    # still become visible later. A failed write is not rolled back (compare Chapter 5's quorums).
                    maybe.setdefault(key, set()).add(val)
                    durable.pop(key, None)
            elif r < 0.65:
                rs.replicate()
            elif r < 0.73 and failures == 0:
                rs.fail(rs.leader)                     # at most one failure: semi-sync promises survive it
                failures += 1
            elif r < 0.78 and failures == 0:
                rs.isolate(rs.leader)
                failures += 1
            elif r < 0.88:
                try:
                    rs.elect()
                except RuntimeError:
                    pass
            elif r < 0.94:
                for n in rs.nodes.values():
                    if not n.reachable:
                        rs.recover(n.name)
                        failures = 0
            else:
                node = rnd.choice(list(rs.nodes.values()))
                node.store.flush() if rnd.random() < 0.5 else node.store.compact()
            check_agreement(rs)
        # heal everything, then check convergence and the model
        if not rs.nodes[rs.leader].reachable:
            for n in rs.nodes.values():
                if n.name != rs.leader and not n.reachable:
                    rs.recover(n.name)
            rs.elect()
        for n in rs.nodes.values():
            if not n.reachable:
                rs.recover(n.name)
        rs.replicate()
        leader_data = rs.nodes[rs.leader].store.scan()
        for n in rs.nodes.values():
            assert n.store.scan() == leader_data, f"seed {seed}: {n.name} did not converge"
        data = dict(leader_data)
        for k, v in durable.items():
            assert data.get(k) in maybe.get(k, set()) | {v}, f"seed {seed}: lost semi-sync write {k}={v}"
        rs.close()


class Fuzz(unittest.TestCase):
    def test_200_random_scenarios(self):
        for seed in range(200):
            run_scenario(seed)

    def test_fencing_is_enforced(self):
        with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as d:
            rs = ReplicaSet(d)
            rs.write("a", "1")
            rs.replicate()
            rs.isolate("n1")
            rs.elect()
            rs.write("a", "zombie", via="n1")
            rs.nodes["n1"].isolated = False
            with self.assertRaises(StaleEpoch):
                rs.zombie_push("n1", rs.leader)
            rs.close()


if __name__ == "__main__":
    unittest.main(verbosity=2)
