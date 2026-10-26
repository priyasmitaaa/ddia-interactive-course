"""Tests for Exercise 39. Run: python practice/39-pregel/test_pregel.py"""
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pregel import (Graph, bfs_components, community_graph, components_compute, dijkstra, pagerank_compute,  # noqa: E402
                    run_pregel, sssp_compute)

ONE = lambda v: 0  # noqa: E731  (everything on one machine)


def line_graph(n):
    g = Graph(n)
    for i in range(n - 1):
        g.add(i, i + 1, 1.0, undirected=True)
    return g


class T1_Engine(unittest.TestCase):
    def test_messages_arrive_next_superstep(self):
        seen = []

        def compute(v, msgs, ctx):
            seen.append((ctx.superstep, v, sorted(msgs)))
            if ctx.superstep == 0 and v == 0:
                ctx.send(1, "hello")

        _, stats = run_pregel(line_graph(3), compute, lambda v: None, ONE)
        self.assertIn((1, 1, ["hello"]), seen)
        self.assertNotIn(1, [v for s, v, _ in seen if s == 1 and v != 1], "only vertices with mail run after step 0")
        self.assertEqual(stats["supersteps"], 2)

    def test_counts_cross_machine_messages(self):
        def compute(v, msgs, ctx):
            if ctx.superstep == 0:
                for to, _ in ctx.graph.out[v]:
                    ctx.send(to, 1)

        _, stats = run_pregel(line_graph(4), compute, lambda v: None, lambda v: v % 2)
        self.assertEqual(stats["messages"], 6)
        self.assertEqual(stats["cross_machine"], 6, "on a line, every neighbour is on the other machine")


class T2_SSSP(unittest.TestCase):
    def test_matches_dijkstra(self):
        g = community_graph(n_communities=6, size=30, seed=3)
        dist, stats = run_pregel(g, sssp_compute, lambda v: float("inf"), ONE)
        self.assertEqual(dist, dijkstra(g, 0))
        self.assertLess(stats["supersteps"], 100, "must halt when no distance improves")


class T3_Components(unittest.TestCase):
    def test_matches_bfs(self):
        g = community_graph(n_communities=8, size=20, p_out=0.0005, seed=5)
        comp, _ = run_pregel(g, components_compute, lambda v: v, ONE)
        self.assertEqual(comp, bfs_components(g))

    def test_line_needs_n_supersteps(self):
        comp, stats = run_pregel(line_graph(10), components_compute, lambda v: v, ONE)
        self.assertEqual(set(comp.values()), {0})
        self.assertGreaterEqual(stats["supersteps"], 9, "the smallest label travels one hop per superstep")


class T4_Partitioning(unittest.TestCase):
    def test_locality_reduces_network_traffic(self):
        g = community_graph()
        _, h = run_pregel(g, components_compute, lambda v: v, lambda v: (v * 2654435761) % 4)
        _, r = run_pregel(g, components_compute, lambda v: v, lambda v: v * 4 // g.n)
        self.assertEqual(h["messages"], r["messages"], "partitioning doesn't change the algorithm's messages")
        self.assertLess(r["cross_machine"] * 2, h["cross_machine"], "community-aware placement crosses far less")

    def test_pagerank_example_runs(self):
        g = community_graph(n_communities=4, size=25)
        pr, _ = run_pregel(g, pagerank_compute, lambda v: 1 / g.n, ONE, max_supersteps=21)
        self.assertAlmostEqual(sum(pr.values()), 1.0, places=3)


if __name__ == "__main__":
    unittest.main(verbosity=2)
