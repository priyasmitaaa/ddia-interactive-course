/**
 * Real encoders for the book's Person record (Example 4-1) in six formats. Each returns a list of
 * byte "segments" labelled by role, so the UI can colour them. For the book's example record they
 * reproduce Figures 4-1 to 4-5 byte for byte (checked in tests/encoders.test.ts).
 */
export interface Person { userName: string; favoriteNumber: number | null; interests: string[] }
export type Role = 'type' | 'tag' | 'length' | 'name' | 'data' | 'end';
export interface Seg { bytes: number[]; role: Role; note: string }

const utf8 = (s: string) => Array.from(new TextEncoder().encode(s));

function varint(n: bigint): number[] {
  const out: number[] = [];
  let v = n;
  do {
    let b = Number(v & 0x7fn);
    v >>= 7n;
    if (v > 0n) b |= 0x80;
    out.push(b);
  } while (v > 0n);
  return out;
}
const zigzag = (n: number) => { const b = BigInt(n); return b >= 0n ? b << 1n : ((-b) << 1n) - 1n; };
const be = (n: number | bigint, bytes: number) => {
  let v = BigInt.asUintN(bytes * 8, BigInt(n));
  const out = new Array(bytes).fill(0);
  for (let i = bytes - 1; i >= 0; i--) { out[i] = Number(v & 0xffn); v >>= 8n; }
  return out;
};

export function encodeJSON(p: Person): Seg[] {
  const obj: Record<string, unknown> = { userName: p.userName };
  if (p.favoriteNumber !== null) obj.favoriteNumber = p.favoriteNumber;
  obj.interests = p.interests;
  return [{ bytes: utf8(JSON.stringify(obj)), role: 'data', note: 'textual JSON, field names included' }];
}

export function encodeMsgPack(p: Person): Seg[] {
  const segs: Seg[] = [];
  const str = (s: string, role: Role, note: string) => {
    const b = utf8(s);
    if (b.length < 32) segs.push({ bytes: [0xa0 | b.length], role: 'type', note: `string, length ${b.length}` });
    else if (b.length < 256) segs.push({ bytes: [0xd9, b.length], role: 'type', note: `str8, length ${b.length}` });
    else segs.push({ bytes: [0xda, ...be(b.length, 2)], role: 'type', note: `str16, length ${b.length}` });
    segs.push({ bytes: b, role, note });
  };
  const int = (n: number) => {
    if (n >= 0 && n < 128) segs.push({ bytes: [n], role: 'data', note: `positive fixint ${n}` });
    else if (n < 0 && n >= -32) segs.push({ bytes: [n & 0xff], role: 'data', note: `negative fixint ${n}` });
    else if (n >= 0 && n < 256) segs.push({ bytes: [0xcc, n], role: 'data', note: `uint8 ${n}` });
    else if (n >= 0 && n < 65536) segs.push({ bytes: [0xcd, ...be(n, 2)], role: 'data', note: `uint16 ${n}` });
    else if (n >= 0 && n < 2 ** 32) segs.push({ bytes: [0xce, ...be(n, 4)], role: 'data', note: `uint32 ${n}` });
    else segs.push({ bytes: [0xd3, ...be(n, 8)], role: 'data', note: `int64 ${n}` });
  };
  segs.push({ bytes: [0x80 | 3], role: 'type', note: 'object with 3 entries' });
  str('userName', 'name', 'field name "userName"');
  str(p.userName, 'data', `"${p.userName}"`);
  str('favoriteNumber', 'name', 'field name "favoriteNumber"');
  if (p.favoriteNumber === null) segs.push({ bytes: [0xc0], role: 'data', note: 'nil' });
  else int(p.favoriteNumber);
  str('interests', 'name', 'field name "interests"');
  segs.push({ bytes: [0x90 | p.interests.length], role: 'type', note: `array, ${p.interests.length} entries` });
  for (const s of p.interests) str(s, 'data', `"${s}"`);
  return segs;
}

export function encodeThriftBinary(p: Person): Seg[] {
  const segs: Seg[] = [];
  const s = (tag: number, v: string) => {
    const b = utf8(v);
    segs.push({ bytes: [0x0b, ...be(tag, 2)], role: 'tag', note: `type 11 (string), field tag ${tag}` });
    segs.push({ bytes: be(b.length, 4), role: 'length', note: `length ${b.length}` });
    segs.push({ bytes: b, role: 'data', note: `"${v}"` });
  };
  s(1, p.userName);
  if (p.favoriteNumber !== null) {
    segs.push({ bytes: [0x0a, ...be(2, 2)], role: 'tag', note: 'type 10 (i64), field tag 2' });
    segs.push({ bytes: be(p.favoriteNumber, 8), role: 'data', note: `${p.favoriteNumber} as 8-byte integer` });
  }
  segs.push({ bytes: [0x0f, ...be(3, 2)], role: 'tag', note: 'type 15 (list), field tag 3' });
  segs.push({ bytes: [0x0b, ...be(p.interests.length, 4)], role: 'type', note: `item type 11 (string), ${p.interests.length} items` });
  for (const v of p.interests) {
    const b = utf8(v);
    segs.push({ bytes: be(b.length, 4), role: 'length', note: `length ${b.length}` });
    segs.push({ bytes: b, role: 'data', note: `"${v}"` });
  }
  segs.push({ bytes: [0x00], role: 'end', note: 'end of struct' });
  return segs;
}

