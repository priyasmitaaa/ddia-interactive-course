"""Exercise 39 - "think like a vertex": a Pregel / bulk synchronous parallel engine (pp. 411-414).

In each SUPERSTEP the engine calls compute(vertex, messages) for every vertex that has incoming messages (or, in the
first superstep, for every vertex). compute may update the vertex's value (kept in memory between supersteps) and
send messages to other vertices; those messages are delivered in the NEXT superstep. A vertex that returns without
sending anything and receives nothing is halted. The job ends when no messages are in flight.

Vertices are assigned to "machines" by a partitioner; we count messages that would cross the network.

  TODO 1  run_pregel                 (the engine)
  TODO 2  sssp_compute               (single-source shortest paths)
  TODO 3  components_compute         (connected components by propagating the smallest vertex id)

PageRank is given as a worked example. Everything is checked against ordinary single-machine algorithms.
"""
from __future__ import annotations

import heapq
import random
from collections import defaultdict, deque
from dataclasses import dataclass, field
from typing import Callable


@dataclass
class Graph:
    n: int
    out: dict[int, list[tuple[int, float]]] = field(default_factory=lambda: defaultdict(list))

    def add(self, a: int, b: int, w: float = 1.0, undirected: bool = False) -> None:
        self.out[a].append((b, w))
        if undirected:
            self.out[b].append((a, w))


def community_graph(n_communities: int = 20, size: int = 50, p_in: float = 0.15, p_out: float = 0.002, seed: int = 1) -> Graph:
    """Dense communities with sparse links between them (like social networks). Vertex ids are contiguous per
    community, so a range partitioner happens to keep communities together; a hash partitioner scatters them."""
    rnd = random.Random(seed)
    g = Graph(n_communities * size)
    for a in range(g.n):
        for b in range(a + 1, g.n):
            same = a // size == b // size
            if rnd.random() < (p_in if same else p_out):
                g.add(a, b, w=rnd.randint(1, 9), undirected=True)
    return g


class Context:
    """What compute() can see and do."""

    def __init__(self, superstep: int, graph: Graph, values: dict):
        self.superstep = superstep
        self.graph = graph
        self.values = values
        self.outbox: list[tuple[int, object]] = []

    def send(self, to: int, msg) -> None:
        self.outbox.append((to, msg))


Compute = Callable[[int, list, Context], None]


def run_pregel(graph: Graph, compute: Compute, init: Callable[[int], object], partition: Callable[[int], int],
               max_supersteps: int = 100) -> tuple[dict, dict]:
    """Run BSP supersteps until no messages are in flight (or max_supersteps). Returns (values, stats) where stats
    has 'supersteps', 'messages' (total) and 'cross_machine' (messages whose sender and receiver are on different
    partitions)."""
    # TODO 1:
    #  - values = {v: init(v)}; inbox = {v: []}; stats = {"supersteps": 0, "messages": 0, "cross_machine": 0}
    #  - for step in range(max_supersteps):
    #      active vertices = ALL vertices in step 0, afterwards only those with messages in their inbox
    #      ctx = Context(step, graph, values); for each active v: reset ctx.outbox, call compute(v, inbox[v], ctx),
    #      then move every (to, msg) in ctx.outbox into NEXT superstep's inbox, counting messages and
    #      cross-machine messages (partition(v) != partition(to))
    #      swap in the new inbox (this is the barrier); record stats["supersteps"]; stop if no messages are in flight
    #  - return values, stats
    raise NotImplementedError


# ------------------------------------------------------------------ vertex programs

SOURCE = 0


def sssp_compute(v: int, messages: list, ctx: Context) -> None:
    """Shortest distance from SOURCE. In superstep 0 only the source acts (distance 0). Afterwards, a vertex takes the
    minimum of its incoming candidate distances; ONLY if that improves its value does it update and send
    value + edge weight to each neighbour. Otherwise it does nothing (and so halts)."""
    # TODO 2: see the docstring. ctx.values[v] is this vertex's current distance; ctx.graph.out[v] lists (to, weight).
    raise NotImplementedError


def components_compute(v: int, messages: list, ctx: Context) -> None:
    """Connected components (undirected graph): every vertex starts with its own id as label and repeatedly adopts the
    smallest label it hears about. In superstep 0, every vertex sends its label to its neighbours; afterwards, a vertex
    whose label decreased sends the new label on. Vertices that learn nothing new stay quiet."""
    # TODO 3: see the docstring. ctx.values[v] is this vertex's current label.
    raise NotImplementedError


def pagerank_compute(v: int, messages: list, ctx: Context, d: float = 0.85, iterations: int = 20) -> None:
    """Worked example (given): every vertex is active for a fixed number of supersteps."""
    if ctx.superstep > 0:
        ctx.values[v] = (1 - d) / ctx.graph.n + d * sum(messages)
    if ctx.superstep < iterations:
        out = ctx.graph.out[v]
        for to, _ in out:
            ctx.send(to, ctx.values[v] / len(out))
        if not out:                               # dangling vertex: treat as a self-link so no rank is lost
            ctx.send(v, ctx.values[v])


# ------------------------------------------------------------------ single-machine references (given)

def dijkstra(g: Graph, src: int) -> dict[int, float]:
    dist = {v: float("inf") for v in range(g.n)}
    dist[src] = 0.0
    pq = [(0.0, src)]
    while pq:
        d, v = heapq.heappop(pq)
        if d > dist[v]:
            continue
        for to, w in g.out[v]:
            if d + w < dist[to]:
                dist[to] = d + w
                heapq.heappush(pq, (d + w, to))
    return dist


def bfs_components(g: Graph) -> dict[int, int]:
    label = {}
    for s in range(g.n):
        if s in label:
            continue
        q = deque([s])
        label[s] = s
        while q:
            v = q.popleft()
            for to, _ in g.out[v]:
                if to not in label:
                    label[to] = s
                    q.append(to)
    return label


if __name__ == "__main__":
    g = community_graph()
    print(f"graph: {g.n} vertices, {sum(len(e) for e in g.out.values())} directed edges, 20 communities")
    partitioners = {"hash(vertex) % 4": lambda v: (v * 2654435761) % 4, "range (by id block)": lambda v: v * 4 // g.n}
    for pname, part in partitioners.items():
        dist, s1 = run_pregel(g, sssp_compute, lambda v: float("inf"), part)
        assert dist == dijkstra(g, SOURCE), "SSSP must match Dijkstra"
        comp, s2 = run_pregel(g, components_compute, lambda v: v, part)
        assert comp == bfs_components(g), "components must match BFS"
        print(f"\npartitioner: {pname}")
        print(f"  SSSP       : {s1['supersteps']:3d} supersteps, {s1['messages']:6d} messages, {s1['cross_machine']:6d} cross-machine")
        print(f"  components : {s2['supersteps']:3d} supersteps, {s2['messages']:6d} messages, {s2['cross_machine']:6d} cross-machine")
    pr, s3 = run_pregel(g, pagerank_compute, lambda v: 1 / g.n, partitioners["hash(vertex) % 4"], max_supersteps=21)
    top = sorted(pr, key=pr.get, reverse=True)[:3]
    print(f"\nPageRank: {s3['supersteps']} supersteps, {s3['messages']} messages; top vertices {top}, sum of ranks {sum(pr.values()):.3f}")
