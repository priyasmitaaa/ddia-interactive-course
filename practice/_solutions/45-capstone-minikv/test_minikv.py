"""MiniKV capstone tests, one class per milestone. Run all:   python practice/45-capstone-minikv/test_minikv.py
Run one milestone:                                         python practice/45-capstone-minikv/test_minikv.py M1_Encoding
"""
import os
import random
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from encoding import Record, decode_payload, decode_stream, decode_varint, encode_record, encode_varint  # noqa: E402
from storage import LSMStore  # noqa: E402
from replication import NotLeader, ReplicaSet, StaleEpoch  # noqa: E402
from cluster import NUM_PARTITIONS, ChangeConsumer, Cluster, partition_of  # noqa: E402


class Tmp(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(ignore_cleanup_errors=True)  # Windows keeps open WAL files locked
        self.addCleanup(self.tmp.cleanup)
        self.d = self.tmp.name


# ====================================================================== M1: encoding (storage builds on it)
class M1_Encoding(Tmp):
    def test_varint_roundtrip(self):
        for n in [0, 1, 127, 128, 300, 2**31, 2**60]:
            v, pos = decode_varint(encode_varint(n), 0)
            self.assertEqual((v, pos), (n, len(encode_varint(n))))
        self.assertEqual(encode_varint(300), bytes([0xAC, 0x02]), "same bytes as Protocol Buffers (Figure 4-4)")

    def test_record_roundtrip_and_tombstones(self):
        for r in [Record("k", "v"), Record("ключ", "значение"), Record("gone", None), Record("t", "x", ts=1234567)]:
            recs, valid = decode_stream(encode_record(r))
            self.assertEqual(recs[0][1], r)

    def test_v2_reader_reads_v1_data(self):
        old = encode_record(Record("user:1", "Ada"), version=1)
        self.assertEqual(decode_stream(old)[0][0][1], Record("user:1", "Ada"))
        with self.assertRaises(ValueError):
            decode_payload(bytes([9, 0]))

    def test_torn_and_corrupt_tails_are_detected(self):
        good = encode_record(Record("a", "1")) + encode_record(Record("b", "2"))
        torn = good + encode_record(Record("c", "3"))[:-2]
        recs, valid = decode_stream(torn)
        self.assertEqual([r.key for _, r in recs], ["a", "b"])
        self.assertEqual(valid, len(good))
        flipped = bytearray(good)
        flipped[-1] ^= 0xFF
        self.assertEqual(len(decode_stream(bytes(flipped))[0]), 1, "checksum catches the corrupted second record")


class M2_Storage(Tmp):
    def test_put_get_delete_and_flush(self):
        s = LSMStore(self.d, memtable_limit=8)
        for i in range(50):
            s.put(f"k{i:03d}", f"v{i}")
        s.delete("k010")
        s.put("k020", "new")
        self.assertGreater(len(s.sstables), 3)
        self.assertEqual(s.get("k005"), "v5")
        self.assertEqual(s.get("k020"), "new")
        self.assertIsNone(s.get("k010"))
        self.assertIsNone(s.get("nope"))
        s.close()

    def test_crash_recovery_from_wal(self):
        s = LSMStore(self.d, memtable_limit=100)
        s.put("a", "1")
        s.put("b", "2")
        s.delete("a")
        s.wal.close()                                 # "crash": memtable lost, WAL survives
        with open(s.wal_path, "ab") as f:
            f.write(encode_record(Record("c", "3"))[:-3])   # torn last write
        s2 = LSMStore(self.d, memtable_limit=100)
        self.assertEqual((s2.get("a"), s2.get("b"), s2.get("c")), (None, "2", None))
        s2.put("d", "4")
        s2.close()
        self.assertEqual(LSMStore(self.d).get("d"), "4", "the torn tail was truncated, so new writes are readable")

    def test_compaction_keeps_newest_and_drops_tombstones(self):
        s = LSMStore(self.d, memtable_limit=10)
        rnd = random.Random(1)
        model = {}
        for i in range(400):
            k = f"k{rnd.randrange(60)}"
            if rnd.random() < 0.2:
                s.delete(k)
                model.pop(k, None)
            else:
                s.put(k, str(i))
                model[k] = str(i)
        s.flush()
        before = len(s.sstables)
        s.compact()
        self.assertEqual(len(s.sstables), 1)
        self.assertGreater(before, 1)
        self.assertEqual(dict(s.scan()), model)
        self.assertEqual(len([f for f in os.listdir(self.d) if f.endswith(".db")]), 1, "old SSTables deleted")
        s.close()

    def test_sparse_index_reads_one_block(self):
        s = LSMStore(self.d, memtable_limit=1000)
        for i in range(500):
            s.put(f"key{i:04d}", "x" * 50)
        s.flush()
        sst = s.sstables[0]
        self.assertLess(len(sst.index_keys), 500 / 10, "sparse: far fewer index entries than keys")
        self.assertEqual(s.get("key0333"), "x" * 50)
        s.close()


class M3_Replication(Tmp):
    def test_async_followers_lag_then_catch_up(self):
        rs = ReplicaSet(self.d)
        rs.write("x", "1")
        self.assertIsNone(rs.read("x", "n2"), "asynchronous: the follower hasn't pulled yet")
        rs.replicate()
        self.assertEqual(rs.read("x", "n2"), "1")
        self.assertEqual([e.seq for e in rs.nodes["n3"].log], [1])

    def test_only_the_leader_accepts_writes(self):
        rs = ReplicaSet(self.d)
        with self.assertRaises(NotLeader):
            rs.write("x", "1", via="n2")

    def test_semi_sync_reaches_a_follower_before_ack(self):
        rs = ReplicaSet(self.d)
        rs.write("x", "1", semi_sync=True)
        self.assertEqual(sum(1 for n in ("n2", "n3") if rs.read("x", n) == "1"), 1)

    def test_followers_apply_in_order(self):
        rs = ReplicaSet(self.d)
        for i in range(30):
            rs.write(f"k{i % 7}", str(i))
        rs.write("k1", None)
        rs.replicate()
        for n in ("n2", "n3"):
            self.assertEqual(rs.nodes[n].store.scan(), rs.nodes["n1"].store.scan())


class M4_Failover(Tmp):
    def test_failover_elects_most_up_to_date_with_new_epoch(self):
        rs = ReplicaSet(self.d)
        rs.write("a", "1")
        rs.replicate()
        rs.write("b", "2", semi_sync=True)           # reaches one follower only
        rs.fail("n1")
        new = rs.elect()
        self.assertEqual(rs.epoch, 2)
        self.assertEqual(rs.read("b", new), "2", "the follower that has the semi-sync write wins the election")
        rs.write("c", "3")
        rs.replicate()
        self.assertEqual(rs.read("c", "n2" if new == "n3" else "n3"), "3")

    def test_async_acknowledged_writes_can_be_lost(self):
        rs = ReplicaSet(self.d)
        rs.write("a", "1")
        rs.replicate()
        rs.write("b", "2")                           # acknowledged, but never replicated
        rs.fail("n1")
        rs.elect()
        self.assertIsNone(rs.read("b"), "Chapter 5: with async replication, failover can lose acknowledged writes")

    def test_zombie_leader_is_fenced_and_its_writes_discarded(self):
        rs = ReplicaSet(self.d)
        rs.write("a", "1")
        rs.replicate()
        rs.isolate("n1")                             # n1 is cut off but still thinks it leads
        rs.elect()                                   # n2 or n3 becomes leader of epoch 2
        rs.write("x", "new-leader")
        rs.write("a", "zombie", via="n1")            # the zombie happily acknowledges a write!
        rs.nodes["n1"].isolated = False              # network heals
        target = rs.followers()[0] if rs.followers()[0] != "n1" else rs.followers()[1]
        with self.assertRaises(StaleEpoch):
            rs.zombie_push("n1", target)
        discarded = rs.recover("n1")
        self.assertEqual(discarded, 1)
        self.assertEqual(rs.read("a", "n1"), "1")
        self.assertEqual(rs.read("x", "n1"), "new-leader")
        self.assertFalse(rs.nodes["n1"].believes_leader)

    def test_no_election_without_a_majority(self):
        rs = ReplicaSet(self.d)
        rs.fail("n1")
        rs.fail("n2")
        with self.assertRaises(RuntimeError):
            rs.elect()


class M5_Partitioning(Tmp):
    def test_routing_and_rebalancing_move_only_whole_partitions(self):
        c = Cluster(self.d)
        keys = [f"user{i}" for i in range(300)]
        for k in keys:
            c.put(k, k.upper())
        before = {k: c.group_of(k) for k in keys}
        moved = c.add_group("g3")
        self.assertEqual(c.partitions_per_group()["g3"], NUM_PARTITIONS // 3)
        self.assertTrue(all(c.get(k) == k.upper() for k in keys), "every key still readable after rebalancing")
        changed = [k for k in keys if c.group_of(k) != before[k]]
        self.assertTrue(all(partition_of(k) in moved for k in changed))
        naive_moved = sum(1 for i, k in enumerate(keys) if (hash(k) % 2) != (hash(k) % 3))
        self.assertLess(len(changed), naive_moved, "far fewer keys move than with hash mod N")

    def test_partitions_are_balanced(self):
        c = Cluster(self.d, groups=("a", "b"))
        c.add_group("c")
        c.add_group("d")
        counts = c.partitions_per_group().values()
        self.assertLessEqual(max(counts) - min(counts), 1)


class M6_ChangeStream(Tmp):
    def test_derived_index_follows_writes_and_deletes(self):
        c = Cluster(self.d)
        cons = ChangeConsumer(c)
        for i in range(40):
            c.put(f"u{i}", "DE" if i % 3 else "IN")
        cons.poll()
        self.assertEqual(len(cons.lookup("IN")), 14)
        c.put("u0", "FR")                    # u0 was IN
        c.delete("u3")                       # u3 was IN
        cons.poll()
        self.assertEqual(len(cons.lookup("IN")), 12)
        self.assertEqual(cons.lookup("FR"), {"u0"})

    def test_redelivery_is_harmless(self):
        c = Cluster(self.d)
        cons = ChangeConsumer(c)
        for i in range(20):
            c.put(f"u{i}", "x")
        self.assertEqual(cons.poll(), 20)
        self.assertEqual(cons.poll(), 0)
        cons.offsets.clear()                 # simulate losing offsets: everything is redelivered
        cons.poll()
        self.assertEqual(len(cons.lookup("x")), 20)


if __name__ == "__main__":
    unittest.main(verbosity=2)
