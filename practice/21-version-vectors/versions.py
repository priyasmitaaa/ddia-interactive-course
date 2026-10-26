"""
Exercise 21 — Detecting concurrent writes: version numbers and version vectors (book pp. 178-185).

Part 1 implements the single-replica algorithm of Figure 5-13 / p. 184.
Part 2 generalises it to several replicas with version vectors.

Run the tests:  python practice/21-version-vectors/test_versions.py
"""


# ---------------------------------------------------------------------------
# Part 1: one key, one replica (p. 184).
#  - The server keeps a version counter, incremented on every write.
#  - A read returns the current counter and ALL values not yet overwritten (siblings).
#  - A write carries the version from the client's prior read; the server drops every sibling with
#    version <= that number (the client has merged them into its new value) and keeps the others
#    (they're concurrent). A write with no version (None) overwrites nothing.
# ---------------------------------------------------------------------------
class SingleReplicaStore:
    def __init__(self):
        self.counter = 0
        self.siblings: list[tuple[int, object]] = []      # (version, value)

    def read(self):
        return self.counter, [v for _, v in self.siblings]

    def write(self, value, base_version):
        """TODO 1: implement the rule above. Return self.read() (writes respond like reads)."""
        raise NotImplementedError


# ---------------------------------------------------------------------------
# Part 2: version vectors — dicts mapping replica id -> counter, e.g. {"A": 2, "B": 1}.
# A missing entry means 0.
# ---------------------------------------------------------------------------
def compare(a: dict, b: dict) -> str:
    """TODO 2: return 'before' (a happened before b: every entry of a <= b, and they differ),
    'after', 'equal', or 'concurrent' (neither is <= the other)."""
    raise NotImplementedError


def merge_vectors(a: dict, b: dict) -> dict:
    """Given: element-wise maximum."""
    return {k: max(a.get(k, 0), b.get(k, 0)) for k in set(a) | set(b)}


class VVReplica:
    """One replica of one key. Stores siblings as (version_vector, value)."""

    def __init__(self, rid):
        self.rid = rid
        self.siblings: list[tuple[dict, object]] = []

    def context(self) -> dict:
        """Given: the merge of all sibling vectors — everything this replica has seen."""
        vv: dict = {}
        for v, _ in self.siblings:
            vv = merge_vectors(vv, v)
        return vv

    def read(self):
        return self.context(), [val for _, val in self.siblings]

    def write(self, value, context: dict):
        """TODO 3: a client writes `value`, having previously read `context` (maybe from another replica).
        New vector = merge(context, my context) with MY entry incremented by one.
        Drop siblings whose vector is 'before' or 'equal' to the client's context (it saw them);
        keep the rest (concurrent). Append the new sibling. Return self.read()."""
        raise NotImplementedError

    def receive(self, siblings: list[tuple[dict, object]]):
        """TODO 4: merge siblings from another replica (replication / anti-entropy):
        keep every sibling (from either side) that isn't 'before' some other sibling, without duplicates."""
        raise NotImplementedError
