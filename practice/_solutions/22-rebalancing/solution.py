"""Reference solution for exercise 22. Run: python practice/_solutions/22-rebalancing/solution.py"""
import bisect
import importlib.util
import pathlib

spec = importlib.util.spec_from_file_location(
    "rebalance", pathlib.Path(__file__).resolve().parents[2] / "22-rebalancing" / "rebalance.py")
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)


def add_node(assignment):
    new = len(set(assignment))
    out = list(assignment)
    target = len(out) // (new + 1)
    for _ in range(target):
        counts = {}
        for o in out:
            counts[o] = counts.get(o, 0) + 1
        busiest = max((n for n in counts if n != new), key=lambda n: counts[n])
        idx = next(i for i, o in enumerate(out) if o == busiest)
        out[idx] = new
    return out


def build_ring(n_nodes, v):
    pts = sorted((m.h(f"node{n}-token{t}"), n) for n in range(n_nodes) for t in range(v))
    return [p for p, _ in pts], [o for _, o in pts]


def ring_owner(key, ring):
    tokens, owners = ring
    i = bisect.bisect_left(tokens, m.h(key))
    return owners[i % len(tokens)]


m.add_node, m.build_ring, m.ring_owner = add_node, build_ring, ring_owner
src = pathlib.Path(m.__file__).read_text(encoding="utf-8").split('if __name__ == "__main__":', 1)[1]
exec("if True:" + src, vars(m))
