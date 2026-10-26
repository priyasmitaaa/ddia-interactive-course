"""MiniKV milestone 1 - binary record encoding with checksums and schema evolution (Chapters 3 and 4).

Every record written to the WAL or an SSTable is framed as:

    [crc32 of payload: 4 bytes big-endian][payload length: varint][payload]

Payload, format version 2:
    version (1 byte = 2) | flags (1 byte: bit0 = tombstone, bit1 = has timestamp)
    key length (varint) | key (utf-8) | value length (varint) | value (utf-8, absent for tombstones)
    timestamp (varint, only if flag bit1)

Format version 1 (older files): version (1 byte = 1) | key len | key | value len | value  - no flags, no timestamp,
no tombstones. A version-2 reader must still read version-1 records (backward compatibility, Chapter 4).

A crash can leave a half-written record at the end of a file. decode_stream stops at the first record that is
truncated or fails its checksum and reports how many bytes were valid, so the WAL can be truncated there (Chapter 3).
"""
from __future__ import annotations

import struct
import zlib
from dataclasses import dataclass


@dataclass(frozen=True)
class Record:
    key: str
    value: str | None          # None = tombstone (deleted)
    ts: int | None = None


def encode_varint(n: int) -> bytes:
    """Unsigned LEB128, as in Protocol Buffers (Chapter 4)."""
    if n < 0:
        raise ValueError("varint must be non-negative")
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
    """Returns (value, new_position). Raises IndexError if the buffer ends mid-varint."""
    shift = result = 0
    while True:
        b = buf[pos]
        pos += 1
        result |= (b & 0x7F) << shift
        if not b & 0x80:
            return result, pos
        shift += 7


def _payload_v2(r: Record) -> bytes:
    flags = (1 if r.value is None else 0) | (2 if r.ts is not None else 0)
    k = r.key.encode()
    out = bytearray([2, flags]) + encode_varint(len(k)) + k
    if r.value is not None:
        v = r.value.encode()
        out += encode_varint(len(v)) + v
    if r.ts is not None:
        out += encode_varint(r.ts)
    return bytes(out)


def _payload_v1(r: Record) -> bytes:
    if r.value is None or r.ts is not None:
        raise ValueError("format v1 cannot express tombstones or timestamps")
    k, v = r.key.encode(), r.value.encode()
    return bytes([1]) + encode_varint(len(k)) + k + encode_varint(len(v)) + v


def frame(payload: bytes) -> bytes:
    return struct.pack(">I", zlib.crc32(payload)) + encode_varint(len(payload)) + payload


def encode_record(r: Record, version: int = 2) -> bytes:
    return frame(_payload_v2(r) if version == 2 else _payload_v1(r))


def decode_payload(p: bytes) -> Record:
    """Decode a v1 or v2 payload (see the module docstring)."""
    ver = p[0]
    if ver == 1:
        klen, pos = decode_varint(p, 1)
        key = p[pos:pos + klen].decode()
        pos += klen
        vlen, pos = decode_varint(p, pos)
        return Record(key, p[pos:pos + vlen].decode())
    if ver == 2:
        flags = p[1]
        klen, pos = decode_varint(p, 2)
        key = p[pos:pos + klen].decode()
        pos += klen
        value = None
        if not flags & 1:
            vlen, pos = decode_varint(p, pos)
            value = p[pos:pos + vlen].decode()
            pos += vlen
        ts = None
        if flags & 2:
            ts, pos = decode_varint(p, pos)
        return Record(key, value, ts)
    raise ValueError(f"unknown record format version {ver}")


def decode_stream(buf: bytes) -> tuple[list[tuple[int, Record]], int]:
    """Decode consecutive framed records. Returns ([(offset_of_record, record), ...], valid_length): decoding stops at
    the first truncated record or checksum mismatch, and valid_length is the byte offset where the good data ends."""
    out = []
    pos = 0
    while pos < len(buf):
        start = pos
        try:
            if pos + 4 > len(buf):
                break
            (crc,) = struct.unpack(">I", buf[pos:pos + 4])
            length, p2 = decode_varint(buf, pos + 4)
            payload = buf[p2:p2 + length]
            if len(payload) < length or zlib.crc32(payload) != crc:
                break
            out.append((start, decode_payload(payload)))
            pos = p2 + length
        except IndexError:
            break
    return out, pos                      # pos only advances past fully valid records
