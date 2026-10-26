"""Reference solution for exercise 11. Run: python practice/_solutions/11-column-store/solution.py"""
import array
import importlib.util
import os
import pathlib

spec = importlib.util.spec_from_file_location(
    "columns", pathlib.Path(__file__).resolve().parents[2] / "11-column-store" / "columns.py")
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)


def query_columns(directory):
    cols, bytes_read = {}, 0
    for name in ("product_sk", "quantity"):
        a = array.array("i")
        with open(os.path.join(directory, name + ".col"), "rb") as f:
            data = f.read()
        bytes_read += len(data)
        a.frombytes(data)
        cols[name] = a
    total = sum(q for p, q in zip(cols["product_sk"], cols["quantity"]) if p in m.WANTED)
    return total, bytes_read


def bitmap(column, value):
    bits = 0
    for k, v in enumerate(column):
        if v == value:
            bits |= 1 << k
    return bits


def rle(bits, n):
    runs, cur, run = [], 0, 0
    for k in range(n):
        b = (bits >> k) & 1
        if b == cur:
            run += 1
        else:
            runs.append(run); cur = b; run = 1
    runs.append(run)
    return runs


def count_runs(values):
    return sum(1 for i, v in enumerate(values) if i == 0 or v != values[i - 1])


m.query_columns, m.bitmap, m.rle, m.count_runs = query_columns, bitmap, rle, count_runs
src = pathlib.Path(m.__file__).read_text(encoding="utf-8").split('if __name__ == "__main__":', 1)[1]
exec("if True:" + src, vars(m))
