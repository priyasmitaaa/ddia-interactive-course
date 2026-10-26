"""
Exercise 15 — Avro: writer's schema, reader's schema, and resolution (book pp. 118-123).

Schemas are Python dicts in Avro's JSON style:
    {"type": "record", "name": "Person", "fields": [
        {"name": "userName", "type": "string"},
        {"name": "favoriteNumber", "type": ["null", "long"], "default": None},
        {"name": "interests", "type": {"type": "array", "items": "string"}}]}

Avro binary encoding (Figure 4-5): values are simply concatenated in schema order —
no tags, no field names, no type markers.
    long/int : zigzag, then varint            (1337 -> f2 14)
    string   : long length, then UTF-8 bytes
    union    : long branch index, then the value in that branch's type
    array    : long count, the items, then 0   (empty array: just 0)
    null     : nothing at all

Run the tests:  python practice/15-avro-resolution/test_avro.py
"""


class SchemaError(Exception):
    pass


def zigzag(n: int) -> int:
    """Given: maps 0,-1,1,-2,2,... to 0,1,2,3,4,... so small negatives stay small."""
    return (n << 1) ^ (n >> 63)


def unzigzag(z: int) -> int:
    return (z >> 1) ^ -(z & 1)


def write_long(n: int) -> bytes:
    """TODO 1: zigzag(n), then varint (7 bits per byte, top bit = more bytes follow)."""
    raise NotImplementedError


def read_long(buf: bytes, pos: int) -> tuple[int, int]:
    """TODO 1: inverse of write_long. Return (value, new position)."""
    raise NotImplementedError


def encode_value(value, typ) -> bytes:
    """TODO 2: encode one value of the given Avro type (see the table at the top)."""
    raise NotImplementedError


def decode_value(buf: bytes, pos: int, typ):
    """TODO 3: decode one value; return (value, new position)."""
    raise NotImplementedError


def encode(record: dict, schema: dict) -> bytes:
    """Given: fields in schema order, concatenated."""
    return b"".join(encode_value(record[f["name"]], f["type"]) for f in schema["fields"])


def decode(buf: bytes, writer: dict, reader: dict) -> dict:
    """TODO 4: schema resolution.
    Step 1: decode ALL fields using the WRITER's schema (it's the only way to parse the bytes).
    Step 2: build the result in the READER's schema, matching fields BY NAME:
       - in both: take the decoded value
       - only in the reader: use the reader field's "default"; if it has none -> raise SchemaError
       - only in the writer: ignore it"""
    raise NotImplementedError
