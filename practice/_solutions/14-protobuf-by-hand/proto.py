"""Reference solution for exercise 14: Protocol Buffers encoding by hand."""


def encode_varint(n: int) -> bytes:
    if n < 0:
        n += 1 << 64            # protobuf int64: negative numbers use 10 bytes (two's complement)
    out = bytearray()
    while True:
        b = n & 0x7F
        n >>= 7
        if n:
            out.append(b | 0x80)
        else:
            out.append(b)
            return bytes(out)


def decode_varint(buf: bytes, pos: int) -> tuple[int, int]:
    result, shift = 0, 0
    while True:
        b = buf[pos]
        pos += 1
        result |= (b & 0x7F) << shift
        shift += 7
        if not b & 0x80:
            return result, pos


def encode_person(user_name: str, favorite_number: int | None, interests: list[str]) -> bytes:
    out = bytearray()
    name = user_name.encode()
    out += bytes([(1 << 3) | 2]) + encode_varint(len(name)) + name
    if favorite_number is not None:
        out += bytes([(2 << 3) | 0]) + encode_varint(favorite_number)
    for s in interests:
        b = s.encode()
        out += bytes([(3 << 3) | 2]) + encode_varint(len(b)) + b
    return bytes(out)


def decode_person(buf: bytes) -> dict:
    """Old-schema decoder: knows tags 1-3; skips anything else using the wire type."""
    person = {"user_name": None, "favorite_number": None, "interests": [], "skipped_tags": []}
    pos = 0
    while pos < len(buf):
        key, pos = decode_varint(buf, pos)
        tag, wire = key >> 3, key & 7
        if wire == 0:
            value, pos = decode_varint(buf, pos)
        elif wire == 2:
            length, pos = decode_varint(buf, pos)
            value = buf[pos:pos + length]
            pos += length
        elif wire == 1:
            value = buf[pos:pos + 8]; pos += 8
        elif wire == 5:
            value = buf[pos:pos + 4]; pos += 4
        else:
            raise ValueError(f"unsupported wire type {wire}")
        if tag == 1:
            person["user_name"] = value.decode()
        elif tag == 2:
            person["favorite_number"] = value
        elif tag == 3:
            person["interests"].append(value.decode())
        else:
            person["skipped_tags"].append(tag)
    return person
