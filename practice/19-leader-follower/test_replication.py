"""
Tests for exercise 19.
    python practice/19-leader-follower/test_replication.py              # your replication.py
    python practice/19-leader-follower/test_replication.py --solution   # reference
"""
import importlib.util
import pathlib
import sys
import unittest

HERE = pathlib.Path(__file__).resolve().parent
use_solution = "--solution" in sys.argv
if use_solution:
    sys.argv.remove("--solution")
target = (HERE.parent / "_solutions" / "19-leader-follower" / "replication.py") if use_solution else (HERE / "replication.py")
spec = importlib.util.spec_from_file_location("replication", target)
R = importlib.util.module_from_spec(spec)
spec.loader.exec_module(R)


def cluster(delays=(5, 50, 400), sync=()):
    sim = R.Sim()
    net = R.Network(sim)
    f1 = R.Follower("f1", net, "leader")
    f2 = R.Follower("f2", net, "leader")
    leader = R.Leader("leader", net, ["f1", "f2"], sync_followers=sync)
    net.add("leader", leader, delays[0]); net.add("f1", f1, delays[1]); net.add("f2", f2, delays[2])
    return sim, net, leader, f1, f2


class T1_Async(unittest.TestCase):
    def test_followers_receive_all_writes_in_order(self):
        sim, net, leader, f1, f2 = cluster()
        acks = []
        for i in range(10):
            leader.write(f"k{i % 3}", i, lambda lsn: acks.append((lsn, sim.now)))
        sim.run()
        self.assertEqual(f1.log, leader.log)
        self.assertEqual(f2.log, leader.log)
        self.assertEqual(f1.data, leader.data)
        self.assertEqual(len(acks), 10)
        self.assertTrue(all(t == 0 for _, t in acks), "async: the client is acknowledged immediately")


class T2_Sync(unittest.TestCase):
    def test_ack_waits_for_sync_follower(self):
        sim, net, leader, f1, f2 = cluster(sync=("f1",))
        acks = []
        leader.write("x", 1, lambda lsn: acks.append(sim.now))
        sim.run(until=1)
        self.assertEqual(acks, [], "must not acknowledge before the synchronous follower confirms")
        sim.run()
        self.assertEqual(len(acks), 1)
        self.assertGreater(acks[0], 100, "ack needs a round trip to f1 (~110 ms with these delays)")
        self.assertLess(acks[0], 400, "ack must NOT wait for the async follower f2")

    def test_sync_follower_down_blocks_writes(self):
        sim, net, leader, f1, f2 = cluster(sync=("f1",))
        net.up["f1"] = False
        acks = []
        leader.write("x", 1, lambda lsn: acks.append(sim.now))
        sim.run()
        self.assertEqual(acks, [], "with the synchronous follower down, the write cannot be acknowledged")


class T3_CatchUp(unittest.TestCase):
    def test_follower_catches_up_after_outage(self):
        sim, net, leader, f1, f2 = cluster()
        for i in range(3):
            leader.write(f"k{i}", i, lambda lsn: None)
        sim.run()
        net.up["f2"] = False
        for i in range(3, 8):
            leader.write(f"k{i}", i, lambda lsn: None)
        sim.run()
        self.assertEqual(len(f2.log), 3)
        net.up["f2"] = True
        f2.reconnect()
        sim.run()
        self.assertEqual(f2.log, leader.log, "after reconnecting, f2 must request and apply what it missed")


class T4_ReadYourWrites(unittest.TestCase):
    def test_stale_read_and_fix(self):
        sim, net, leader, f1, f2 = cluster(delays=(5, 50, 2000))
        client = R.Client(leader, [f1, f2])
        leader.write("comment", "old", lambda lsn: None)
        sim.run()
        client.write("comment", "Sounds good!")
        sim.run(until=sim.now + 100)                     # f2 hasn't received it yet
        self.assertEqual(client.read("comment", f2)[0], "old", "a plain read from a lagging follower is stale")
        value, served_by = client.read("comment", f2, read_your_writes=True)
        self.assertEqual(value, "Sounds good!")
        self.assertEqual(served_by, "leader")
        sim.run()
        self.assertEqual(client.read("comment", f2, read_your_writes=True), ("Sounds good!", "f2"),
                         "once the follower has caught up, it can serve the read itself")


class T5_Failover(unittest.TestCase):
    def test_async_failover_loses_acknowledged_writes(self):
        sim, net, leader, f1, f2 = cluster(delays=(5, 50, 400))
        acked = []
        for i in range(5):
            leader.write(f"k{i}", i, lambda lsn, i=i: acked.append((f"k{i}", i)))
            sim.run(until=sim.now + 30)                 # writes arrive faster than f2 can keep up
        net.up["leader"] = False                        # crash before replication completes
        sim.run()
        new, lost = R.failover([f1, f2], acked)
        self.assertIs(new, f1, "promote the most up-to-date follower")
        self.assertEqual(len(acked), 5)
        self.assertGreater(len(lost), 0, "async replication: some acknowledged writes are lost")
        self.assertEqual(set(lost), set(acked) - set(f1.log))

    def test_sync_follower_failover_loses_nothing(self):
        sim, net, leader, f1, f2 = cluster(delays=(5, 50, 400), sync=("f1",))
        acked = []
        for i in range(5):
            leader.write(f"k{i}", i, lambda lsn, i=i: acked.append((f"k{i}", i)))
            sim.run(until=sim.now + 30)
        net.up["leader"] = False
        sim.run()
        new, lost = R.failover([f1, f2], acked)
        self.assertEqual(lost, [], "every acknowledged write is on the synchronous follower")


if __name__ == "__main__":
    print(f"Testing {target}")
    unittest.main(verbosity=2)
