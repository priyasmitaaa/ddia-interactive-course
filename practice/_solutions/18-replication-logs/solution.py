"""Reference solution for exercise 18. Run: python practice/_solutions/18-replication-logs/solution.py"""
import importlib.util
import pathlib

spec = importlib.util.spec_from_file_location(
    "replog", pathlib.Path(__file__).resolve().parents[2] / "18-replication-logs" / "replog.py")
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)


def capture_changes(before, after):
    b = {r[0]: r for r in before}
    a = {r[0]: r for r in after}
    out = []
    for rid, row in a.items():
        if rid not in b:
            out.append(("insert", row))
        elif b[rid] != row:
            out.append(("update", rid, row))
    for rid in b:
        if rid not in a:
            out.append(("delete", rid))
    return out


def apply_changes(db, changes):
    for c in changes:
        if c[0] == "insert":
            db.execute("INSERT INTO tickets (id, owner, prize, status) VALUES (?, ?, ?, ?)", c[1])
        elif c[0] == "update":
            _, rid, row = c
            db.execute("UPDATE tickets SET owner = ?, prize = ?, status = ? WHERE id = ?", (row[1], row[2], row[3], rid))
        else:
            db.execute("DELETE FROM tickets WHERE id = ?", (c[1],))


m.capture_changes, m.apply_changes = capture_changes, apply_changes
src = pathlib.Path(m.__file__).read_text(encoding="utf-8").split('if __name__ == "__main__":', 1)[1]
exec("if True:" + src, vars(m))
