"""
Exercise 09 — Indexes in a real database (SQLite uses B-trees for tables and indexes).
Book pp. 69, 77-85: indexes speed up reads, slow down writes; concatenated and covering indexes.

Run:  python practice/09-sqlite-indexes/indexes.py
Each experiment prints the query plan (EXPLAIN QUERY PLAN) and timings.
Fill in the SQL marked TODO; the experiments that still contain TODO are skipped.
"""
import random
import sqlite3
import time

N = 300_000
rand = random.Random(9)
FIRST = ["Ana", "Bo", "Chen", "Dara", "Eli", "Femi", "Gus", "Hana", "Ivo", "Jun", "Kai", "Lea"]
LAST = [f"Surname{i}" for i in range(2000)]
CITIES = ["Seattle", "London", "Pune", "Lagos", "Lima", "Oslo", "Osaka", "Quito"]


def rows(n, start=0):
    for i in range(start, start + n):
        yield (i, f"user{i}@example.com", rand.choice(LAST), rand.choice(FIRST), rand.choice(CITIES),
               f"20{rand.randint(10, 24)}-{rand.randint(1, 12):02d}-{rand.randint(1, 28):02d}")


def fresh_db():
    db = sqlite3.connect(":memory:")
    db.execute("CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT, last_name TEXT, first_name TEXT, city TEXT, signup_date TEXT)")
    db.executemany("INSERT INTO users VALUES (?,?,?,?,?,?)", rows(N))
    db.commit()
    return db


def plan(db, sql, params=()):
    return " | ".join(r[-1] for r in db.execute("EXPLAIN QUERY PLAN " + sql, params))


def timed(db, sql, params=(), repeat=20):
    t = time.perf_counter()
    for _ in range(repeat):
        db.execute(sql, params).fetchall()
    return (time.perf_counter() - t) / repeat * 1000


def show(db, label, sql, params=()):
    print(f"  {label:<34} {timed(db, sql, params):8.3f} ms   plan: {plan(db, sql, params)}")


def todo(s):
    return "TODO" in s


# ---------------------------------------------------------------------------
# Experiment 1: point lookup with and without an index.
# ---------------------------------------------------------------------------
LOOKUP = "SELECT * FROM users WHERE email = ?"
CREATE_EMAIL_INDEX = "TODO: CREATE INDEX ... ON users(email)"

# ---------------------------------------------------------------------------
# Experiment 2: concatenated (multi-column) index, like a phone book (p. 84).
# ---------------------------------------------------------------------------
CREATE_NAME_INDEX = "TODO: CREATE INDEX ... ON users(last_name, first_name)"
BY_LAST = "SELECT id FROM users WHERE last_name = 'Surname42'"
BY_LAST_FIRST = "SELECT id FROM users WHERE last_name = 'Surname42' AND first_name = 'Hana'"
BY_FIRST = "SELECT id FROM users WHERE first_name = 'Hana'"

# ---------------------------------------------------------------------------
# Experiment 3: covering index (p. 83). Make an index that contains everything this query needs,
# so SQLite never has to visit the table itself.
# ---------------------------------------------------------------------------
CITY_QUERY = "SELECT city FROM users WHERE last_name = 'Surname42'"
CREATE_COVERING_INDEX = "TODO: CREATE INDEX ... ON users(last_name, city)"

# ---------------------------------------------------------------------------
# Experiment 4: range query. B-trees keep keys sorted, so ranges are cheap.
# ---------------------------------------------------------------------------
RANGE_QUERY = "SELECT count(*) FROM users WHERE signup_date BETWEEN '2015-03-01' AND '2015-03-07'"
CREATE_DATE_INDEX = "TODO: CREATE INDEX ... ON users(signup_date)"


def experiment_writes():
    """Experiment 5 (given): every index slows down writes."""
    for n_idx in (0, 1, 3, 5):
        db = sqlite3.connect(":memory:")
        db.execute("CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT, last_name TEXT, first_name TEXT, city TEXT, signup_date TEXT)")
        cols = ["email", "last_name", "first_name", "city", "signup_date"][:n_idx]
        for c in cols:
            db.execute(f"CREATE INDEX idx_{c} ON users({c})")
        t = time.perf_counter()
        db.executemany("INSERT INTO users VALUES (?,?,?,?,?,?)", rows(100_000))
        db.commit()
        print(f"  insert 100k rows with {n_idx} secondary index(es): {time.perf_counter() - t:6.2f} s")


if __name__ == "__main__":
    print(f"Building a table with {N:,} rows...")
    db = fresh_db()
    print("\nExperiment 1 - point lookup")
    show(db, "lookup by email, no index", LOOKUP, ("user123456@example.com",))
    if not todo(CREATE_EMAIL_INDEX):
        db.execute(CREATE_EMAIL_INDEX)
        show(db, "lookup by email, with index", LOOKUP, ("user123456@example.com",))
    print("\nExperiment 2 - concatenated index (last_name, first_name)")
    if not todo(CREATE_NAME_INDEX):
        db.execute(CREATE_NAME_INDEX)
        show(db, "by last_name", BY_LAST)
        show(db, "by last_name AND first_name", BY_LAST_FIRST)
        show(db, "by first_name only", BY_FIRST)
    else:
        print("  (fill in CREATE_NAME_INDEX)")
    print("\nExperiment 3 - covering index")
    show(db, "city for a last_name (before)", CITY_QUERY)
    if not todo(CREATE_COVERING_INDEX):
        db.execute(CREATE_COVERING_INDEX)
        show(db, "city for a last_name (covering)", CITY_QUERY)
    print("\nExperiment 4 - range query")
    show(db, "one week of signups, no index", RANGE_QUERY)
    if not todo(CREATE_DATE_INDEX):
        db.execute(CREATE_DATE_INDEX)
        show(db, "one week of signups, with index", RANGE_QUERY)
    print("\nExperiment 5 - the write cost of indexes")
    experiment_writes()
