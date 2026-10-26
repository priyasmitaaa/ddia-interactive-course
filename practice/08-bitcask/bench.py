"""
Benchmark your store (exercise 08). Reports throughput and latency percentiles — Chapter 1 meets Chapter 3.

    python practice/08-bitcask/bench.py              # your kvstore.py
    python practice/08-bitcask/bench.py --solution   # reference solution
    python practice/08-bitcask/bench.py --sync       # fsync after every write: see the price of durability
"""
import importlib.util
import math
import pathlib
import random
import shutil
import sys
import tempfile
import time

HERE = pathlib.Path(__file__).resolve().parent
target = (HERE.parent / "_solutions" / "08-bitcask" / "kvstore.py") if "--solution" in sys.argv else (HERE / "kvstore.py")
spec = importlib.util.spec_from_file_location("kvstore", target)
kv = importlib.util.module_from_spec(spec)
spec.loader.exec_module(kv)

N_KEYS, N_WRITES, N_READS = 2_000, 20_000, 20_000
SYNC = "--sync" in sys.argv


def pct(sorted_vals, p):
    return sorted_vals[min(len(sorted_vals) - 1, max(0, math.ceil(p / 100 * len(sorted_vals)) - 1))]


def report(name, lat):
    lat.sort()
    total = sum(lat)
    print(f"{name:<8} {len(lat)/total:>10,.0f} ops/s   p50={pct(lat,50)*1e6:7.1f}us  p99={pct(lat,99)*1e6:8.1f}us  p99.9={pct(lat,99.9)*1e6:9.1f}us")


if __name__ == "__main__":
    d = tempfile.mkdtemp(prefix="bench-")
    rand = random.Random(0)
    try:
        db = kv.Bitcask(d, max_segment_bytes=256 * 1024, sync=SYNC)
        n_w = N_WRITES // 20 if SYNC else N_WRITES
        lat = []
        for i in range(n_w):
            k = f"key-{rand.randrange(N_KEYS)}".encode()
            v = (b"x" * rand.randrange(20, 200))
            t = time.perf_counter(); db.put(k, v); lat.append(time.perf_counter() - t)
        report("writes", lat)
        lat = []
        for i in range(N_READS):
            k = f"key-{rand.randrange(N_KEYS)}".encode()
            t = time.perf_counter(); db.get(k); lat.append(time.perf_counter() - t)
        report("reads", lat)
        before = db.disk_usage()
        t = time.perf_counter()
        try:
            db.compact()
            print(f"compact  {before:,} -> {db.disk_usage():,} bytes in {time.perf_counter()-t:.2f}s")
        except NotImplementedError:
            print("compact  not implemented")
        db.close()
        t = time.perf_counter()
        kv.Bitcask(d).close()
        print(f"restart  rebuilt keydir in {(time.perf_counter()-t)*1000:.1f} ms")
    finally:
        shutil.rmtree(d, ignore_errors=True)
