"""Lab 44 - an exactly-once stream processor (pp. 460-462).

Input: a log of payment events {"offset", "account", "amount"} (like one Kafka partition).
State/output: account balances in SQLite. Side effect: a "large payment" notification (think: email).
The processor can crash at ANY point; after a restart it resumes from wherever its offset says.

Three ways to handle offsets:
  at_least_once  (given)  write the balance, then commit the offset to a separate file every few events
                           -> a crash between the two re-applies events: balances too high
  idempotent     TODO 1   store, per account, the offset of the last event applied to it, in the same row as the
                           balance; skip events whose offset is not newer (p. 461-462)
  transactional  TODO 2   update the balance AND the processor's input offset in ONE SQLite transaction; on restart
                           read the offset from the database (atomic commit of state + offset, p. 461)

TODO 3: notifications are an external side effect. Make them happen at most once per event by recording a
deduplication key (the event's offset) before/with sending - an idempotency key.
"""
from __future__ import annotations

import json
import os
import random
import sqlite3


class Crash(Exception):
    """Simulated process crash."""


def _read_int(path: str) -> int:
    if not os.path.exists(path):
        return 0
    with open(path, encoding="utf-8") as f:
        return int(f.read())


def make_log(path: str, n: int = 200, seed: int = 3) -> list[dict]:
    rnd = random.Random(seed)
    events = [{"offset": i, "account": f"acct{rnd.randrange(8)}", "amount": rnd.choice([5, 10, 20, 50, 500])} for i in range(n)]
    with open(path, "w", encoding="utf-8") as f:
        for e in events:
            f.write(json.dumps(e) + "\n")
    return events


def read_log(path: str, start: int) -> list[dict]:
    with open(path, encoding="utf-8") as f:
        return [e for e in map(json.loads, f) if e["offset"] >= start]


def expected_balances(events: list[dict]) -> dict[str, int]:
    out: dict[str, int] = {}
    for e in events:
        out[e["account"]] = out.get(e["account"], 0) + e["amount"]
    return out


