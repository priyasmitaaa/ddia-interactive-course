"""Reference solution for exercise 24. Run: python practice/_solutions/24-atomicity/solution.py"""
import importlib.util
import pathlib

spec = importlib.util.spec_from_file_location(
    "mailbox", pathlib.Path(__file__).resolve().parents[2] / "24-atomicity" / "mailbox.py")
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)


def deliver_atomic(db, body, rand, p_crash):
    db.execute("BEGIN")
    try:
        db.execute("INSERT INTO emails (recipient, body, unread) VALUES (2, ?, 1)", (body,))
        m.maybe_crash(rand, p_crash)
        db.execute("UPDATE mailboxes SET unread = unread + 1 WHERE recipient = 2")
        db.execute("COMMIT")
    except BaseException:
        db.execute("ROLLBACK")
        raise


def deliver_idempotent(db, body, message_id, rand, p_crash):
    db.execute("CREATE TABLE IF NOT EXISTS delivered (message_id TEXT PRIMARY KEY)")
    db.execute("BEGIN")
    try:
        cur = db.execute("INSERT OR IGNORE INTO delivered VALUES (?)", (message_id,))
        if cur.rowcount == 1:                       # first time we see this message
            db.execute("INSERT INTO emails (recipient, body, unread) VALUES (2, ?, 1)", (body,))
            db.execute("UPDATE mailboxes SET unread = unread + 1 WHERE recipient = 2")
        db.execute("COMMIT")
    except BaseException:
        db.execute("ROLLBACK")
        raise
    m.maybe_crash(rand, p_crash)                    # crash AFTER commit, before the client hears "ok"


m.deliver_atomic, m.deliver_idempotent = deliver_atomic, deliver_idempotent
src = pathlib.Path(m.__file__).read_text(encoding="utf-8").split('if __name__ == "__main__":', 1)[1]
exec("if True:" + src, vars(m))
