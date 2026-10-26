"""
Exercise 26 — Lab: an MVCC database with snapshot isolation, then serializable snapshot isolation
(book pp. 228-233 and 252-257; Figures 7-7, 7-10, 7-11).

Data layout (like PostgreSQL, Figure 7-7): each key has a list of Versions, each with
created_by (txid) and deleted_by (txid or None). An update = mark the old visible version deleted
by me + append a new version created by me. Nothing is overwritten in place.

Run the tests:  python practice/26-mvcc-ssi/test_mvcc.py
"""
import itertools


class SerializationFailure(Exception):
    """The transaction was aborted by the database and should be retried."""


class Version:
    __slots__ = ("value", "created_by", "deleted_by")

    def __init__(self, value, created_by):
        self.value, self.created_by, self.deleted_by = value, created_by, None


class Database:
    def __init__(self, serializable=False):
        self.serializable = serializable                 # False = snapshot isolation, True = SSI
        self.rows: dict[str, list[Version]] = {}
        self.status: dict[int, str] = {0: "committed"}  # txid -> "active" / "committed" / "aborted"
        self.commit_order: dict[int, int] = {0: 0}      # txid -> commit sequence number
        self._txids = itertools.count(1)                 # transaction IDs, always increasing
        self._seq = itertools.count(1)                   # one logical clock for starts and commits

    def load(self, data: dict):
        """Given: initial data, created by the (committed) transaction 0."""
        for k, v in data.items():
            self.rows[k] = [Version(v, 0)]

    def begin(self):
        return Transaction(self, next(self._txids))


class Transaction:
    def __init__(self, db: Database, txid: int):
        self.db, self.txid = db, txid
        db.status[txid] = "active"
        # visibility rule 1 needs to know who was in progress when we started:
        self.in_progress_at_start = {t for t, s in db.status.items() if s == "active" and t != txid}
        self.start_seq = next(db._seq)
        self.writes: dict[str, object] = {}
        self.read_keys: set[str] = set()       # for SSI
        self.read_prefixes: list[str] = []     # for SSI (predicate reads, i.e. scans)

    # ------------------------------------------------------------------ visibility
    def _sees_tx(self, t) -> bool:
        """TODO 1: may this transaction see the effects (creations or deletions) of transaction t?
        Yes for my own txid. Otherwise apply the rules on p. 232:
          1. ignore t if it was in progress when I started;   2. ignore t if it aborted;
          3. ignore t if t > my txid (started after me);       4. otherwise: visible if committed."""
        raise NotImplementedError

    def _visible(self, v: Version) -> bool:
        """TODO 1: a version is visible if I see its creator, and it's not deleted — or deleted by
        someone I don't see."""
        raise NotImplementedError

    def _read_raw(self, key):
        """Given: newest visible version's value, or None."""
        for v in reversed(self.db.rows.get(key, [])):
            if self._visible(v):
                return v.value
        return None

    # ------------------------------------------------------------------ API
    def read(self, key):
        self._check_active()
        self.read_keys.add(key)
        return self._read_raw(key)

    def scan(self, prefix):
        """Given: a predicate read — all visible (key, value) whose key starts with prefix."""
        self._check_active()
        self.read_prefixes.append(prefix)
        out = {}
        for k in self.db.rows:
            if k.startswith(prefix):
                v = self._read_raw(k)
                if v is not None:
                    out[k] = v
        return out

    def write(self, key, value):
        """TODO 2: mark the currently visible version(s) of key as deleted_by me (only if not already
        deleted), append Version(value, my txid), and remember the write in self.writes."""
        raise NotImplementedError

    def commit(self):
        """TODO 3 (snapshot isolation, first-committer-wins): find transactions that committed AFTER
        I started (commit_order[t] > self.start_seq). If any of them created a version of a key I
        wrote, abort myself (self._abort()) and raise SerializationFailure — a lost update.
        TODO 4 (SSI, only if self.db.serializable and I wrote something): if any of those concurrent,
        already-committed transactions wrote a key that I READ (read_keys) or that matches one of my
        scans (read_prefixes), my premise is outdated: abort and raise SerializationFailure.
        (Read-only transactions never need to abort: they saw a consistent snapshot.)
        Otherwise: status -> "committed" and commit_order[txid] = next(self.db._seq)."""
        raise NotImplementedError

    def abort(self):
        self._check_active()
        self._abort()

    def _abort(self):
        """Given: undo my deletions and remove my versions."""
        db = self.db
        db.status[self.txid] = "aborted"
        for k in self.writes:
            for v in db.rows[k]:
                if v.deleted_by == self.txid:
                    v.deleted_by = None
            db.rows[k] = [v for v in db.rows[k] if v.created_by != self.txid]

    def _check_active(self):
        if self.db.status[self.txid] != "active":
            raise RuntimeError(f"transaction {self.txid} is {self.db.status[self.txid]}")
