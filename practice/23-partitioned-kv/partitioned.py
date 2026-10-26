"""
Exercise 23 — Lab: a partitioned key-value store (book pp. 191-208).

Architecture (in one process, to keep it simple):
    Metadata  — like ZooKeeper: the authoritative partition -> node assignment + an epoch number
    Node      — stores the partitions it owns, each with a LOCAL (document-partitioned) secondary index
    Cluster   — creates nodes; adds a node and rebalances by moving WHOLE partitions
    Router    — a partition-aware routing tier with a CACHED copy of the assignment

Keys map to a FIXED number of partitions: partition = h(key) % n_partitions. That never changes;
only the assignment of partitions to nodes does.

Run the tests:  python practice/23-partitioned-kv/test_partitioned.py
"""
import hashlib


def h(s: str) -> int:
    """Stable 64-bit hash."""
    return int.from_bytes(hashlib.md5(s.encode()).digest()[:8], "big")


class WrongNode(Exception):
    """Raised by a node asked about a partition it doesn't own."""

    def __init__(self, epoch):
        super().__init__(f"wrong node (cluster metadata epoch {epoch})")
        self.epoch = epoch


class Metadata:
    """Given. The authoritative assignment; the epoch increases on every change."""

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
        self.partitions: dict[int, dict] = {}       # partition -> {key: record (a dict of fields)}
        self.indexes: dict[int, dict] = {}          # partition -> {(field, value): set of keys}

    def _check(self, p):
        """Given: refuse requests for partitions this node doesn't own."""
        if self.meta.assignment[p] != self.id:
            raise WrongNode(self.meta.epoch)

    def put(self, p, key, record: dict):
        """TODO 1: store the record in partition p AND maintain the local secondary index:
        remove the key from the index entries of its OLD record (if any), add it for the new one.
        Call self._check(p) first."""
        raise NotImplementedError

    def get(self, p, key):
        self._check(p)
        return self.partitions.get(p, {}).get(key)

    def query_local(self, field, value):
        """Given: secondary-index lookup across the partitions this node owns. Returns {key: record}."""
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
        """TODO 2: hash partitioning with a fixed number of partitions."""
        raise NotImplementedError

    def add_node(self):
        """TODO 3: add node f"n{len(self.nodes)}" and rebalance (Figure 6-6): repeatedly take one
        partition from the currently busiest OTHER node until the new node has
        n_partitions // len(nodes) partitions. For each moved partition: copy its data AND its index
        to the new node, call self.meta.move(p, new_id), then delete the old copy.
        Return the list of moved partition numbers."""
        raise NotImplementedError


class Router:
    def __init__(self, cluster):
        self.cluster = cluster
        self.epoch, self.assignment = cluster.meta.snapshot()     # cached; may go stale!
        self.refreshes = 0

    def refresh(self):
        self.epoch, self.assignment = self.cluster.meta.snapshot()
        self.refreshes += 1

    def _call(self, key, fn):
        """TODO 4: find the key's partition, look up its node in the CACHED assignment and call
        fn(node, partition). If the node raises WrongNode, our cache is stale: refresh() and retry once."""
        raise NotImplementedError

    def put(self, key, record):
        return self._call(key, lambda node, p: node.put(p, key, record))

    def get(self, key):
        return self._call(key, lambda node, p: node.get(p, key))

    def query(self, field, value):
        """TODO 5: scatter/gather — ask EVERY node's query_local and merge the results.
        Return (results_dict, number_of_nodes_contacted)."""
        raise NotImplementedError


def salted_keys(key, n):
    """TODO 6: split a hot key into n distinct sub-keys with a two-digit prefix, e.g. "07#celebrity:42" (p. 197)."""
    raise NotImplementedError
