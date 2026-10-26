"""
Exercise 07 — Graph queries: recursive SQL and a tiny Datalog engine (book pp. 48-62).

Run:  python practice/07-graph-queries/graph.py
"""
import json
import sqlite3

# Figure 2-5 as a property graph stored in two relational tables (Example 2-2).
VERTICES = {
    1: {"name": "North America", "type": "continent"},
    2: {"name": "United States", "type": "country"},
    3: {"name": "Idaho", "type": "state"},
    4: {"name": "Europe", "type": "continent"},
    5: {"name": "United Kingdom", "type": "country"},
    6: {"name": "England", "type": "country"},
    7: {"name": "London", "type": "city"},
    8: {"name": "France", "type": "country"},
    9: {"name": "Burgundy", "type": "region"},
    10: {"name": "Cote-d'Or", "type": "departement"},
    11: {"name": "Beaune", "type": "city"},
    12: {"name": "Lucy", "type": "person"},
    13: {"name": "Alain", "type": "person"},
    14: {"name": "Sam", "type": "person"},
}
# (tail, label, head)
EDGES = [
    (2, "within", 1), (3, "within", 2), (5, "within", 4), (6, "within", 5), (7, "within", 6),
    (8, "within", 4), (9, "within", 8), (10, "within", 9), (11, "within", 10),
    (12, "born_in", 3), (12, "lives_in", 7), (13, "born_in", 11), (13, "lives_in", 7),
    (14, "born_in", 2), (14, "lives_in", 11),   # Sam: born in the US (country level), lives in Beaune
]

db = sqlite3.connect(":memory:")
db.executescript("""
CREATE TABLE vertices (vertex_id INTEGER PRIMARY KEY, properties TEXT);
CREATE TABLE edges (edge_id INTEGER PRIMARY KEY, tail_vertex INTEGER, head_vertex INTEGER, label TEXT, properties TEXT);
CREATE INDEX edges_tails ON edges (tail_vertex);
CREATE INDEX edges_heads ON edges (head_vertex);
""")
db.executemany("INSERT INTO vertices VALUES (?, ?)", [(k, json.dumps(v)) for k, v in VERTICES.items()])
db.executemany("INSERT INTO edges (tail_vertex, head_vertex, label, properties) VALUES (?, ?, ?, '{}')",
               [(t, h, l) for t, l, h in EDGES])


# ---------------------------------------------------------------------------
# TASK 1: Example 2-5 in SQLite. Find the names of people born in the United States
# and living in Europe, using WITH RECURSIVE. In SQLite, read a JSON property with
#     json_extract(properties, '$.name')      (or  properties ->> '$.name')
# Expected answer: Lucy and Sam.
# ---------------------------------------------------------------------------
SQL = """
SELECT 'replace me'
"""


def task1():
    raise NotImplementedError
    return sorted(r[0] for r in db.execute(SQL))


# ---------------------------------------------------------------------------
# TASK 2: a tiny Datalog engine (Example 2-11).
# Facts are tuples like ("within", 3, 2) or ("name", 2, "United States").
# Implement naive bottom-up evaluation: repeatedly apply the rules to the set of known
# facts, adding new derived facts, until an iteration adds nothing new (a "fixed point").
#
#   within_recursive(Loc, Name) :- name(Loc, Name).                          /* rule 1 */
#   within_recursive(Loc, Name) :- within(Loc, Via), within_recursive(Via, Name).  /* rule 2 */
#   migrated(Name, BornIn, LivingIn) :- name(P, Name), born_in(P, B), within_recursive(B, BornIn),
#                                        lives_in(P, L), within_recursive(L, LivingIn).  /* rule 3 */
#
# You may hand-code each rule as a Python function over the fact set (no parser needed).
# Print how many facts each iteration added — that is Figure 2-6 in action.
# ---------------------------------------------------------------------------
def base_facts():
    facts = set()
    for vid, props in VERTICES.items():
        facts.add(("name", vid, props["name"]))
    for t, label, h in EDGES:
        facts.add((label, t, h))
    return facts


def evaluate(facts):
    """Return the fixed point (all facts, including derived ones)."""
    raise NotImplementedError


def task2():
    all_facts = evaluate(base_facts())
    return sorted(f[1] for f in all_facts if f[0] == "migrated" and f[2] == "United States" and f[3] == "Europe")


if __name__ == "__main__":
    for name, fn in [("Task 1 (recursive SQL)", task1), ("Task 2 (Datalog)", task2)]:
        try:
            print(f"{name}: {fn()}")
        except NotImplementedError:
            print(f"{name}: not implemented yet")
