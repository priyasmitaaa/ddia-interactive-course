"""
Exercise 05 — Schema-on-write vs schema-on-read (book pp. 39-40).

Change of requirement: we stored each user's full name in one field `name`,
now we want `first_name` separately.

Run:  python practice/05-schema-on-read/schema.py
"""
import json
import random
import sqlite3
import time

N = 300_000
rand = random.Random(1)
FIRST = ["Ana", "Bo", "Chen", "Dara", "Eli", "Femi", "Gus", "Hana", "Ivo", "Jun"]
LAST = ["Smith", "Okafor", "Ng", "Garcia", "Kowalski", "Sato", "Dubois", "Haddad"]


def make_names():
    return [f"{rand.choice(FIRST)} {rand.choice(LAST)}" for _ in range(N)]


# ---------------------------------------------------------------------------
# Part A — schema-on-write (relational migration).
# The table exists with a `name` column. TASK: add a `first_name` column and fill it.
# Time the two steps separately: the ALTER TABLE, and the UPDATE that rewrites every row.
# (SQLite: substr(name, 1, instr(name, ' ') - 1) gives the part before the first space.)
# ---------------------------------------------------------------------------
def part_a(names):
    db = sqlite3.connect(":memory:")
    db.execute("CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)")
    db.executemany("INSERT INTO users (name) VALUES (?)", ((n,) for n in names))
    db.commit()

    t0 = time.perf_counter()
    # TODO: ALTER TABLE ...
    raise NotImplementedError("Part A: add the ALTER TABLE here")
    t1 = time.perf_counter()
    # TODO: UPDATE users SET first_name = ...
    t2 = time.perf_counter()

    sample = db.execute("SELECT name, first_name FROM users WHERE id = 42").fetchone()
    print(f"Part A: ALTER TABLE took {1000*(t1-t0):.2f} ms, UPDATE of {N:,} rows took {1000*(t2-t1):.0f} ms; sample={sample}")


# ---------------------------------------------------------------------------
# Part B — schema-on-read (documents).
# Old documents look like {"id": 1, "name": "Ana Smith"}.
# From today, new documents are written as {"id": 2, "first_name": "Bo", "last_name": "Ng"}.
# Nothing is migrated. TASK: write read_user(doc_json) that returns a dict that ALWAYS has
# first_name and last_name, whichever version of the document it gets.
# ---------------------------------------------------------------------------
def read_user(doc_json: str) -> dict:
    raise NotImplementedError


def part_b():
    old = json.dumps({"id": 1, "name": "Ana Smith"})
    new = json.dumps({"id": 2, "first_name": "Bo", "last_name": "Ng"})
    for d in (old, new):
        u = read_user(d)
        assert u["first_name"] and u["last_name"], u
        print("Part B:", u)


# ---------------------------------------------------------------------------
# Part C — heterogeneous data.
# Events arrive from three external systems you don't control. Each has its own shape.
# TASK: compute the total amount in EUR across all events. (1 USD = 0.9 EUR for this exercise.)
# Think about how you'd model this with a fixed relational schema, and why that's awkward.
# ---------------------------------------------------------------------------
EVENTS = [
    {"source": "shop", "order_id": 17, "total_eur": 30.0, "items": 3},
    {"source": "payments", "txn": "a9f", "amount": {"value": 1200, "currency": "USD", "unit": "cents"}},
    {"source": "legacy", "AMT": "15,50", "CUR": "EUR"},
    {"source": "shop", "order_id": 18, "total_eur": 12.5, "items": 1, "coupon": "SPRING"},
    {"source": "payments", "txn": "b10", "amount": {"value": 500, "currency": "EUR", "unit": "cents"}},
]


def amount_eur(event: dict) -> float:
    raise NotImplementedError


if __name__ == "__main__":
    for part in (lambda: part_a(make_names()), part_b,
                 lambda: print(f"Part C: total = {sum(amount_eur(e) for e in EVENTS):.2f} EUR (expected 73.80)")):
        try:
            part()
        except NotImplementedError as e:
            print("not implemented yet:", e or "")
