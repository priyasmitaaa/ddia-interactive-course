"""Reference solution for exercise 04. Run: python practice/_solutions/04-document-vs-relational/solution.py"""
import importlib.util
import json
import pathlib

spec = importlib.util.spec_from_file_location(
    "profiles", pathlib.Path(__file__).resolve().parents[2] / "04-document-vs-relational" / "profiles.py")
p = importlib.util.module_from_spec(spec)
spec.loader.exec_module(p)


def load_profile_relational(user_id):
    u = p.q("SELECT * FROM users WHERE user_id = ?", user_id)[0]
    pos = p.q("SELECT job_title, organization FROM positions WHERE user_id = ? ORDER BY id DESC", user_id)
    edu = p.q("SELECT school_name, start, end FROM education WHERE user_id = ? ORDER BY id DESC", user_id)
    return {"user_id": u["user_id"], "first_name": u["first_name"], "last_name": u["last_name"],
            "region_id": u["region_id"], "photo_url": u["photo_url"],
            "positions": [dict(r) for r in pos], "education": [dict(r) for r in edu]}


def load_profile_document(user_id):
    return json.loads(p.q("SELECT doc FROM user_docs WHERE user_id = ?", user_id)[0]["doc"])


def setup_recommendations():
    p.db.executescript("""
    CREATE TABLE recommendations (id INTEGER PRIMARY KEY, from_user INTEGER, to_user INTEGER, text TEXT);
    INSERT INTO recommendations (from_user, to_user, text) VALUES
        (253, 251, 'Visionary and kind.'), (252, 251, 'Excellent with numbers.');
    """)
    doc = json.loads(p.db.execute("SELECT doc FROM user_docs WHERE user_id = 251").fetchone()[0])
    doc["recommendations"] = [{"from_user": 253, "text": "Visionary and kind."},
                              {"from_user": 252, "text": "Excellent with numbers."}]
    p.db.execute("UPDATE user_docs SET doc = ? WHERE user_id = 251", (json.dumps(doc),))


def show_recommendations_relational(user_id):
    rows = p.q("""SELECT u.first_name, u.photo_url, r.text FROM recommendations r
                  JOIN users u ON u.user_id = r.from_user WHERE r.to_user = ? ORDER BY r.id""", user_id)
    return [tuple(r) for r in rows]


def show_recommendations_document(user_id):
    doc = load_profile_document(user_id)
    out = []
    for rec in doc.get("recommendations", []):   # application-side join: one extra query per reference
        author = json.loads(p.q("SELECT doc FROM user_docs WHERE user_id = ?", rec["from_user"])[0]["doc"])
        out.append((author["first_name"], author["photo_url"], rec["text"]))
    return out


p.load_profile_relational, p.load_profile_document = load_profile_relational, load_profile_document
p.setup_recommendations = setup_recommendations
p.show_recommendations_relational, p.show_recommendations_document = show_recommendations_relational, show_recommendations_document
src = pathlib.Path(p.__file__).read_text(encoding="utf-8").split('if __name__ == "__main__":', 1)[1]
exec("if True:" + src, vars(p))
