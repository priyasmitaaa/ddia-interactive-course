"""Exercise 41 - keeping a search index in sync: dual writes vs change data capture (pp. 437-442).

The system of record is a SQLite table `products`. The derived system is a tiny in-memory full-text index.

Part A (given): dual writes - the application writes to the database AND the index. We replay the unlucky
interleaving of Figure 11-4 and the "second write failed" case: the index silently diverges.

Part B (you): change data capture with triggers (trigger-based CDC, p. 440). Every insert/update/delete on
`products` appends a row to `changelog` (with an increasing sequence number) in the SAME transaction. A consumer
applies the changelog to the index in sequence order, remembering the last sequence number it applied.

  TODO 1  install_cdc_triggers
  TODO 2  CdcConsumer.poll
  TODO 3  compact            (log compaction: latest change per key, deletes dropped)
  TODO 4  bootstrap_new_index (consistent snapshot + position in the log, then catch up)
"""
from __future__ import annotations

import re
import sqlite3
from dataclasses import dataclass, field


# ------------------------------------------------------------------ the derived system (given)

@dataclass
class SearchIndex:
    docs: dict[int, str] = field(default_factory=dict)          # id -> indexed text
    terms: dict[str, set[int]] = field(default_factory=dict)    # term -> ids

    def put(self, pid: int, text: str) -> None:
        self.delete(pid)
        self.docs[pid] = text
        for t in set(re.findall(r"\w+", text.lower())):
            self.terms.setdefault(t, set()).add(pid)

    def delete(self, pid: int) -> None:
        old = self.docs.pop(pid, None)
        if old:
            for t in set(re.findall(r"\w+", old.lower())):
                self.terms.get(t, set()).discard(pid)

    def search(self, term: str) -> set[int]:
        return set(self.terms.get(term.lower(), set()))


def db_contents(conn: sqlite3.Connection) -> dict[int, str]:
    return {pid: f"{name} {desc}" for pid, name, desc in conn.execute("SELECT id, name, description FROM products")}


def new_db() -> sqlite3.Connection:
    conn = sqlite3.connect(":memory:", isolation_level=None)
    conn.execute("CREATE TABLE products (id INTEGER PRIMARY KEY, name TEXT, description TEXT)")
    return conn


# ------------------------------------------------------------------ Part A: dual writes (given)

def dual_write_race() -> tuple[dict, dict]:
    """Figure 11-4: client 1 sets X = A, client 2 sets X = B; the database sees 1 then 2, the index sees 2 then 1."""
    conn, index = new_db(), SearchIndex()
    conn.execute("INSERT INTO products VALUES (1, 'lamp', 'old')")
    index.put(1, "lamp old")
    conn.execute("UPDATE products SET description = 'red' WHERE id = 1")    # client 1 -> database
    conn.execute("UPDATE products SET description = 'blue' WHERE id = 1")   # client 2 -> database
    index.put(1, "lamp blue")                                               # client 2 -> index
    index.put(1, "lamp red")                                                # client 1 -> index (late)
    return db_contents(conn), index.docs


def dual_write_partial_failure() -> tuple[dict, dict]:
    conn, index = new_db(), SearchIndex()
    conn.execute("INSERT INTO products VALUES (2, 'mug', 'plain')")
    try:
        raise ConnectionError("search index timed out")                     # the second write fails
    except ConnectionError:
        pass                                                                # app logs it and moves on
    return db_contents(conn), index.docs


# ------------------------------------------------------------------ Part B: change data capture

def install_cdc_triggers(conn: sqlite3.Connection) -> None:
    """Create table changelog(seq INTEGER PRIMARY KEY AUTOINCREMENT, op TEXT, id INTEGER, name TEXT,
    description TEXT) and AFTER INSERT / UPDATE / DELETE triggers on products that append one row each
    (op = 'upsert' with the NEW values, or 'delete' with the OLD id and NULL name/description)."""
    # TODO 1 (solution)
    conn.executescript("""
        CREATE TABLE changelog (seq INTEGER PRIMARY KEY AUTOINCREMENT, op TEXT, id INTEGER, name TEXT, description TEXT);
        CREATE TRIGGER products_ins AFTER INSERT ON products BEGIN
            INSERT INTO changelog (op, id, name, description) VALUES ('upsert', NEW.id, NEW.name, NEW.description);
        END;
        CREATE TRIGGER products_upd AFTER UPDATE ON products BEGIN
            INSERT INTO changelog (op, id, name, description) VALUES ('upsert', NEW.id, NEW.name, NEW.description);
        END;
        CREATE TRIGGER products_del AFTER DELETE ON products BEGIN
            INSERT INTO changelog (op, id, name, description) VALUES ('delete', OLD.id, NULL, NULL);
        END;
    """)


