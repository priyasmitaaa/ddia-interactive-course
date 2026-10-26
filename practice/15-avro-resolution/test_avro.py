"""
Tests for exercise 15.
    python practice/15-avro-resolution/test_avro.py              # your avro.py
    python practice/15-avro-resolution/test_avro.py --solution   # reference
"""
import importlib.util
import pathlib
import sys
import unittest

HERE = pathlib.Path(__file__).resolve().parent
use_solution = "--solution" in sys.argv
if use_solution:
    sys.argv.remove("--solution")
target = (HERE.parent / "_solutions" / "15-avro-resolution" / "avro.py") if use_solution else (HERE / "avro.py")
spec = importlib.util.spec_from_file_location("avro", target)
a = importlib.util.module_from_spec(spec)
spec.loader.exec_module(a)

V1 = {"type": "record", "name": "Person", "fields": [
    {"name": "userName", "type": "string"},
    {"name": "favoriteNumber", "type": ["null", "long"], "default": None},
    {"name": "interests", "type": {"type": "array", "items": "string"}},
]}
MARTIN = {"userName": "Martin", "favoriteNumber": 1337, "interests": ["daydreaming", "hacking"]}
BOOK = bytes.fromhex("0c4d617274696e02f2140416646179647265616d696e670e6861636b696e6700")  # Figure 4-5


def schema(*fields):
    return {"type": "record", "name": "Person", "fields": list(fields)}


class T1_Longs(unittest.TestCase):
    def test_zigzag_varints(self):
        self.assertEqual(a.write_long(0), b"\x00")
        self.assertEqual(a.write_long(-1), b"\x01")
        self.assertEqual(a.write_long(1), b"\x02")
        self.assertEqual(a.write_long(6), b"\x0c")
        self.assertEqual(a.write_long(1337), b"\xf2\x14")
        for n in [0, 5, -5, 1337, -(2**40), 2**62]:
            self.assertEqual(a.read_long(a.write_long(n), 0)[0], n)


class T2_Encode(unittest.TestCase):
    def test_book_bytes(self):
        enc = a.encode(MARTIN, V1)
        self.assertEqual(len(enc), 32, "the book's Avro encoding is 32 bytes")
        self.assertEqual(enc, BOOK)

    def test_null_branch(self):
        enc = a.encode({"userName": "M", "favoriteNumber": None, "interests": []}, V1)
        self.assertEqual(enc, b"\x02M\x00\x00")


class T3_SameSchema(unittest.TestCase):
    def test_roundtrip(self):
        self.assertEqual(a.decode(BOOK, V1, V1), MARTIN)


class T4_Resolution(unittest.TestCase):
    def test_reader_reorders_fields(self):
        r = schema(V1["fields"][2], V1["fields"][0], V1["fields"][1])
        self.assertEqual(a.decode(BOOK, V1, r), MARTIN)

    def test_backward_compat_added_field_with_default(self):
        v2 = schema(*V1["fields"], {"name": "photoURL", "type": ["null", "string"], "default": None})
        self.assertEqual(a.decode(BOOK, V1, v2), {**MARTIN, "photoURL": None})

    def test_backward_compat_broken_without_default(self):
        v2 = schema(*V1["fields"], {"name": "userID", "type": "long"})
        with self.assertRaises(a.SchemaError):
            a.decode(BOOK, V1, v2)

    def test_forward_compat_old_reader_ignores_new_field(self):
        v2 = schema(*V1["fields"], {"name": "photoURL", "type": ["null", "string"], "default": None})
        newer = a.encode({**MARTIN, "photoURL": "me.jpg"}, v2)
        self.assertEqual(a.decode(newer, v2, V1), MARTIN)

    def test_forward_compat_broken_when_removing_field_without_default(self):
        v2 = schema(V1["fields"][0], V1["fields"][1])          # interests removed (it had no default)
        newer = a.encode({"userName": "Martin", "favoriteNumber": 7}, v2)
        with self.assertRaises(a.SchemaError):
            a.decode(newer, v2, V1)                          # old reader still expects interests


if __name__ == "__main__":
    print(f"Testing {target}")
    unittest.main(verbosity=2)
