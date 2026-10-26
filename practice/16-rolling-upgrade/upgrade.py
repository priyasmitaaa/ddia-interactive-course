"""
Exercise 16 — Data outlives code: losing fields during a rolling upgrade (book pp. 125-127, Figure 4-7).

Two versions of an application share one database of JSON records.
v2 added a `photo_url` field. During the upgrade, v1 servers are still running.

Run:  python practice/16-rolling-upgrade/upgrade.py
"""
import json
from dataclasses import dataclass, field

DB: dict[int, str] = {}   # user_id -> encoded JSON record


# ---------------------------------------------------------------------------
# Version 1 of the application (given). Decodes into a model object, edits it, re-encodes it.
# ---------------------------------------------------------------------------
@dataclass
class PersonV1:
    user_name: str
    favorite_number: int | None = None
    interests: list[str] = field(default_factory=list)

    @staticmethod
    def from_json(s: str) -> "PersonV1":
        d = json.loads(s)
        return PersonV1(d["user_name"], d.get("favorite_number"), d.get("interests", []))

    def to_json(self) -> str:
        return json.dumps({"user_name": self.user_name, "favorite_number": self.favorite_number,
                           "interests": self.interests})


def v1_set_favorite_number(user_id: int, n: int):
    p = PersonV1.from_json(DB[user_id])
    p.favorite_number = n
    DB[user_id] = p.to_json()


# ---------------------------------------------------------------------------
# Version 2 (given): knows photo_url.
# ---------------------------------------------------------------------------
def v2_set_photo(user_id: int, url: str):
    d = json.loads(DB[user_id])
    d["photo_url"] = url
    DB[user_id] = json.dumps(d)


# ---------------------------------------------------------------------------
# TASK: write PersonV1Fixed — still a v1 model that knows nothing about photo_url — but which
# keeps any unknown fields it read and writes them back unchanged. Then make
# v1_fixed_set_favorite_number use it. (Hint: remember the extra keys in a dict attribute.)
# ---------------------------------------------------------------------------
class PersonV1Fixed:
    pass


def v1_fixed_set_favorite_number(user_id: int, n: int):
    raise NotImplementedError


def scenario(v1_update):
    DB.clear()
    DB[251] = json.dumps({"user_name": "Martin", "favorite_number": 1337, "interests": ["hacking"]})
    v2_set_photo(251, "http://example.com/martin.jpg")   # a v2 server writes the new field
    v1_update(251, 42)                                     # then a v1 server edits the same record
    return json.loads(DB[251])


if __name__ == "__main__":
    r = scenario(v1_set_favorite_number)
    print("naive v1 :", r, "-> photo_url", "kept" if "photo_url" in r else "LOST")
    try:
        r = scenario(v1_fixed_set_favorite_number)
        print("fixed v1 :", r, "-> photo_url", "kept" if "photo_url" in r else "LOST")
    except NotImplementedError:
        print("fixed v1 : not implemented yet")
