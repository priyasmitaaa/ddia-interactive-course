"""Reference solution for exercise 15: a tiny Avro encoder/decoder with schema resolution."""


class SchemaError(Exception):
    pass


def zigzag(n: int) -> int:
    return (n << 1) ^ (n >> 63)


def unzigzag(z: int) -> int:
    return (z >> 1) ^ -(z & 1)


def write_long(n: int) -> bytes:
    z = zigzag(n) & ((1 << 64) - 1)
    out = bytearray()
    while True:
        b = z & 0x7F
        z >>= 7
        out.append(b | (0x80 if z else 0))
        if not z:
            return bytes(out)


def read_long(buf: bytes, pos: int) -> tuple[int, int]:
    z, shift = 0, 0
    while True:
        b = buf[pos]; pos += 1
        z |= (b & 0x7F) << shift
        shift += 7
        if not b & 0x80:
            return unzigzag(z), pos


def encode_value(value, typ) -> bytes:
    if isinstance(typ, list):                       # union: branch index, then value
        for i, branch in enumerate(typ):
            if (branch == "null" and value is None) or (branch != "null" and value is not None):
                return write_long(i) + encode_value(value, branch)
        raise SchemaError(f"value {value!r} matches no union branch {typ}")
    if typ == "null":
        return b""
    if typ in ("long", "int"):
        return write_long(value)
    if typ == "string":
        b = value.encode()
        return write_long(len(b)) + b
    if isinstance(typ, dict) and typ["type"] == "array":
        if not value:
            return b"\x00"
        return write_long(len(value)) + b"".join(encode_value(v, typ["items"]) for v in value) + b"\x00"
    raise SchemaError(f"unsupported type {typ}")


def decode_value(buf, pos, typ):
    if isinstance(typ, list):
        i, pos = read_long(buf, pos)
        return decode_value(buf, pos, typ[i])
    if typ == "null":
        return None, pos
    if typ in ("long", "int"):
        return read_long(buf, pos)
    if typ == "string":
        n, pos = read_long(buf, pos)
        return buf[pos:pos + n].decode(), pos + n
    if isinstance(typ, dict) and typ["type"] == "array":
        items = []
        while True:
            n, pos = read_long(buf, pos)
            if n == 0:
                return items, pos
            for _ in range(n):
                v, pos = decode_value(buf, pos, typ["items"])
                items.append(v)
    raise SchemaError(f"unsupported type {typ}")


def encode(record: dict, schema: dict) -> bytes:
    return b"".join(encode_value(record[f["name"]], f["type"]) for f in schema["fields"])


def decode(buf: bytes, writer: dict, reader: dict) -> dict:
    written, pos = {}, 0
    for f in writer["fields"]:                      # 1. decode exactly as the writer wrote it
        written[f["name"]], pos = decode_value(buf, pos, f["type"])
    out = {}
    for f in reader["fields"]:                      # 2. translate into the reader's schema, by name
        if f["name"] in written:
            out[f["name"]] = written[f["name"]]
        elif "default" in f:
            out[f["name"]] = f["default"]
        else:
            raise SchemaError(f"reader expects field {f['name']!r}, writer didn't write it, and it has no default")
    return out                                       # writer-only fields are simply ignored
