"""
Exercise 04 — The same résumé, two data models (book pp. 28-35).

Uses SQLite (built into Python). The database is created in memory each run.
Run:  python practice/04-document-vs-relational/profiles.py
"""
import json
import sqlite3

db = sqlite3.connect(":memory:")
db.row_factory = sqlite3.Row

# ---------------------------------------------------------------------------
# Model A: normalized relational schema (like Figure 2-1).
# ---------------------------------------------------------------------------
db.executescript("""
CREATE TABLE regions    (id TEXT PRIMARY KEY, region_name TEXT);
CREATE TABLE users      (user_id INTEGER PRIMARY KEY, first_name TEXT, last_name TEXT,
                         region_id TEXT REFERENCES regions(id), photo_url TEXT);
CREATE TABLE positions  (id INTEGER PRIMARY KEY, user_id INTEGER REFERENCES users(user_id),
                         job_title TEXT, organization TEXT);
CREATE TABLE education  (id INTEGER PRIMARY KEY, user_id INTEGER REFERENCES users(user_id),
                         school_name TEXT, start INTEGER, end INTEGER);
CREATE INDEX positions_user ON positions(user_id);
CREATE INDEX education_user ON education(user_id);

INSERT INTO regions VALUES ('us:91', 'Greater Seattle Area'), ('uk:3', 'London');
INSERT INTO users VALUES (251, 'Bill', 'Gates', 'us:91', '/p/bill.jpg'),
                         (252, 'Ada',  'Lovelace', 'uk:3', '/p/ada.jpg'),
                         (253, 'Grace','Hopper', 'us:91', '/p/grace.jpg');
INSERT INTO positions VALUES (458, 251, 'Co-chair', 'Gates Foundation'),
                             (457, 251, 'Co-founder, Chairman', 'Microsoft'),
                             (460, 252, 'Analyst', 'Analytical Engine Ltd'),
                             (461, 253, 'Rear Admiral', 'US Navy');
INSERT INTO education VALUES (807, 251, 'Harvard University', 1973, 1975),
                             (806, 251, 'Lakeside School', NULL, NULL),
                             (808, 253, 'Yale University', 1930, 1934);
""")

# ---------------------------------------------------------------------------
# Model B: one JSON document per user, stored in a single column (like Example 2-1).
# ---------------------------------------------------------------------------
db.execute("CREATE TABLE user_docs (user_id INTEGER PRIMARY KEY, doc TEXT)")
DOCS = [
    {"user_id": 251, "first_name": "Bill", "last_name": "Gates", "region_id": "us:91", "photo_url": "/p/bill.jpg",
     "positions": [{"job_title": "Co-chair", "organization": "Gates Foundation"},
                   {"job_title": "Co-founder, Chairman", "organization": "Microsoft"}],
     "education": [{"school_name": "Harvard University", "start": 1973, "end": 1975},
                   {"school_name": "Lakeside School", "start": None, "end": None}]},
    {"user_id": 252, "first_name": "Ada", "last_name": "Lovelace", "region_id": "uk:3", "photo_url": "/p/ada.jpg",
     "positions": [{"job_title": "Analyst", "organization": "Analytical Engine Ltd"}], "education": []},
    {"user_id": 253, "first_name": "Grace", "last_name": "Hopper", "region_id": "us:91", "photo_url": "/p/grace.jpg",
     "positions": [{"job_title": "Rear Admiral", "organization": "US Navy"}],
     "education": [{"school_name": "Yale University", "start": 1930, "end": 1934}]},
]
db.executemany("INSERT INTO user_docs VALUES (?, ?)", [(d["user_id"], json.dumps(d)) for d in DOCS])

QUERIES = {"count": 0}


def q(sql, *params):
    """Run a query and count it, so you can compare how many round trips each model needs."""
    QUERIES["count"] += 1
    return db.execute(sql, params).fetchall()


# ---------------------------------------------------------------------------
# TASK 1: load a full profile (as a Python dict shaped like the JSON documents) from
#   (a) the relational tables — use as many queries as you need, but count them;
#   (b) the user_docs table — one query.
# Both must return the same dict for user 251 (ignore 'region_id' vs region name for now).
# ---------------------------------------------------------------------------
def load_profile_relational(user_id):
    raise NotImplementedError


def load_profile_document(user_id):
    raise NotImplementedError


# ---------------------------------------------------------------------------
# TASK 2: a new feature with a many-to-many relationship — recommendations.
# A recommendation is written BY one user ABOUT another user, and is shown on the
# recommended user's profile WITH THE RECOMMENDER'S NAME AND PHOTO.
#
# (a) Relational: create a table recommendations(id, from_user, to_user, text), insert
#     "Grace recommends Bill" and "Ada recommends Bill", and write ONE query that returns
#     each recommendation for user 251 with the recommender's first_name and photo_url.
# (b) Document: decide how to store recommendations inside Bill's document. Two options:
#     - embed a COPY of the recommender's name/photo (denormalized), or
#     - embed only the recommender's user_id (a reference) and look it up afterwards.
#     Implement the reference version in show_recommendations_document().
# (c) Grace changes her photo to '/p/grace-2024.jpg'. Write change_photo_* for both models and
#     think about how many documents you'd have to rewrite in the COPY version.
# ---------------------------------------------------------------------------
def setup_recommendations():
    raise NotImplementedError


def show_recommendations_relational(user_id):
    """Return list of (recommender_first_name, recommender_photo, text)."""
    raise NotImplementedError


def show_recommendations_document(user_id):
    """Same result, from user_docs. Count your queries!"""
    raise NotImplementedError


if __name__ == "__main__":
    try:
        QUERIES["count"] = 0
        rel = load_profile_relational(251)
        n_rel = QUERIES["count"]
        QUERIES["count"] = 0
        doc = load_profile_document(251)
        n_doc = QUERIES["count"]
        same = {k: v for k, v in rel.items()} == {k: v for k, v in doc.items()}
        print(f"Task 1: relational needed {n_rel} queries, document needed {n_doc}. Same result: {same}")
        if not same:
            print("  relational:", rel)
            print("  document:  ", doc)
    except NotImplementedError:
        print("Task 1 not implemented yet")

    try:
        setup_recommendations()
        QUERIES["count"] = 0
        r = show_recommendations_relational(251)
        print(f"Task 2a: {r}  ({QUERIES['count']} query)")
        QUERIES["count"] = 0
        d = show_recommendations_document(251)
        print(f"Task 2b: {d}  ({QUERIES['count']} queries)")
    except NotImplementedError:
        print("Task 2 not implemented yet")
