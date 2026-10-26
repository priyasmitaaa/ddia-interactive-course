"""Reference solution for exercise 26: an in-memory MVCC database with snapshot isolation and SSI."""
import itertools


class SerializationFailure(Exception):
    """The transaction was aborted by the database and should be retried."""


class Version:
    __slots__ = ("value", "created_by", "deleted_by")

    def __init__(self, value, created_by):
        self.value, self.created_by, self.deleted_by = value, created_by, None


class Database:
    def __init__(self, serializable=False):
        self.serializable = serializable
        self.rows: dict[str, list[Version]] = {}
        self.status: dict[int, str] = {0: "committed"}          # txid -> active/committed/aborted
        self.commit_order: dict[int, int] = {0: 0}              # txid -> commit sequence number
        self._txids = itertools.count(1)
        self._seq = itertools.count(1)
        self.load_txid = 0

    def load(self, data: dict):
        for k, v in data.items():
            self.rows[k] = [Version(v, 0)]

    def begin(self):
        return Transaction(self, next(self._txids))


class Transaction:
    def __init__(self, db: Database, txid: int):
        self.db, self.txid = db, txid
        db.status[txid] = "active"
        self.in_progress_at_start = {t for t, s in db.status.items() if s == "active" and t != txid}
        self.start_seq = next(db._seq)
        self.writes: dict[str, object] = {}
        self.read_keys: set[str] = set()
        self.read_prefixes: list[str] = []

    # ---- visibility (p. 232) ----
    def _sees_tx(self, t):
        if t == self.txid:
            return True
        if t in self.in_progress_at_start:          # rule 1
            return False
        if self.db.status.get(t) == "aborted":      # rule 2
            return False
        if t > self.txid:                           # rule 3
            return False
        return self.db.status.get(t) == "committed"

    def _visible(self, v: Version):
        if not self._sees_tx(v.created_by):
            return False
        return v.deleted_by is None or not self._sees_tx(v.deleted_by)

    def _read_raw(self, key):
        for v in reversed(self.db.rows.get(key, [])):
            if self._visible(v):
                return v.value
        return None

    # ---- API ----
    def read(self, key):
        self._check_active()
        self.read_keys.add(key)
        return self._read_raw(key)

    def scan(self, prefix):
        """All visible (key, value) whose key starts with prefix — a predicate read."""
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
        self._check_active()
        versions = self.db.rows.setdefault(key, [])
        for v in versions:
            if v.deleted_by is None and self._visible(v):
                v.deleted_by = self.txid
        versions.append(Version(value, self.txid))
        self.writes[key] = value

    def commit(self):
        self._check_active()
        db = self.db
        concurrent_committed = [t for t, s in db.status.items()
                                if s == "committed" and t != self.txid and db.commit_order[t] > self.start_seq]
        # first-committer-wins: a concurrent transaction already committed a write to the same key
        for t in concurrent_committed:
            if any(v.created_by == t for k in self.writes for v in db.rows[k]):
                self._abort()
                raise SerializationFailure(f"lost update: tx {t} wrote the same key concurrently")
        if db.serializable and self.writes:
            for t in concurrent_committed:
                their = {k for k, vs in db.rows.items() for v in vs if v.created_by == t}
                if their & self.read_keys or any(k.startswith(p) for k in their for p in self.read_prefixes):
                    self._abort()
                    raise SerializationFailure(f"tx {t} committed a write to data this transaction read (outdated premise)")
        db.status[self.txid] = "committed"
        db.commit_order[self.txid] = next(db._seq)

    def abort(self):
        self._check_active()
        self._abort()

    def _abort(self):
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
