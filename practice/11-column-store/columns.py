"""
Exercise 11 — Row-oriented vs column-oriented storage, bitmaps and run-length encoding
(book pp. 93-98).

We write the same fact table to disk twice: once row by row, once one file per column,
then run the same analytic query against both and count bytes read.

Run:  python practice/11-column-store/columns.py
"""
import array
import os
import random
import shutil
import struct
import tempfile
import time

N_ROWS = 400_000
N_COLS = 20                       # a real fact table has 100+; 20 keeps files laptop-sized
COLS = ["date_key", "product_sk", "store_sk", "quantity"] + [f"attr{i}" for i in range(N_COLS - 4)]
ROW = struct.Struct(f"<{N_COLS}i")  # every value is a 4-byte int, for simplicity

rand = random.Random(11)


def generate():
    """Rows in insertion (time) order. product_sk has only 200 distinct values."""
    for i in range(N_ROWS):
        yield [140101 + i * 365 // N_ROWS, rand.randrange(200), rand.randrange(50), rand.randint(1, 5)] + \
              [rand.randrange(1_000_000) for _ in range(N_COLS - 4)]


def write_row_file(path, rows):
    with open(path, "wb") as f:
        for r in rows:
            f.write(ROW.pack(*r))


def write_column_files(directory, rows):
    cols = [array.array("i") for _ in COLS]
    for r in rows:
        for c, v in zip(cols, r):
            c.append(v)
    for name, c in zip(COLS, cols):
        with open(os.path.join(directory, name + ".col"), "wb") as f:
            c.tofile(f)


# The query: total quantity sold for products 7, 8 and 9 (like Example 3-1, simplified).
WANTED = {7, 8, 9}


def query_rows(path):
    """Given: scan the row file. Must read EVERY byte, even though only 2 columns are needed."""
    total, bytes_read = 0, 0
    with open(path, "rb") as f:
        data = f.read()
        bytes_read = len(data)
    for (date, product, store, qty, *_rest) in ROW.iter_unpack(data):
        if product in WANTED:
            total += qty
    return total, bytes_read


# ---------------------------------------------------------------------------
# TASK 1: answer the same query from the column files, reading ONLY product_sk.col and
# quantity.col. Use array.array("i") and .fromfile(f, n) or .frombytes(f.read()).
# Rows line up: the k-th entry of every column file belongs to row k.
# ---------------------------------------------------------------------------
def query_columns(directory):
    raise NotImplementedError
    return total, bytes_read


# ---------------------------------------------------------------------------
# TASK 2: bitmap index + run-length encoding (Figure 3-11).
# bitmap(column, value) -> a Python int whose bit k is 1 if row k has that value.
# rle(bitmap_int, n) -> list of alternating run lengths, starting with a run of ZEROS
# (which may be 0), e.g. bits 0,0,1,1,1,0 -> [2, 3, 1].
# Then answer "product_sk IN (7,8,9) AND store_sk = 3" with bitwise | and &.
# ---------------------------------------------------------------------------
def bitmap(column, value):
    raise NotImplementedError


def rle(bits, n):
    raise NotImplementedError


# ---------------------------------------------------------------------------
# TASK 3: sort order and compression. Count runs (stretches of equal consecutive values) in each
# column before and after sorting all rows by (product_sk, store_sk). Fewer runs = better RLE.
# ---------------------------------------------------------------------------
def count_runs(values):
    raise NotImplementedError


if __name__ == "__main__":
    tmp = tempfile.mkdtemp(prefix="colstore-")
    try:
        rows = list(generate())
        write_row_file(os.path.join(tmp, "rows.bin"), rows)
        write_column_files(tmp, rows)
        t = time.perf_counter(); total, b = query_rows(os.path.join(tmp, "rows.bin"))
        print(f"row store:    total={total:,}  read {b/1e6:6.1f} MB  in {time.perf_counter()-t:.2f}s")
        try:
            t = time.perf_counter(); total2, b2 = query_columns(tmp)
            print(f"column store: total={total2:,}  read {b2/1e6:6.1f} MB  in {time.perf_counter()-t:.2f}s  (same answer: {total == total2})")
        except NotImplementedError:
            print("Task 1 not implemented yet")

        try:
            product = [r[1] for r in rows]
            store = [r[2] for r in rows]
            wanted = bitmap(product, 7) | bitmap(product, 8) | bitmap(product, 9)
            both = wanted & bitmap(store, 3)
            print(f"\nbitmaps: product IN (7,8,9) matches {bin(wanted).count('1'):,} rows; "
                  f"AND store=3 matches {bin(both).count('1'):,} rows")
            runs = rle(bitmap(product, 7), N_ROWS)
            print(f"RLE of bitmap(product=7): {len(runs):,} numbers instead of {N_ROWS:,} bits; first runs: {runs[:6]}")
        except NotImplementedError:
            print("Task 2 not implemented yet")

        try:
            print("\nruns per column (fewer = compresses better):")
            srt = sorted(rows, key=lambda r: (r[1], r[2]))
            for i, name in enumerate(COLS[:5]):
                print(f"  {name:<11} insertion order: {count_runs([r[i] for r in rows]):>8,}   "
                      f"sorted by (product_sk, store_sk): {count_runs([r[i] for r in srt]):>8,}")
        except NotImplementedError:
            print("Task 3 not implemented yet")
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
