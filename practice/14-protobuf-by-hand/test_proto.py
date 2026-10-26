"""
Tests for exercise 14.
    python practice/14-protobuf-by-hand/test_proto.py              # your proto.py
    python practice/14-protobuf-by-hand/test_proto.py --solution   # reference
"""
import importlib.util
import pathlib
import sys
import unittest

HERE = pathlib.Path(__file__).resolve().parent
use_solution = "--solution" in sys.argv
if use_solution:
    sys.argv.remove("--solution")
target = (HERE.parent / "_solutions" / "14-protobuf-by-hand" / "proto.py") if use_solution else (HERE / "proto.py")
spec = importlib.util.spec_from_file_location("proto", target)
p = importlib.util.module_from_spec(spec)
spec.loader.exec_module(p)

# Figure 4-4, p. 116
BOOK = bytes.fromhex("0a064d617274696e10b90a1a0b6461796472656" "16d696e671a076861636b696e67")


class T1_Varint(unittest.TestCase):
    def test_known_values(self):
        self.assertEqual(p.encode_varint(1), b"\x01")
        self.assertEqual(p.encode_varint(127), b"\x7f")
        self.assertEqual(p.encode_varint(128), b"\x80\x01")
        self.assertEqual(p.encode_varint(1337), b"\xb9\x0a")

    def test_roundtrip(self):
        for n in [0, 1, 300, 1337, 2**31, 2**53 + 1, 2**63 - 1]:
            v, pos = p.decode_varint(p.encode_varint(n), 0)
            self.assertEqual((v, pos), (n, len(p.encode_varint(n))))


class T2_Encode(unittest.TestCase):
    def test_book_example_is_33_bytes(self):
        enc = p.encode_person("Martin", 1337, ["daydreaming", "hacking"])
        self.assertEqual(len(enc), 33)
        self.assertEqual(enc, BOOK)

    def test_optional_field_omitted(self):
        self.assertEqual(len(p.encode_person("Martin", None, [])), 8)


class T3_DecodeAndEvolve(unittest.TestCase):
    def test_decode_book_bytes(self):
        d = p.decode_person(BOOK)
        self.assertEqual((d["user_name"], d["favorite_number"], d["interests"]),
                         ("Martin", 1337, ["daydreaming", "hacking"]))

    def test_forward_compat_skips_unknown_fields(self):
        # A NEWER writer added: string photo_url = 4;  int64 follower_count = 5;
        newer = BOOK + bytes([(4 << 3) | 2, 6]) + b"me.jpg" + bytes([(5 << 3) | 0]) + p.encode_varint(10**6)
        d = p.decode_person(newer)
        self.assertEqual(d["user_name"], "Martin")
        self.assertEqual(d["interests"], ["daydreaming", "hacking"])
        self.assertEqual(sorted(d["skipped_tags"]), [4, 5])

    def test_renaming_is_free_but_tags_matter(self):
        # Field names never appear in the bytes:
        self.assertNotIn(b"user_name", BOOK)
        self.assertNotIn(b"interests", BOOK)


if __name__ == "__main__":
    print(f"Testing {target}")
    unittest.main(verbosity=2)
