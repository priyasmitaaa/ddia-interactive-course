"""Reference solution for exercise 21: version numbers (Figure 5-13) and version vectors."""


class SingleReplicaStore:
    """The algorithm on p. 184, for one key on one replica."""

    def __init__(self):
        self.counter = 0
        self.siblings: list[tuple[int, object]] = []      # (version, value) not yet overwritten

    def read(self):
        return self.counter, [v for _, v in self.siblings]

    def write(self, value, base_version):
        """base_version = version from the client's prior read (None = no prior read)."""
        self.counter += 1
        keep = [(ver, v) for ver, v in self.siblings if base_version is None or ver > base_version]
        self.siblings = keep + [(self.counter, value)]
        return self.read()


# ---------------------------------------------------------------------------
# Version vectors: a dict replica_id -> counter.
# ---------------------------------------------------------------------------
def compare(a: dict, b: dict) -> str:
    """'before' if a happened before b, 'after' if b before a, 'equal', or 'concurrent'."""
    keys = set(a) | set(b)
    a_le_b = all(a.get(k, 0) <= b.get(k, 0) for k in keys)
    b_le_a = all(b.get(k, 0) <= a.get(k, 0) for k in keys)
    if a_le_b and b_le_a:
        return "equal"
    if a_le_b:
        return "before"
    if b_le_a:
        return "after"
    return "concurrent"


def merge_vectors(a: dict, b: dict) -> dict:
    return {k: max(a.get(k, 0), b.get(k, 0)) for k in set(a) | set(b)}


class VVReplica:
    """One replica of one key. Stores siblings as (version_vector, value)."""

    def __init__(self, rid):
        self.rid = rid
        self.siblings: list[tuple[dict, object]] = []

    def context(self) -> dict:
        """The version vector summarising everything this replica has seen."""
        vv: dict = {}
        for v, _ in self.siblings:
            vv = merge_vectors(vv, v)
        return vv

    def read(self):
        return self.context(), [val for _, val in self.siblings]

    def write(self, value, context: dict):
        """Client writes `value`, having read `context` earlier (possibly from ANOTHER replica)."""
        new_vv = merge_vectors(context, self.context())
        new_vv[self.rid] = self.context().get(self.rid, 0) + 1
        # drop siblings the client had seen (they're <= its context); keep concurrent ones
        self.siblings = [(v, x) for v, x in self.siblings if compare(v, context) not in ("before", "equal")]
        self.siblings.append((new_vv, value))
        return self.read()

    def receive(self, siblings: list[tuple[dict, object]]):
        """Anti-entropy / replication: merge another replica's siblings into ours."""
        allv = self.siblings + siblings
        out = []
        for v, x in allv:
            dominated = any(compare(v, v2) == "before" for v2, _ in allv)
            if not dominated and not any(compare(v, v2) == "equal" for v2, _ in out):
                out.append((v, x))
        self.siblings = out
