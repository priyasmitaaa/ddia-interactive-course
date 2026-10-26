"""MiniKV end-to-end demo: run it once all milestones pass.   python practice/45-capstone-minikv/demo.py"""
import os
import sys
import tempfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cluster import NUM_PARTITIONS, ChangeConsumer, Cluster, partition_of  # noqa: E402

with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as d:
    c = Cluster(d)
    cdc = ChangeConsumer(c)
    countries = ["DE", "IN", "US", "BR"]
    for i in range(200):
        c.put(f"user{i}", countries[i % 4])
    c.replicate_all()
    print(f"1. wrote 200 users across {NUM_PARTITIONS} partitions; partitions per group: {c.partitions_per_group()}")

    cdc.poll()
    print(f"2. change stream -> derived index: {len(cdc.lookup('IN'))} users in IN")

    p = partition_of("user7")
    rs = c.partitions[p]
    old = rs.leader
    rs.write("user7", "FR")                    # acknowledged...
    rs.fail(old)                               # ...then the leader dies before replicating it
    new = rs.elect()
    print(f"3. partition {p}: leader {old} failed, {new} elected for epoch {rs.epoch}; user7 = {c.get('user7')} "
          f"(the un-replicated write to FR was lost - async replication)")
    rs.recover(old)
    print(f"   {old} rejoined as a follower; it now agrees: user7 = {rs.read('user7', old)}")

    moved = c.add_group("g3")
    print(f"4. added group g3: moved partitions {moved}; per group now {c.partitions_per_group()}; "
          f"all keys readable: {all(c.get(f'user{i}') is not None for i in range(200))}")

    c.delete("user0")
    c.put("user1", "IN")
    cdc.poll()
    print(f"5. after more writes the derived index has {len(cdc.lookup('IN'))} users in IN, user0 indexed: "
          f"{'user0' in cdc.current}")
    c.close()
