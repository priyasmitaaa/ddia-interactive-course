"""
Exercise 18 — Statement-based vs logical (row-based) replication (book pp. 152-155).

A "leader" and a "follower" are two separate SQLite databases. We replicate a workload two ways
and check whether the follower ends up identical to the leader.

Run:  python practice/18-replication-logs/replog.py
"""
import random
import sqlite3

SCHEMA = """
CREATE TABLE tickets (id INTEGER PRIMARY KEY AUTOINCREMENT, owner TEXT, prize INTEGER, status TEXT);
"""

# The workload: plain SQL statements as clients would send them to the leader.
WORKLOAD = [
    "INSERT INTO tickets (owner, prize, status) VALUES ('ana', abs(random()) % 100, 'new')",
    "INSERT INTO tickets (owner, prize, status) VALUES ('bo',  abs(random()) % 100, 'new')",
    "INSERT INTO tickets (owner, prize, status) VALUES ('cy',  abs(random()) % 100, 'new')",
    # depends on existing data AND on the (unspecified) order in which rows are visited:
    "UPDATE tickets SET status = 'winner' WHERE id = (SELECT id FROM tickets ORDER BY prize DESC LIMIT 1)",
    "DELETE FROM tickets WHERE prize < 20",
]


def new_db():
    db = sqlite3.connect(":memory:")
    db.executescript(SCHEMA)
    return db


def dump(db):
    return db.execute("SELECT id, owner, prize, status FROM tickets ORDER BY id").fetchall()


# ---------------------------------------------------------------------------
# Approach 1 (given): statement-based replication.
# The leader executes each statement and ships the SQL text; the follower re-executes it.
# ---------------------------------------------------------------------------
def statement_based(seed):
    random.seed(seed)
    leader, follower = new_db(), new_db()
    for sql in WORKLOAD:
        leader.execute(sql)
        follower.execute(sql)          # same statement, re-executed: random() runs again!
    return dump(leader), dump(follower)


# ---------------------------------------------------------------------------
# Approach 2 (YOUR TASK): logical (row-based) replication.
# The leader executes the statement, then describes the EFFECT as row-level changes:
#   ("insert", row)  ("update", id, row)  ("delete", id)       where row = (id, owner, prize, status)
# The follower applies those changes. It never runs the original SQL.
# ---------------------------------------------------------------------------
def capture_changes(before: list[tuple], after: list[tuple]) -> list[tuple]:
    """TASK 1: compare the table contents before and after one statement (lists of rows with id
    first) and return the row-level change records. Hint: build dicts keyed by id."""
    raise NotImplementedError


def apply_changes(db, changes: list[tuple]) -> None:
    """TASK 2: apply change records to the follower database."""
    raise NotImplementedError


def logical(seed):
    random.seed(seed)
    leader, follower = new_db(), new_db()
    log = []
    for sql in WORKLOAD:
        before = dump(leader)
        leader.execute(sql)
        changes = capture_changes(before, dump(leader))
        log.extend(changes)
        apply_changes(follower, changes)
    return dump(leader), dump(follower), log


if __name__ == "__main__":
    diverged = 0
    for seed in range(20):
        lead, fol = statement_based(seed)
        diverged += lead != fol
    print(f"statement-based: follower diverged from leader in {diverged}/20 runs")
    lead, fol = statement_based(0)
    print("  e.g. leader  :", lead)
    print("       follower:", fol)
    try:
        bad = 0
        for seed in range(20):
            lead, fol, log = logical(seed)
            bad += lead != fol
        print(f"\nlogical (row-based): follower diverged in {bad}/20 runs")
        print("  replication log of the last run:")
        for rec in log:
            print("   ", rec)
    except NotImplementedError:
        print("\nlogical replication: not implemented yet")
