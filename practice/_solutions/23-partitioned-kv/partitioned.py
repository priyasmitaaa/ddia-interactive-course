"""Reference solution for exercise 23: a partitioned key-value store."""
import hashlib


def h(s: str) -> int:
    return int.from_bytes(hashlib.md5(s.encode()).digest()[:8], "big")


class WrongNode(Exception):
    """Raised by a node asked about a partition it doesn't own. Carries the node's metadata epoch."""

    def __init__(self, epoch):
        super().__init__(f"wrong node (cluster metadata epoch {epoch})")
        self.epoch = epoch


class Metadata:
    """Plays the role of ZooKeeper: the authoritative partition -> node assignment, with an epoch
    that increases on every change."""

    def __init__(self, n_partitions, node_ids):
        self.n_partitions = n_partitions
        self.assignment = {p: node_ids[p % len(node_ids)] for p in range(n_partitions)}
        self.epoch = 1

    def snapshot(self):
        return self.epoch, dict(self.assignment)

    def move(self, partition, node_id):
        self.assignment[partition] = node_id
        self.epoch += 1


class Node:
    def __init__(self, node_id, metadata):
        self.id = node_id
        self.meta = metadata
        self.partitions: dict[int, dict] = {}            # partition -> {key: record}
        self.indexes: dict[int, dict] = {}               # partition -> {(field, value): set(keys)}  (LOCAL index)

    def _check(self, p):
        if self.meta.assignment[p] != self.id:
            raise WrongNode(self.meta.epoch)

    def put(self, p, key, record: dict):
        self._check(p)
        part = self.partitions.setdefault(p, {})
        idx = self.indexes.setdefault(p, {})
        old = part.get(key)
        if old:
            for f, v in old.items():
                idx.get((f, v), set()).discard(key)
        part[key] = record
        for f, v in record.items():
            idx.setdefault((f, v), set()).add(key)

    def get(self, p, key):
        self._check(p)
        return self.partitions.get(p, {}).get(key)

    def query_local(self, field, value):
        """Secondary-index lookup over every partition THIS node owns."""
        out = {}
        for p, idx in self.indexes.items():
            if self.meta.assignment[p] == self.id:
                for k in idx.get((field, value), ()):
                    out[k] = self.partitions[p][k]
        return out


class Cluster:
    def __init__(self, n_partitions=32, n_nodes=3):
        ids = [f"n{i}" for i in range(n_nodes)]
        self.meta = Metadata(n_partitions, ids)
        self.nodes = {i: Node(i, self.meta) for i in ids}

    def partition_of(self, key):
        return h(key) % self.meta.n_partitions

    def add_node(self):
        new_id = f"n{len(self.nodes)}"
        new = Node(new_id, self.meta)
        self.nodes[new_id] = new
        target = self.meta.n_partitions // len(self.nodes)
        moved = []
        for _ in range(target):
            counts = {}
            for n in self.meta.assignment.values():
                counts[n] = counts.get(n, 0) + 1
            busiest = max((n for n in counts if n != new_id), key=lambda n: counts[n])
            p = next(p for p, n in sorted(self.meta.assignment.items()) if n == busiest)
            src = self.nodes[busiest]
            # 1. copy the partition's data and index to the new node, 2. switch ownership, 3. drop old copy
            new.partitions[p] = dict(src.partitions.get(p, {}))
            new.indexes[p] = {k: set(v) for k, v in src.indexes.get(p, {}).items()}
            self.meta.move(p, new_id)
            src.partitions.pop(p, None)
            src.indexes.pop(p, None)
            moved.append(p)
        return moved


class Router:
    """A partition-aware client/routing tier with a CACHED copy of the assignment."""

    def __init__(self, cluster):
        self.cluster = cluster
        self.epoch, self.assignment = cluster.meta.snapshot()
        self.refreshes = 0

    def refresh(self):
        self.epoch, self.assignment = self.cluster.meta.snapshot()
        self.refreshes += 1

    def _call(self, key, fn):
        p = self.cluster.partition_of(key)
        for _ in range(2):
            node = self.cluster.nodes[self.assignment[p]]
            try:
                return fn(node, p)
            except WrongNode:
                self.refresh()                    # our routing info was stale: fetch it again and retry
        raise RuntimeError("routing failed twice")

    def put(self, key, record):
        return self._call(key, lambda node, p: node.put(p, key, record))

    def get(self, key):
        return self._call(key, lambda node, p: node.get(p, key))

    def query(self, field, value):
        """Scatter/gather over a document-partitioned (local) index: ask every node, merge."""
        out = {}
        for node in self.cluster.nodes.values():
            out.update(node.query_local(field, value))
        return out, len(self.cluster.nodes)


def salted_keys(key, n):
    """Split a hot key into n sub-keys (p. 197)."""
    return [f"{i:02d}#{key}" for i in range(n)]
