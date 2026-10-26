"""Reference solution for exercise 05. Run: python practice/_solutions/05-schema-on-read/solution.py"""
import importlib.util
import json
import pathlib
import sqlite3
import time

spec = importlib.util.spec_from_file_location(
    "schema", pathlib.Path(__file__).resolve().parents[2] / "05-schema-on-read" / "schema.py")
s = importlib.util.module_from_spec(spec)
spec.loader.exec_module(s)


def part_a(names):
    db = sqlite3.connect(":memory:")
    db.execute("CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)")
    db.executemany("INSERT INTO users (name) VALUES (?)", ((n,) for n in names))
    db.commit()
    t0 = time.perf_counter()
    db.execute("ALTER TABLE users ADD COLUMN first_name TEXT")
    t1 = time.perf_counter()
    db.execute("UPDATE users SET first_name = substr(name, 1, instr(name, ' ') - 1)")
    db.commit()
    t2 = time.perf_counter()
    sample = db.execute("SELECT name, first_name FROM users WHERE id = 42").fetchone()
    print(f"Part A: ALTER TABLE took {1000*(t1-t0):.2f} ms, UPDATE of {s.N:,} rows took {1000*(t2-t1):.0f} ms; sample={sample}")


def read_user(doc_json):
    u = json.loads(doc_json)
    if "first_name" not in u and "name" in u:      # document written before the change
        first, _, last = u["name"].partition(" ")
        u["first_name"], u["last_name"] = first, last
    return u


def amount_eur(e):
    if e["source"] == "shop":
        return e["total_eur"]
    if e["source"] == "payments":
        v = e["amount"]["value"] / (100 if e["amount"]["unit"] == "cents" else 1)
        return v * (0.9 if e["amount"]["currency"] == "USD" else 1.0)
    if e["source"] == "legacy":
        v = float(e["AMT"].replace(",", "."))
        return v * (0.9 if e["CUR"] == "USD" else 1.0)
    raise ValueError(e)


s.part_a, s.read_user, s.amount_eur = part_a, read_user, amount_eur
src = pathlib.Path(s.__file__).read_text(encoding="utf-8").split('if __name__ == "__main__":', 1)[1]
exec("if True:" + src, vars(s))
