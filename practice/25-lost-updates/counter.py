"""
Exercise 25 — Lost updates, for real (book pp. 233-236, Figure 7-1).

8 threads, each with its own database connection, increment the same counter 200 times.
The correct final value is 1600.

Run:  python practice/25-lost-updates/counter.py
"""
import os
import sqlite3
import tempfile
import threading
import time

THREADS, INCREMENTS = 8, 200


def new_db():
    path = os.path.join(tempfile.mkdtemp(), "counter.db")
    db = sqlite3.connect(path)
    db.execute("CREATE TABLE counters (key TEXT PRIMARY KEY, value INT)")
    db.execute("INSERT INTO counters VALUES ('foo', 0)")
    db.commit()
    db.close()
    return path


def connect(path):
    # autocommit mode; wait up to 10 s if another connection holds the write lock
    return sqlite3.connect(path, isolation_level=None, timeout=10)


# ---------------------------------------------------------------------------
# Version 0 (given): read-modify-write in application code. The tiny sleep stands for the
# application doing some work between the read and the write (and makes the race likely).
# ---------------------------------------------------------------------------
def increment_naive(db):
    (value,) = db.execute("SELECT value FROM counters WHERE key = 'foo'").fetchone()
    time.sleep(0.0001)
    db.execute("UPDATE counters SET value = ? WHERE key = 'foo'", (value + 1,))


# ---------------------------------------------------------------------------
# TASK 1: atomic write operation — let the database do the read-modify-write (p. 234).
# ---------------------------------------------------------------------------
def increment_atomic(db):
    raise NotImplementedError


# ---------------------------------------------------------------------------
# TASK 2: explicit locking — keep the read-modify-write in Python, but take the lock first.
# SQLite has no SELECT ... FOR UPDATE; instead "BEGIN IMMEDIATE" acquires the database's write
# lock at the start of the transaction. Read, sleep, write, COMMIT.
# ---------------------------------------------------------------------------
def increment_locked(db):
    raise NotImplementedError


# ---------------------------------------------------------------------------
# TASK 3: compare-and-set (p. 236) — no lock: write only if the value is still what you read,
# i.e. UPDATE ... SET value = new WHERE key = 'foo' AND value = old. If no row was updated
# (cursor.rowcount == 0), someone else got there first: re-read and try again.
# Return the number of retries so we can see how much contention there was.
# ---------------------------------------------------------------------------
def increment_cas(db):
    raise NotImplementedError


def run(name, fn):
    path = new_db()
    retries = [0]

    def worker():
        db = connect(path)
        for _ in range(INCREMENTS):
            r = fn(db)
            if isinstance(r, int):
                retries[0] += r
        db.close()

    t0 = time.perf_counter()
    ts = [threading.Thread(target=worker) for _ in range(THREADS)]
    for t in ts:
        t.start()
    for t in ts:
        t.join()
    secs = time.perf_counter() - t0
    (value,) = connect(path).execute("SELECT value FROM counters").fetchone()
    lost = THREADS * INCREMENTS - value
    extra = f", {retries[0]} CAS retries" if retries[0] else ""
    print(f"{name:<22} final={value:<5} lost updates={lost:<5} time={secs:5.2f}s{extra}")


if __name__ == "__main__":
    print(f"{THREADS} threads x {INCREMENTS} increments: correct final value = {THREADS * INCREMENTS}\n")
    for name, fn in [("read-modify-write", increment_naive), ("atomic UPDATE", increment_atomic),
                     ("explicit lock", increment_locked), ("compare-and-set", increment_cas)]:
        try:
            run(name, fn)
        except NotImplementedError:
            print(f"{name:<22} not implemented yet")
