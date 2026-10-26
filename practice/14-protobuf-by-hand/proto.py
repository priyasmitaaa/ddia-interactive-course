"""
Exercise 14 — Protocol Buffers encoding by hand (book pp. 113-117, Figure 4-4).

Schema:
    message Person {
      required string user_name       = 1;
      optional int64  favorite_number = 2;
      repeated string interests       = 3;
    }

Each field is written as:  key  value
    key = (field_tag << 3) | wire_type            (itself a varint; one byte for small tags)
    wire_type 0 = varint      (ints)
    wire_type 2 = length-delimited: varint length, then the bytes (strings, bytes, nested messages)
A repeated field simply repeats the same key once per element.

Run the tests:  python practice/14-protobuf-by-hand/test_proto.py
"""


def encode_varint(n: int) -> bytes:
    """TODO 1: 7 bits per byte, least-significant group first; set the top bit (0x80) on every
    byte except the last. 1337 -> b'\\xb9\\x0a'. (Negative int64: add 2**64 first.)"""
    raise NotImplementedError


def decode_varint(buf: bytes, pos: int) -> tuple[int, int]:
    """TODO 1: read a varint starting at buf[pos]; return (value, position after it)."""
    raise NotImplementedError


def encode_person(user_name: str, favorite_number: int | None, interests: list[str]) -> bytes:
    """TODO 2: encode the three fields in tag order. Omit favorite_number if None."""
    raise NotImplementedError


def decode_person(buf: bytes) -> dict:
    """TODO 3: decode with THIS (old) schema. Return
        {"user_name": str, "favorite_number": int|None, "interests": [str], "skipped_tags": [int]}
    For any tag other than 1-3, use the wire type to work out how many bytes to skip
    (0: a varint; 2: length + bytes; 1: 8 bytes; 5: 4 bytes) and record the tag in skipped_tags.
    That skipping is exactly what makes protobuf forward compatible."""
    raise NotImplementedError
