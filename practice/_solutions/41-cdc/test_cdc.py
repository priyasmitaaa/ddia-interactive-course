"""Tests for Exercise 41. Run: python practice/41-cdc/test_cdc.py"""
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cdc import (CdcConsumer, SearchIndex, bootstrap_new_index, compact, db_contents, dual_write_partial_failure,  # noqa: E402
                 dual_write_race, install_cdc_triggers, new_db, workload)


class T0_DualWrites(unittest.TestCase):
    def test_dual_writes_diverge(self):
        db, idx = dual_write_race()
        self.assertNotEqual(db, idx)
        db, idx = dual_write_partial_failure()
        self.assertNotEqual(db, idx)


class T1_Triggers(unittest.TestCase):
    def test_every_change_is_logged_in_order(self):
        conn = new_db()
        install_cdc_triggers(conn)
        conn.execute("INSERT INTO products VALUES (1, 'lamp', 'red')")
        conn.execute("UPDATE products SET description = 'blue' WHERE id = 1")
        conn.execute("DELETE FROM products WHERE id = 1")
        rows = conn.execute("SELECT op, id, name, description FROM changelog ORDER BY seq").fetchall()
        self.assertEqual(rows, [("upsert", 1, "lamp", "red"), ("upsert", 1, "lamp", "blue"), ("delete", 1, None, None)])

    def test_rolled_back_writes_are_not_logged(self):
        conn = new_db()
        install_cdc_triggers(conn)
        conn.execute("BEGIN")
        conn.execute("INSERT INTO products VALUES (1, 'lamp', 'red')")
        conn.execute("ROLLBACK")
        self.assertEqual(conn.execute("SELECT COUNT(*) FROM changelog").fetchone()[0], 0,
                         "the changelog entry is part of the same transaction")


class T2_Consumer(unittest.TestCase):
    def test_index_converges_to_database(self):
        conn = new_db()
        install_cdc_triggers(conn)
        c = CdcConsumer(conn, SearchIndex())
        for _ in range(3):
            workload(conn, 100)
            c.poll()
            self.assertEqual(c.index.docs, db_contents(conn))

    def test_poll_is_incremental(self):
        conn = new_db()
        install_cdc_triggers(conn)
        c = CdcConsumer(conn, SearchIndex())
        conn.execute("INSERT INTO products VALUES (1, 'lamp', 'red')")
        self.assertEqual(c.poll(), 1)
        self.assertEqual(c.poll(), 0)
        self.assertEqual(c.index.search("red"), {1})


class T3_Compaction(unittest.TestCase):
    def test_compacted_log_rebuilds_the_same_state(self):
        conn = new_db()
        install_cdc_triggers(conn)
        workload(conn, 300)
        rows = conn.execute("SELECT seq, op, id, name, description FROM changelog ORDER BY seq").fetchall()
        c = compact(rows)
        self.assertLess(len(c), len(rows))
        self.assertEqual(len({r[2] for r in c}), len(c), "one entry per key")
        self.assertTrue(all(r[1] == "upsert" for r in c), "tombstoned keys are dropped")
        idx = SearchIndex()
        for _, _, pid, name, desc in c:
            idx.put(pid, f"{name} {desc}")
        self.assertEqual(idx.docs, db_contents(conn))


class T4_Bootstrap(unittest.TestCase):
    def test_snapshot_plus_catch_up_after_truncation(self):
        conn = new_db()
        install_cdc_triggers(conn)
        workload(conn, 200)
        conn.execute("DELETE FROM changelog")             # history is gone
        late = bootstrap_new_index(conn)
        self.assertEqual(late.index.docs, db_contents(conn))
        workload(conn, 80)
        late.poll()
        self.assertEqual(late.index.docs, db_contents(conn))


if __name__ == "__main__":
    unittest.main(verbosity=2)
