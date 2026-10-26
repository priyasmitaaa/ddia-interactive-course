"""
Project 1 benchmark: your KVStore vs SQLite (a B-tree) on the same workload, with latency percentiles,
the cost of durability, and the effect of background compaction on read tail latency.

    python practice/17-project1-kv/bench.py              # your kvstore2.py
    python practice/17-project1-kv/bench.py --solution   # reference
"""
import importlib.util
import math
import pathlib
import random
import shutil
import sqlite3
import sys
import tempfile
import time

HERE = pathlib.Path(__file__).resolve().parent
target = (HERE.parent / "_solutions" / "17-project1-kv" / "kvstore2.py") if "--solution" in sys.argv else (HERE / "kvstore2.py")
spec = importlib.util.spec_from_file_location("kvstore2", target)
kv = importlib.util.module_from_spec(spec)
spec.loader.exec_module(kv)

N_KEYS, N_OPS = 5_000, 30_000


def pct(v, p):
    return v[min(len(v) - 1, max(0, math.ceil(p / 100 * len(v)) - 1))]


def report(name, lat):
    lat = sorted(lat)
    print(f"  {name:<40} {len(lat)/sum(lat):>9,.0f} ops/s  p50={pct(lat,50)*1e6:7.1f}us  "
          f"p99={pct(lat,99)*1e6:8.1f}us  p99.9={pct(lat,99.9)*1e6:9.1f}us")


def workload(seed):
    r = random.Random(seed)
    return [(f"key-{r.randrange(N_KEYS)}".encode(), b"v" * r.randrange(20, 200)) for _ in range(N_OPS)]


def bench_kv(d):
    db = kv.KVStore(d, max_segment_bytes=256 * 1024)
    lat = []
    for k, v in workload(1):
        t = time.perf_counter(); db.put(k, v); lat.append(time.perf_counter() - t)
    report("KVStore put (no fsync)", lat)
    reads = [k for k, _ in workload(2)]
    lat = []
    for k in reads:
        t = time.perf_counter(); db.get(k); lat.append(time.perf_counter() - t)
    report("KVStore get", lat)
    try:
        for k, v in workload(3)[:20_000]:
            db.put(k, v)                      # create garbage so compaction has work
        th = db.compact(background=True)
        lat = []
        while th.is_alive() and len(lat) < 200_000:
            k = reads[len(lat) % len(reads)]
            t = time.perf_counter(); db.get(k); lat.append(time.perf_counter() - t)
        th.join()
        report("KVStore get DURING background compaction", lat)
    except NotImplementedError:
        print("  (background compaction not implemented yet)")
    try:
        items = workload(4)[:2000]
        t = time.perf_counter()
        for i in range(0, len(items), 100):
            db.write_batch(items[i:i + 100])
        print(f"  {'KVStore write_batch(100), durable':<40} {len(items)/(time.perf_counter()-t):>9,.0f} ops/s")
    except NotImplementedError:
        print("  (write_batch not implemented yet)")
    db.close()
    sdb = kv.KVStore(d + "-sync", sync=True)
    lat = []
    for k, v in workload(5)[:300]:
        t = time.perf_counter(); sdb.put(k, v); lat.append(time.perf_counter() - t)
    report("KVStore put, fsync every write", lat)
    sdb.close()


def bench_sqlite(d):
    db = sqlite3.connect(d + "/bench.sqlite", isolation_level=None)
    db.execute("PRAGMA journal_mode=WAL")
    db.execute("PRAGMA synchronous=OFF")
    db.execute("CREATE TABLE kv (k BLOB PRIMARY KEY, v BLOB)")
    lat = []
    for k, v in workload(1):
        t = time.perf_counter(); db.execute("INSERT OR REPLACE INTO kv VALUES (?, ?)", (k, v)); lat.append(time.perf_counter() - t)
    report("SQLite (B-tree) upsert, synchronous=OFF", lat)
    lat = []
    for k, _ in workload(2):
        t = time.perf_counter(); db.execute("SELECT v FROM kv WHERE k = ?", (k,)).fetchone(); lat.append(time.perf_counter() - t)
    report("SQLite get", lat)
    db.close()


if __name__ == "__main__":
    d = tempfile.mkdtemp(prefix="p1bench-")
    try:
        print(f"{N_OPS:,} operations over {N_KEYS:,} keys\n")
        bench_kv(d)
        bench_sqlite(d)
    finally:
        shutil.rmtree(d, ignore_errors=True)
        shutil.rmtree(d + "-sync", ignore_errors=True)
