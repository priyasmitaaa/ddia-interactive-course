"""
Tests for exercise 26.
    python practice/26-mvcc-ssi/test_mvcc.py              # your mvcc.py
    python practice/26-mvcc-ssi/test_mvcc.py --solution   # reference
"""
import importlib.util
import pathlib
import sys
import unittest

HERE = pathlib.Path(__file__).resolve().parent
use_solution = "--solution" in sys.argv
if use_solution:
    sys.argv.remove("--solution")
target = (HERE.parent / "_solutions" / "26-mvcc-ssi" / "mvcc.py") if use_solution else (HERE / "mvcc.py")
spec = importlib.util.spec_from_file_location("mvcc", target)
M = importlib.util.module_from_spec(spec)
spec.loader.exec_module(M)


def bank(serializable=False):
    db = M.Database(serializable=serializable)
    db.load({"account1": 500, "account2": 500})
    return db


class T1_Basics(unittest.TestCase):
    def test_own_writes_and_commit(self):
        db = bank()
        t = db.begin()
        t.write("account1", 600)
        self.assertEqual(t.read("account1"), 600, "a transaction sees its own writes")
        t.commit()
        self.assertEqual(db.begin().read("account1"), 600)

    def test_abort_discards_writes(self):
        db = bank()
        t = db.begin()
        t.write("account1", 0)
        t.abort()
        self.assertEqual(db.begin().read("account1"), 500)


class T2_NoDirtyReads(unittest.TestCase):
    def test_uncommitted_writes_invisible(self):
        db = bank()
        w = db.begin()
        w.write("account1", 999)
        r = db.begin()
        self.assertEqual(r.read("account1"), 500, "dirty read!")
        w.commit()
        self.assertEqual(r.read("account1"), 500, "still the snapshot: w was in progress when r started")
        self.assertEqual(db.begin().read("account1"), 999)


class T3_SnapshotPreventsReadSkew(unittest.TestCase):
    def test_figure_7_6(self):
        db = bank()
        alice = db.begin()
        a1 = alice.read("account1")
        transfer = db.begin()
        transfer.write("account1", transfer.read("account1") + 100)
        transfer.write("account2", transfer.read("account2") - 100)
        transfer.commit()
        a2 = alice.read("account2")
        self.assertEqual(a1 + a2, 1000, "Alice must see a consistent snapshot")
        alice.commit()                                   # read-only: never aborts

    def test_aborted_writes_invisible_later(self):
        db = bank()
        t = db.begin(); t.write("account2", 1); t.abort()
        self.assertEqual(db.begin().read("account2"), 500)


class T4_LostUpdates(unittest.TestCase):
    def test_first_committer_wins(self):
        db = M.Database()
        db.load({"counter": 42})
        a, b = db.begin(), db.begin()
        x, y = a.read("counter"), b.read("counter")
        a.write("counter", x + 1)
        b.write("counter", y + 1)
        a.commit()
        with self.assertRaises(M.SerializationFailure):
            b.commit()
        self.assertEqual(db.begin().read("counter"), 43)


def doctors(serializable):
    db = M.Database(serializable=serializable)
    db.load({"doctor:alice": True, "doctor:bob": True, "doctor:carol": False})
    return db


def go_off_call(tx, name):
    on_call = [k for k, v in tx.scan("doctor:").items() if v]
    if len(on_call) >= 2:
        tx.write(f"doctor:{name}", False)


class T5_WriteSkew(unittest.TestCase):
    def test_snapshot_isolation_allows_write_skew(self):
        db = doctors(serializable=False)
        a, b = db.begin(), db.begin()
        go_off_call(a, "alice"); go_off_call(b, "bob")
        a.commit(); b.commit()                            # both succeed: the anomaly of Figure 7-8
        on = [k for k, v in db.begin().scan("doctor:").items() if v]
        self.assertEqual(on, [], "under plain SI, write skew is NOT prevented")

    def test_ssi_prevents_write_skew(self):
        db = doctors(serializable=True)
        a, b = db.begin(), db.begin()
        go_off_call(a, "alice"); go_off_call(b, "bob")
        a.commit()
        with self.assertRaises(M.SerializationFailure):
            b.commit()
        # retry b: now it sees only one doctor on call and does nothing
        b2 = db.begin(); go_off_call(b2, "bob"); b2.commit()
        on = [k for k, v in db.begin().scan("doctor:").items() if v]
        self.assertEqual(on, ["doctor:bob"])

    def test_ssi_prevents_phantom_double_booking(self):
        db = M.Database(serializable=True)
        a, b = db.begin(), db.begin()
        for t, who in ((a, "A"), (b, "B")):
            if not t.scan("booking:123:noon"):
                t.write(f"booking:123:noon:{who}", who)
        a.commit()
        with self.assertRaises(M.SerializationFailure):
            b.commit()

    def test_ssi_read_only_never_aborts(self):
        db = doctors(serializable=True)
        reader, writer = db.begin(), db.begin()
        reader.scan("doctor:")
        writer.write("doctor:carol", True)
        writer.commit()
        reader.commit()                                   # must not raise


if __name__ == "__main__":
    print(f"Testing {target}")
    unittest.main(verbosity=2)
