"""
Exercise 24 — Atomicity and multi-object transactions (book pp. 216, 219-224; Figures 7-2 and 7-3).

An email app stores messages AND a denormalized unread counter. Delivering a message is two writes.
A "crash" can happen between them. Does the counter stay in sync with the mailbox?

Run:  python practice/24-atomicity/mailbox.py
"""
import os
import random
import sqlite3
import tempfile


class Crash(Exception):
    """Simulates the application process dying in the middle of its work."""


def setup(path):
    db = sqlite3.connect(path, isolation_level=None)   # autocommit: every statement commits on its own
    db.executescript("""
        CREATE TABLE IF NOT EXISTS emails (id INTEGER PRIMARY KEY, recipient INT, body TEXT, unread INT);
        CREATE TABLE IF NOT EXISTS mailboxes (recipient INT PRIMARY KEY, unread INT);
        INSERT OR IGNORE INTO mailboxes VALUES (2, 0);
    """)
    return db


def maybe_crash(rand, p):
    if rand.random() < p:
        raise Crash()


# ---------------------------------------------------------------------------
# Version 1 (given): two separate auto-committed writes.
# ---------------------------------------------------------------------------
def deliver_no_transaction(db, body, rand, p_crash):
    db.execute("INSERT INTO emails (recipient, body, unread) VALUES (2, ?, 1)", (body,))
    maybe_crash(rand, p_crash)                       # the process dies here sometimes
    db.execute("UPDATE mailboxes SET unread = unread + 1 WHERE recipient = 2")


# ---------------------------------------------------------------------------
# TASK 1: the same two writes inside ONE transaction (BEGIN ... COMMIT).
# If anything goes wrong in between (a Crash), the database must end up as if neither write happened.
# Hint: db.execute("BEGIN"), then the writes, then "COMMIT"; on exception, "ROLLBACK" and re-raise.
# (A real crash would kill the process; on restart, the database discards the uncommitted transaction
#  using its write-ahead log. ROLLBACK simulates that.)
# ---------------------------------------------------------------------------
def deliver_atomic(db, body, rand, p_crash):
    raise NotImplementedError


# ---------------------------------------------------------------------------
# TASK 2: retrying safely. The client retries delivery after a crash. With the atomic version, a retry
# after an abort is always safe. But what if the crash happens AFTER the commit, before the client hears
# "ok"? Then a retry delivers the email twice. Fix it: give each email a unique message_id and make the
# insert idempotent (e.g. a UNIQUE column + INSERT OR IGNORE, and only bump the counter if a row was added).
# ---------------------------------------------------------------------------
def deliver_idempotent(db, body, message_id, rand, p_crash):
    raise NotImplementedError


def check(db):
    emails = db.execute("SELECT count(*) FROM emails WHERE recipient = 2 AND unread = 1").fetchone()[0]
    counter = db.execute("SELECT unread FROM mailboxes WHERE recipient = 2").fetchone()[0]
    return emails, counter


def run(name, fn, retry=False):
    path = os.path.join(tempfile.mkdtemp(), "mail.db")
    db = setup(path)
    rand = random.Random(24)
    crashes = 0
    for i in range(500):
        for attempt in range(5 if retry else 1):
            try:
                fn(db, i, rand)
                break
            except Crash:
                crashes += 1
    emails, counter = check(db)
    state = "in sync" if emails == counter else "OUT OF SYNC"
    extra = f", {emails - 500} DUPLICATES" if emails > 500 else f", {500 - emails} never delivered" if emails < 500 else ""
    print(f"{name:<42} crashes={crashes:<3} emails={emails:<4} counter={counter:<4} -> {state}{extra}")


if __name__ == "__main__":
    run("no transaction", lambda db, i, r: deliver_no_transaction(db, f"msg {i}", r, 0.1))
    try:
        run("atomic transaction", lambda db, i, r: deliver_atomic(db, f"msg {i}", r, 0.1))
        run("atomic + retries", lambda db, i, r: deliver_atomic(db, f"msg {i}", r, 0.1), retry=True)
        run("atomic, crash AFTER commit, retries",
            lambda db, i, r: (deliver_atomic(db, f"msg {i}", r, 0.0), maybe_crash(r, 0.1)), retry=True)
    except NotImplementedError:
        print("Task 1 not implemented yet")
    try:
        run("idempotent + retries (crash after commit)", lambda db, i, r: deliver_idempotent(db, f"msg {i}", f"id-{i}", r, 0.1), retry=True)
    except NotImplementedError:
        print("Task 2 not implemented yet")
