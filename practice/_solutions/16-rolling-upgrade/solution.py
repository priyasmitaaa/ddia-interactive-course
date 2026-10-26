"""Reference solution for exercise 16. Run: python practice/_solutions/16-rolling-upgrade/solution.py"""
import importlib.util
import json
import pathlib

spec = importlib.util.spec_from_file_location(
    "upgrade", pathlib.Path(__file__).resolve().parents[2] / "16-rolling-upgrade" / "upgrade.py")
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)

KNOWN = {"user_name", "favorite_number", "interests"}


class PersonV1Fixed:
    def __init__(self, user_name, favorite_number=None, interests=None, unknown=None):
        self.user_name, self.favorite_number = user_name, favorite_number
        self.interests, self.unknown = interests or [], unknown or {}

    @staticmethod
    def from_json(s):
        d = json.loads(s)
        return PersonV1Fixed(d["user_name"], d.get("favorite_number"), d.get("interests", []),
                             {k: v for k, v in d.items() if k not in KNOWN})

    def to_json(self):
        return json.dumps({**self.unknown, "user_name": self.user_name,
                           "favorite_number": self.favorite_number, "interests": self.interests})


def v1_fixed_set_favorite_number(user_id, n):
    p = PersonV1Fixed.from_json(m.DB[user_id])
    p.favorite_number = n
    m.DB[user_id] = p.to_json()


m.v1_fixed_set_favorite_number = v1_fixed_set_favorite_number
src = pathlib.Path(m.__file__).read_text(encoding="utf-8").split('if __name__ == "__main__":', 1)[1]
exec("if True:" + src, vars(m))