export function encodeThriftCompact(p: Person): Seg[] {
  const segs: Seg[] = [];
  let last = 0;
  const hdr = (tag: number, type: number, label: string) => {
    const delta = tag - last;
    last = tag;
    segs.push({ bytes: [(delta << 4) | type], role: 'tag', note: `field tag += ${delta}, type ${type} (${label}) — packed in one byte` });
  };
  const str = (v: string) => {
    const b = utf8(v);
    segs.push({ bytes: varint(BigInt(b.length)), role: 'length', note: `length ${b.length} (varint)` });
    segs.push({ bytes: b, role: 'data', note: `"${v}"` });
  };
  hdr(1, 8, 'string');
  str(p.userName);
  if (p.favoriteNumber !== null) {
    hdr(2, 6, 'i64');
    segs.push({ bytes: varint(zigzag(p.favoriteNumber)), role: 'data', note: `${p.favoriteNumber} as zigzag varint` });
  } else last = 2;
  hdr(3, 9, 'list');
  const n = p.interests.length;
  segs.push({ bytes: n < 15 ? [(n << 4) | 8] : [0xf8, ...varint(BigInt(n))], role: 'type', note: `${n} list items, item type 8 (string)` });
  for (const v of p.interests) str(v);
  segs.push({ bytes: [0x00], role: 'end', note: 'end of struct' });
  return segs;
}

export function encodeProtobuf(p: Person): Seg[] {
  const segs: Seg[] = [];
  const str = (tag: number, v: string) => {
    const b = utf8(v);
    segs.push({ bytes: [(tag << 3) | 2], role: 'tag', note: `field tag ${tag}, wire type 2 (length-delimited)` });
    segs.push({ bytes: varint(BigInt(b.length)), role: 'length', note: `length ${b.length}` });
    segs.push({ bytes: b, role: 'data', note: `"${v}"` });
  };
  str(1, p.userName);
  if (p.favoriteNumber !== null) {
    segs.push({ bytes: [(2 << 3) | 0], role: 'tag', note: 'field tag 2, wire type 0 (varint)' });
    segs.push({ bytes: varint(BigInt.asUintN(64, BigInt(p.favoriteNumber))), role: 'data', note: `${p.favoriteNumber} as varint` });
  }
  for (const v of p.interests) str(3, v); // repeated: same tag appears again
  return segs;
}

export function encodeAvro(p: Person): Seg[] {
  const segs: Seg[] = [];
  const str = (v: string) => {
    const b = utf8(v);
    segs.push({ bytes: varint(zigzag(b.length)), role: 'length', note: `length ${b.length} (zigzag varint)` });
    segs.push({ bytes: b, role: 'data', note: `"${v}"` });
  };
  str(p.userName);
  if (p.favoriteNumber === null) segs.push({ bytes: [0x00], role: 'type', note: 'union branch 0 (null)' });
  else {
    segs.push({ bytes: [0x02], role: 'type', note: 'union branch 1 (long, not null)' });
    segs.push({ bytes: varint(zigzag(p.favoriteNumber)), role: 'data', note: `${p.favoriteNumber} as zigzag varint` });
  }
  if (p.interests.length) {
    segs.push({ bytes: varint(zigzag(p.interests.length)), role: 'length', note: `${p.interests.length} array items follow` });
    for (const v of p.interests) str(v);
  }
  segs.push({ bytes: [0x00], role: 'end', note: 'end of array' });
  return segs;
}

export const FORMATS = [
  { id: 'json', name: 'JSON (text)', fn: encodeJSON, fig: '—' },
  { id: 'msgpack', name: 'MessagePack', fn: encodeMsgPack, fig: 'Figure 4-1' },
  { id: 'thriftb', name: 'Thrift BinaryProtocol', fn: encodeThriftBinary, fig: 'Figure 4-2' },
  { id: 'thriftc', name: 'Thrift CompactProtocol', fn: encodeThriftCompact, fig: 'Figure 4-3' },
  { id: 'proto', name: 'Protocol Buffers', fn: encodeProtobuf, fig: 'Figure 4-4' },
  { id: 'avro', name: 'Avro', fn: encodeAvro, fig: 'Figure 4-5' },
] as const;

export const BOOK_EXAMPLE: Person = { userName: 'Martin', favoriteNumber: 1337, interests: ['daydreaming', 'hacking'] };
