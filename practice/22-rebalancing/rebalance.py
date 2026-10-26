"""
Exercise 22 — Rebalancing strategies: how much data moves, and how even is the load? (book pp. 201-204)

Run:  python practice/22-rebalancing/rebalance.py
"""
import bisect
import hashlib

N_KEYS = 100_000
KEYS = [f"user:{i}" for i in range(N_KEYS)]


def h(s: str) -> int:
    """A stable 64-bit hash (Python's built-in hash() is randomised per process)."""
    return int.from_bytes(hashlib.md5(s.encode()).digest()[:8], "big")


# ---------------------------------------------------------------------------
# Strategy A (given): hash mod N — "how not to do it".
# ---------------------------------------------------------------------------
def mod_n_owner(key: str, n_nodes: int) -> int:
    return h(key) % n_nodes


# ---------------------------------------------------------------------------
# Strategy B (YOUR TASK): fixed number of partitions (Figure 6-6).
# Keys map to one of P partitions forever: partition = h(key) % P.
# Partitions are assigned to nodes. When a node is added, it steals partitions from the existing
# nodes until every node has floor(P/N) or ceil(P/N) partitions — moving as few as possible.
# ---------------------------------------------------------------------------
P = 256


def initial_assignment(n_nodes: int) -> list[int]:
    """Given: partition p -> node p % n_nodes."""
    return [p % n_nodes for p in range(P)]


def add_node(assignment: list[int]) -> list[int]:
    """TODO: return a NEW assignment with one more node (id = current number of nodes) that has
    stolen partitions from the most loaded nodes until the distribution is as even as possible.
    Only partitions that move to the new node may change owner."""
    raise NotImplementedError


def fixed_owner(key: str, assignment: list[int]) -> int:
    return assignment[h(key) % P]


# ---------------------------------------------------------------------------
# Strategy C (YOUR TASK): a hash ring with V tokens ("virtual nodes") per node.
# Each node places V tokens at positions h(f"node{n}-token{v}") on the 64-bit ring. A key belongs to
# the node owning the first token clockwise from h(key) (wrapping around). With V = 1 this is the
# pre-1.2 Cassandra scheme; more tokens per node give a more even distribution.
# ---------------------------------------------------------------------------
def build_ring(n_nodes: int, v: int) -> tuple[list[int], list[int]]:
    """TODO: return (sorted token positions, owner node of each position)."""
    raise NotImplementedError


def ring_owner(key: str, ring: tuple[list[int], list[int]]) -> int:
    """TODO: use bisect to find the first token >= h(key); wrap to index 0 past the end."""
    raise NotImplementedError


def report(name, before, after, n_after):
    moved = sum(1 for a, b in zip(before, after) if a != b)
    load = [0] * n_after
    for o in after:
        load[o] += 1
    print(f"  {name:<34} moved {moved / N_KEYS:6.1%} of keys   busiest node {max(load) / (N_KEYS / n_after):4.2f}x fair share")


if __name__ == "__main__":
    n = 10
    print(f"{N_KEYS:,} keys, growing the cluster from {n} to {n + 1} nodes (ideal: move {1 / (n + 1):.1%})\n")
    report("hash mod N", [mod_n_owner(k, n) for k in KEYS], [mod_n_owner(k, n + 1) for k in KEYS], n + 1)
    try:
        a = initial_assignment(n)
        b = add_node(a)
        assert len(b) == P and max(b) == n
        report(f"fixed {P} partitions", [fixed_owner(k, a) for k in KEYS], [fixed_owner(k, b) for k in KEYS], n + 1)
    except NotImplementedError:
        print("  fixed partitions: not implemented yet")
    try:
        for v in (1, 8, 64):
            r1, r2 = build_ring(n, v), build_ring(n + 1, v)
            report(f"hash ring, {v} token(s) per node", [ring_owner(k, r1) for k in KEYS], [ring_owner(k, r2) for k in KEYS], n + 1)
    except NotImplementedError:
        print("  hash ring: not implemented yet")
