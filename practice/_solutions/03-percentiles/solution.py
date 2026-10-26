"""Reference solution for exercise 03. Run: python practice/_solutions/03-percentiles/solution.py"""
import importlib.util
import math
import pathlib
import random

spec = importlib.util.spec_from_file_location(
    "latency", pathlib.Path(__file__).resolve().parents[2] / "03-percentiles" / "latency.py")
lat = importlib.util.module_from_spec(spec)
spec.loader.exec_module(lat)


def percentile(values, p):
    s = sorted(values)
    rank = math.ceil(p / 100 * len(s))
    return s[max(0, min(len(s) - 1, rank - 1))]


def histogram(values):
    h = {}
    for v in values:
        b = int(v)
        h[b] = h.get(b, 0) + 1
    return h


def merge(h1, h2):
    out = dict(h1)
    for b, c in h2.items():
        out[b] = out.get(b, 0) + c
    return out


def percentile_from_histogram(hist, p):
    total = sum(hist.values())
    target = math.ceil(p / 100 * total)
    seen = 0
    for b in sorted(hist):
        seen += hist[b]
        if seen >= target:
            return float(b)
    return float(max(hist))


def fraction_of_slow_pages(backend, n_calls, pages=10_000, seed=3):
    rand = random.Random(seed)
    p99 = percentile(backend, 99)
    slow = sum(1 for _ in range(pages) if max(rand.choice(backend) for _ in range(n_calls)) > p99)
    return slow / pages


# plug into the exercise module and run its main block
lat.percentile, lat.histogram, lat.merge = percentile, histogram, merge
lat.percentile_from_histogram, lat.fraction_of_slow_pages = percentile_from_histogram, fraction_of_slow_pages
src = (pathlib.Path(lat.__file__).read_text(encoding="utf-8")).split('if __name__ == "__main__":', 1)[1]
exec("if True:" + src, vars(lat))
