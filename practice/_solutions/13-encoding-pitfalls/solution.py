"""Reference solution for exercise 13. Run: python practice/_solutions/13-encoding-pitfalls/solution.py"""
import base64
import importlib.util
import json
import pathlib

spec = importlib.util.spec_from_file_location(
    "pitfalls", pathlib.Path(__file__).resolve().parents[2] / "13-encoding-pitfalls" / "pitfalls.py")
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)


def encode_tweet(tweet_id):
    return json.dumps({"id": tweet_id, "id_str": str(tweet_id)})


def decode_tweet_safely(obj):
    return int(obj["id_str"]) if "id_str" in obj else int(obj["id"])


def base64_json_size(raw):
    return len(json.dumps({"data": base64.b64encode(raw).decode("ascii")}).encode())


def naive_line(fields):
    return ",".join(fields)


m.encode_tweet, m.decode_tweet_safely = encode_tweet, decode_tweet_safely
m.base64_json_size, m.naive_line = base64_json_size, naive_line
for part in (m.part_a, m.part_b, m.part_c):
    part()
