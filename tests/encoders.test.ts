import { describe, expect, it } from 'vitest';
import { BOOK_EXAMPLE, FORMATS } from '../src/viz/encoders';

// Byte sequences copied from Figures 4-1 to 4-5 of the book (pp. 113-119).
const BOOK: Record<string, string> = {
  msgpack: '83 a8 75 73 65 72 4e 61 6d 65 a6 4d 61 72 74 69 6e ae 66 61 76 6f 72 69 74 65 4e 75 6d 62 65 72 cd 05 39 a9 69 6e 74 65 72 65 73 74 73 92 ab 64 61 79 64 72 65 61 6d 69 6e 67 a7 68 61 63 6b 69 6e 67',
  thriftb: '0b 00 01 00 00 00 06 4d 61 72 74 69 6e 0a 00 02 00 00 00 00 00 00 05 39 0f 00 03 0b 00 00 00 02 00 00 00 0b 64 61 79 64 72 65 61 6d 69 6e 67 00 00 00 07 68 61 63 6b 69 6e 67 00',
  thriftc: '18 06 4d 61 72 74 69 6e 16 f2 14 19 28 0b 64 61 79 64 72 65 61 6d 69 6e 67 07 68 61 63 6b 69 6e 67 00',
  proto: '0a 06 4d 61 72 74 69 6e 10 b9 0a 1a 0b 64 61 79 64 72 65 61 6d 69 6e 67 1a 07 68 61 63 6b 69 6e 67',
  avro: '0c 4d 61 72 74 69 6e 02 f2 14 04 16 64 61 79 64 72 65 61 6d 69 6e 67 0e 68 61 63 6b 69 6e 67 00',
};
const SIZES: Record<string, number> = { json: 81, msgpack: 66, thriftb: 59, thriftc: 34, proto: 33, avro: 32 };

describe('encoders reproduce the book figures', () => {
  for (const f of FORMATS) {
    it(f.name, () => {
      const bytes = f.fn(BOOK_EXAMPLE).flatMap((s) => s.bytes);
      expect(bytes.length).toBe(SIZES[f.id]);
      if (BOOK[f.id]) expect(bytes.map((b) => b.toString(16).padStart(2, '0')).join(' ')).toBe(BOOK[f.id]);
    });
  }
});
