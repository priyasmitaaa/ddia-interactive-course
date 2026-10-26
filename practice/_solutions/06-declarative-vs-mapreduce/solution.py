"""Reference solution for exercise 06. Run: python practice/_solutions/06-declarative-vs-mapreduce/solution.py"""
import importlib.util
import pathlib
import sqlite3
from collections import defaultdict

spec = importlib.util.spec_from_file_location(
    "sharks", pathlib.Path(__file__).resolve().parents[2] / "06-declarative-vs-mapreduce" / "sharks.py")
s = importlib.util.module_from_spec(spec)
spec.loader.exec_module(s)


def declarative_sql():
    db = sqlite3.connect(":memory:")
    db.execute("CREATE TABLE observations (observation_timestamp TEXT, family TEXT, num_animals INTEGER)")
    db.executemany("INSERT INTO observations VALUES (?, ?, ?)",
                   [(o["observation_timestamp"].isoformat(sep=" "), o["family"], o["num_animals"]) for o in s.OBSERVATIONS])
    sql = """SELECT strftime('%Y-%m', observation_timestamp) AS observation_month, sum(num_animals)
             FROM observations WHERE family = 'Sharks' GROUP BY observation_month"""
    return dict(db.execute(sql).fetchall())


def map_reduce(docs, map_fn, reduce_fn, query=None):
    groups = defaultdict(list)
    for d in docs:
        if query is None or query(d):
            for k, v in map_fn(d):
                groups[k].append(v)
    return {k: reduce_fn(k, vs) for k, vs in groups.items()}


def shark_map(doc):
    yield doc["observation_timestamp"].strftime("%Y-%m"), doc["num_animals"]


def shark_reduce(key, values):
    return sum(values)


s.declarative_sql, s.map_reduce, s.shark_map, s.shark_reduce = declarative_sql, map_reduce, shark_map, shark_reduce
src = pathlib.Path(s.__file__).read_text(encoding="utf-8").split('if __name__ == "__main__":', 1)[1]
exec("if True:" + src, vars(s))
