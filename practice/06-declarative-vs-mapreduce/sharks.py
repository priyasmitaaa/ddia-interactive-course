"""
Exercise 06 — Three ways to ask one question: imperative, SQL, MapReduce (book pp. 42-48).

"How many sharks were sighted per month?"

Run:  python practice/06-declarative-vs-mapreduce/sharks.py
"""
import datetime as dt
import random
import sqlite3
from collections import defaultdict

rand = random.Random(4)
FAMILIES = ["Sharks", "Whales", "Dolphins", "Rays"]
START = dt.datetime(1995, 1, 1)

OBSERVATIONS = [
    {
        "observation_timestamp": START + dt.timedelta(minutes=rand.randrange(60 * 24 * 365 * 2)),
        "family": rand.choice(FAMILIES),
        "num_animals": rand.randint(1, 6),
    }
    for _ in range(50_000)
]


# ---------------------------------------------------------------------------
# Version 1 (given): imperative. We say HOW: loop, test, accumulate.
# ---------------------------------------------------------------------------
def imperative():
    totals = defaultdict(int)
    for o in OBSERVATIONS:
        if o["family"] == "Sharks":
            key = o["observation_timestamp"].strftime("%Y-%m")
            totals[key] += o["num_animals"]
    return dict(totals)


# ---------------------------------------------------------------------------
# Version 2 (YOUR TASK): declarative SQL. We say WHAT.
# The data is loaded into SQLite for you. Write the query (SQLite has strftime('%Y-%m', ts)).
# ---------------------------------------------------------------------------
def declarative_sql():
    db = sqlite3.connect(":memory:")
    db.execute("CREATE TABLE observations (observation_timestamp TEXT, family TEXT, num_animals INTEGER)")
    db.executemany("INSERT INTO observations VALUES (?, ?, ?)",
                   [(o["observation_timestamp"].isoformat(sep=" "), o["family"], o["num_animals"]) for o in OBSERVATIONS])
    sql = "SELECT 1"   # TODO: replace with your query returning (month, total) rows
    raise NotImplementedError
    return dict(db.execute(sql).fetchall())


# ---------------------------------------------------------------------------
# Version 3 (YOUR TASK): a tiny MapReduce framework + the query written for it.
# map_fn(doc) yields (key, value) pairs. The framework groups values by key and calls
# reduce_fn(key, values) once per key. Like MongoDB's mapReduce with a `query` filter.
# ---------------------------------------------------------------------------
def map_reduce(docs, map_fn, reduce_fn, query=None):
    raise NotImplementedError


def shark_map(doc):
    raise NotImplementedError


def shark_reduce(key, values):
    raise NotImplementedError


if __name__ == "__main__":
    a = imperative()
    print(f"imperative: {len(a)} months, e.g. 1995-12 -> {a.get('1995-12')}")
    for name, fn in [("SQL", declarative_sql),
                     ("MapReduce", lambda: map_reduce(OBSERVATIONS, shark_map, shark_reduce,
                                                      query=lambda d: d["family"] == "Sharks"))]:
        try:
            r = fn()
            print(f"{name:>10}: {len(r)} months, e.g. 1995-12 -> {r.get('1995-12')}, identical to imperative: {r == a}")
        except NotImplementedError:
            print(f"{name:>10}: not implemented yet")
