"""
Exercise 13 — Pitfalls of textual encodings (book pp. 109-111).

Run:  python practice/13-encoding-pitfalls/pitfalls.py
"""
import base64
import csv
import io
import json

# ---------------------------------------------------------------------------
# Part A — big numbers in JSON.
# JavaScript (and any parser that maps JSON numbers to IEEE-754 doubles) can only represent
# integers exactly up to 2**53. We imitate such a parser with parse_int=float.
# ---------------------------------------------------------------------------
def js_like_loads(s: str):
    return json.loads(s, parse_int=float)


TWEET_ID = 1203940218741645313  # a 64-bit ID larger than 2**53


def encode_tweet(tweet_id: int) -> str:
    """TASK A: include the id twice, as a number "id" and as a decimal string "id_str" (p. 110)."""
    raise NotImplementedError


def decode_tweet_safely(obj: dict) -> int:
    """TASK A: prefer id_str so the exact value survives a float-based parser."""
    raise NotImplementedError


def part_a():
    parsed = js_like_loads(json.dumps({"id": TWEET_ID}))
    print(f"Part A: sent id={TWEET_ID}, a JS-like parser read {int(parsed['id'])}, "
          f"equal={int(parsed['id']) == TWEET_ID}")
    t = decode_tweet_safely(js_like_loads(encode_tweet(TWEET_ID)))
    assert t == TWEET_ID, t
    print("        id_str workaround recovers the exact id:", t)


# ---------------------------------------------------------------------------
# Part B — binary data in JSON needs Base64.
# ---------------------------------------------------------------------------
def base64_json_size(raw: bytes) -> int:
    """TASK B: return the size in bytes of json.dumps({"data": <base64 text of raw>})."""
    raise NotImplementedError


def part_b():
    raw = bytes(range(256)) * 117   # 29,952 bytes of binary data
    n = base64_json_size(raw)
    print(f"Part B: {len(raw):,} raw bytes -> {n:,} bytes as Base64 in JSON ({n / len(raw):.2f}x)")


# ---------------------------------------------------------------------------
# Part C — CSV is vague (p. 111).
# A naive writer joins fields with commas. TASK C: write naive_line(fields) that does exactly
# that, then compare what a real CSV parser reads back from the naive line vs from csv.writer.
# ---------------------------------------------------------------------------
ROW = ["42", 'The "Best" Café, London', "line one\nline two", "3.50"]


def naive_line(fields) -> str:
    raise NotImplementedError


def part_c():
    naive = naive_line(ROW) + "\n"
    proper = io.StringIO()
    csv.writer(proper).writerow(ROW)
    for label, text in [("naive", naive), ("csv module", proper.getvalue())]:
        rows = list(csv.reader(io.StringIO(text)))
        print(f"Part C: {label:<10} -> parsed {len(rows)} row(s); first row has {len(rows[0])} fields; "
              f"round-trips correctly: {rows == [ROW]}")


if __name__ == "__main__":
    for part in (part_a, part_b, part_c):
        try:
            part()
        except NotImplementedError:
            print(f"{part.__name__}: not implemented yet")