@dataclass
class CdcConsumer:
    conn: sqlite3.Connection
    index: SearchIndex
    last_seq: int = 0

    def poll(self, max_n: int = 1000) -> int:
        """Apply changelog rows with seq > last_seq, in seq order, to the index. Returns how many were applied."""
        # TODO 2 (solution)
        rows = self.conn.execute(
            "SELECT seq, op, id, name, description FROM changelog WHERE seq > ? ORDER BY seq LIMIT ?",
            (self.last_seq, max_n)).fetchall()
        for seq, op, pid, name, desc in rows:
            if op == "delete":
                self.index.delete(pid)
            else:
                self.index.put(pid, f"{name} {desc}")
            self.last_seq = seq
        return len(rows)


def compact(rows: list[tuple]) -> list[tuple]:
    """rows are (seq, op, id, name, description) in seq order. Keep only the most recent row for each id, and drop ids
    whose most recent row is a delete (a tombstone), preserving seq order."""
    # TODO 3 (solution)
    latest: dict[int, tuple] = {}
    for r in rows:
        latest[r[2]] = r
    return sorted((r for r in latest.values() if r[1] != "delete"), key=lambda r: r[0])


def bootstrap_new_index(conn: sqlite3.Connection) -> CdcConsumer:
    """A brand-new derived index, created when the changelog may already have been truncated: take a CONSISTENT
    snapshot of products together with the changelog position it corresponds to (one read transaction), load it, and
    return a consumer positioned right after that point so it can catch up with poll()."""
    # TODO 4 (solution)
    conn.execute("BEGIN")
    try:
        snapshot = conn.execute("SELECT id, name, description FROM products").fetchall()
        pos = conn.execute("SELECT COALESCE(MAX(seq), 0) FROM changelog").fetchone()[0]
    finally:
        conn.execute("COMMIT")
    index = SearchIndex()
    for pid, name, desc in snapshot:
        index.put(pid, f"{name} {desc}")
    return CdcConsumer(conn, index, last_seq=pos)


def workload(conn: sqlite3.Connection, n: int = 200) -> None:
    import random
    rnd = random.Random(7)
    words = ["red", "blue", "lamp", "mug", "desk", "oak", "steel", "soft", "cheap", "fancy"]
    for i in range(n):
        pid = rnd.randrange(1, 40)
        r = rnd.random()
        if r < 0.15:
            conn.execute("DELETE FROM products WHERE id = ?", (pid,))
        else:
            conn.execute("INSERT INTO products VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET name = excluded.name, "
                         "description = excluded.description",
                         (pid, rnd.choice(words), " ".join(rnd.sample(words, 3))))


if __name__ == "__main__":
    db, idx = dual_write_race()
    print("dual writes, Figure 11-4 race :", "database", db, "| index", idx)
    db, idx = dual_write_partial_failure()
    print("dual writes, failed 2nd write:", "database", db, "| index", idx)

    conn = new_db()
    install_cdc_triggers(conn)
    consumer = CdcConsumer(conn, SearchIndex())
    workload(conn, 150)
    consumer.poll()
    workload(conn, 150)
    consumer.poll()
    print(f"\nCDC: index == database? {consumer.index.docs == db_contents(conn)}  (applied up to seq {consumer.last_seq})")
    rows = conn.execute("SELECT seq, op, id, name, description FROM changelog ORDER BY seq").fetchall()
    compacted = compact(rows)
    rebuilt = SearchIndex()
    for _, _, pid, name, desc in compacted:
        rebuilt.put(pid, f"{name} {desc}")
    print(f"log compaction: {len(rows)} changes -> {len(compacted)}; index rebuilt from compacted log == database? "
          f"{rebuilt.docs == db_contents(conn)}")
    conn.execute("DELETE FROM changelog WHERE seq <= ?", (consumer.last_seq,))   # the log was truncated
    late = bootstrap_new_index(conn)
    workload(conn, 50)
    late.poll()
    print(f"new index from snapshot + catch-up == database? {late.index.docs == db_contents(conn)}")
