"""Reference solution for exercise 25. Run: python practice/_solutions/25-lost-updates/solution.py"""
import importlib.util
import pathlib
import time

spec = importlib.util.spec_from_file_location(
    "counter", pathlib.Path(__file__).resolve().parents[2] / "25-lost-updates" / "counter.py")
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)


def increment_atomic(db):
    db.execute("UPDATE counters SET value = value + 1 WHERE key = 'foo'")


def increment_locked(db):
    db.execute("BEGIN IMMEDIATE")
    try:
        (value,) = db.execute("SELECT value FROM counters WHERE key = 'foo'").fetchone()
        time.sleep(0.0001)
        db.execute("UPDATE counters SET value = ? WHERE key = 'foo'", (value + 1,))
        db.execute("COMMIT")
    except BaseException:
        db.execute("ROLLBACK")
        raise


def increment_cas(db):
    retries = 0
    while True:
        (value,) = db.execute("SELECT value FROM counters WHERE key = 'foo'").fetchone()
        time.sleep(0.0001)
        cur = db.execute("UPDATE counters SET value = ? WHERE key = 'foo' AND value = ?", (value + 1, value))
        if cur.rowcount == 1:
            return retries
        retries += 1


m.increment_atomic, m.increment_locked, m.increment_cas = increment_atomic, increment_locked, increment_cas
src = pathlib.Path(m.__file__).read_text(encoding="utf-8").split('if __name__ == "__main__":', 1)[1]
exec("if True:" + src, vars(m))