class Processor:
    """One processor instance (one 'process lifetime'). Create a new instance after a crash."""

    def __init__(self, workdir: str, log_path: str, crash_after: int | None = None):
        self.workdir, self.log_path = workdir, log_path
        self.db = sqlite3.connect(os.path.join(workdir, "state.db"), isolation_level=None)
        self.db.execute("CREATE TABLE IF NOT EXISTS balances (account TEXT PRIMARY KEY, balance INTEGER, last_offset INTEGER)")
        self.db.execute("CREATE TABLE IF NOT EXISTS progress (id INTEGER PRIMARY KEY CHECK (id = 0), next_offset INTEGER)")
        self.db.execute("CREATE TABLE IF NOT EXISTS sent_notifications (event_offset INTEGER PRIMARY KEY)")
        self.notifications_path = os.path.join(workdir, "outbox.log")  # the "email server": every line = one email sent
        self.crash_after = crash_after      # crash after handling this many events in this lifetime (at a bad moment)
        self.handled = 0

    def _maybe_crash(self) -> None:
        if self.crash_after is not None and self.handled >= self.crash_after:
            raise Crash()

    def balances(self) -> dict[str, int]:
        return dict(self.db.execute("SELECT account, balance FROM balances"))

    def _send_email(self, e: dict) -> None:
        with open(self.notifications_path, "a", encoding="utf-8") as f:
            f.write(f"large payment {e['amount']} to {e['account']} (event {e['offset']})\n")

    # ------------------------------------------------------------------ given: at-least-once
    def run_at_least_once(self, commit_every: int = 7) -> None:
        offset_file = os.path.join(self.workdir, "consumer-offset.txt")
        start = _read_int(offset_file)
        pending = 0
        for e in read_log(self.log_path, start):
            self.db.execute("INSERT INTO balances VALUES (?, ?, -1) ON CONFLICT(account) DO UPDATE SET balance = balance + ?",
                            (e["account"], e["amount"], e["amount"]))
            self.handled += 1
            pending += 1
            self._maybe_crash()                                   # crash after the write, before the offset commit
            if pending >= commit_every:
                with open(offset_file, "w") as f:
                    f.write(str(e["offset"] + 1))
                pending = 0
        if pending:
            with open(offset_file, "w") as f:
                f.write(str(e["offset"] + 1))

    # ------------------------------------------------------------------ TODO 1: idempotent writes
    def run_idempotent(self, commit_every: int = 7) -> None:
        """Same offset handling as run_at_least_once (offset file, committed every few events, so events WILL be
        replayed after a crash), but the balance update must be skipped if the account row's last_offset >= the event's
        offset; otherwise add the amount and set last_offset to the event's offset - in ONE statement/row write.
        Call self._maybe_crash() right after the write, as in run_at_least_once."""
        # TODO 1 (solution)
        offset_file = os.path.join(self.workdir, "consumer-offset.txt")
        start = _read_int(offset_file)
        pending = 0
        for e in read_log(self.log_path, start):
            self.db.execute(
                "INSERT INTO balances VALUES (?, ?, ?) ON CONFLICT(account) DO UPDATE SET "
                "balance = balance + excluded.balance, last_offset = excluded.last_offset "
                "WHERE balances.last_offset < excluded.last_offset",
                (e["account"], e["amount"], e["offset"]))
            self.handled += 1
            pending += 1
            self._maybe_crash()
            if pending >= commit_every:
                with open(offset_file, "w") as f:
                    f.write(str(e["offset"] + 1))
                pending = 0
        if pending:
            with open(offset_file, "w") as f:
                f.write(str(e["offset"] + 1))

    # ------------------------------------------------------------------ TODO 2: transactional state + offset
    def run_transactional(self, notify: bool = False) -> None:
        """Read the start offset from the `progress` table (0 if none). For each event, in ONE transaction: add the
        amount to the balance and set progress.next_offset = offset + 1. Call self._maybe_crash() INSIDE the
        transaction, just before COMMIT (so a crash rolls back that event's work). If notify is True, call
        self.notify(e) after the commit for events with amount >= 500."""
        # TODO 2 (solution)
        row = self.db.execute("SELECT next_offset FROM progress WHERE id = 0").fetchone()
        start = row[0] if row else 0
        for e in read_log(self.log_path, start):
            self.db.execute("BEGIN")
            try:
                self.db.execute("INSERT INTO balances VALUES (?, ?, ?) ON CONFLICT(account) DO UPDATE SET balance = balance + ?",
                                (e["account"], e["amount"], e["offset"], e["amount"]))
                self.db.execute("INSERT INTO progress VALUES (0, ?) ON CONFLICT(id) DO UPDATE SET next_offset = excluded.next_offset",
                                (e["offset"] + 1,))
                self.handled += 1
                self._maybe_crash()
                self.db.execute("COMMIT")
            except Crash:
                self.db.execute("ROLLBACK")
                raise
            if notify and e["amount"] >= 500:
                self.notify(e)

    # ------------------------------------------------------------------ TODO 3: idempotent side effect
    def notify(self, e: dict) -> None:
        """Send the email for this event at most once, even if notify() is called again for the same event after a
        crash and replay. Use the sent_notifications table as a deduplication record keyed by the event offset."""
        # TODO 3 (solution)
        cur = self.db.execute("INSERT OR IGNORE INTO sent_notifications VALUES (?)", (e["offset"],))
        if cur.rowcount == 1:
            self._send_email(e)


def run_with_crashes(workdir: str, log_path: str, mode: str, crashes: list[int], **kw) -> Processor:
    """Run `mode` repeatedly: each lifetime crashes after the given number of events; the last one runs to the end."""
    for c in crashes + [None]:
        p = Processor(workdir, log_path, crash_after=c)
        try:
            getattr(p, f"run_{mode}")(**kw)
            return p
        except Crash:
            p.db.close()
        except BaseException:
            p.db.close()            # e.g. an unfinished TODO: don't leave the database file locked
            raise
    raise AssertionError("unreachable")


if __name__ == "__main__":
    import tempfile
    for mode in ("at_least_once", "idempotent", "transactional"):
        with tempfile.TemporaryDirectory() as d:
            log = os.path.join(d, "payments.log")
            events = make_log(log)
            kw = {"notify": True} if mode == "transactional" else {}
            p = run_with_crashes(d, log, mode, crashes=[23, 40, 17, 61], **kw)
            ok = p.balances() == expected_balances(events)
            extra = sum(p.balances().values()) - sum(e["amount"] for e in events)
            print(f"{mode:<14}: balances correct? {ok}  (total off by {extra:+d})")
            if mode == "transactional":
                with open(p.notifications_path, encoding="utf-8") as f:
                    emails = f.read().splitlines()
                large = [e for e in events if e["amount"] >= 500]
                print(f"{'':<14}  {len(emails)} emails for {len(large)} large payments")
            p.db.close()
