"""Reference solution for exercise 07. Run: python practice/_solutions/07-graph-queries/solution.py"""
import importlib.util
import pathlib

spec = importlib.util.spec_from_file_location(
    "graph", pathlib.Path(__file__).resolve().parents[2] / "07-graph-queries" / "graph.py")
g = importlib.util.module_from_spec(spec)
spec.loader.exec_module(g)

SQL = """
WITH RECURSIVE
  in_usa(vertex_id) AS (
    SELECT vertex_id FROM vertices WHERE json_extract(properties, '$.name') = 'United States'
    UNION
    SELECT edges.tail_vertex FROM edges JOIN in_usa ON edges.head_vertex = in_usa.vertex_id
    WHERE edges.label = 'within'
  ),
  in_europe(vertex_id) AS (
    SELECT vertex_id FROM vertices WHERE json_extract(properties, '$.name') = 'Europe'
    UNION
    SELECT edges.tail_vertex FROM edges JOIN in_europe ON edges.head_vertex = in_europe.vertex_id
    WHERE edges.label = 'within'
  ),
  born_in_usa(vertex_id) AS (
    SELECT edges.tail_vertex FROM edges JOIN in_usa ON edges.head_vertex = in_usa.vertex_id
    WHERE edges.label = 'born_in'
  ),
  lives_in_europe(vertex_id) AS (
    SELECT edges.tail_vertex FROM edges JOIN in_europe ON edges.head_vertex = in_europe.vertex_id
    WHERE edges.label = 'lives_in'
  )
SELECT json_extract(vertices.properties, '$.name') FROM vertices
JOIN born_in_usa ON vertices.vertex_id = born_in_usa.vertex_id
JOIN lives_in_europe ON vertices.vertex_id = lives_in_europe.vertex_id
"""


def task1():
    return sorted(r[0] for r in g.db.execute(SQL))


def evaluate(facts):
    facts = set(facts)
    it = 0
    while True:
        it += 1
        new = set()
        wr = {(f[1], f[2]) for f in facts if f[0] == "within_recursive"}
        # rule 1
        for f in facts:
            if f[0] == "name":
                new.add(("within_recursive", f[1], f[2]))
        # rule 2
        for f in facts:
            if f[0] == "within":
                for (loc, name) in wr:
                    if loc == f[2]:
                        new.add(("within_recursive", f[1], name))
        # rule 3
        names = {f[1]: f[2] for f in facts if f[0] == "name"}
        born = [(f[1], f[2]) for f in facts if f[0] == "born_in"]
        lives = [(f[1], f[2]) for f in facts if f[0] == "lives_in"]
        for p, b in born:
            for p2, l in lives:
                if p2 != p:
                    continue
                for (loc1, born_in) in wr:
                    if loc1 != b:
                        continue
                    for (loc2, living_in) in wr:
                        if loc2 == l:
                            new.add(("migrated", names[p], born_in, living_in))
        added = new - facts
        print(f"  iteration {it}: {len(added)} new facts")
        if not added:
            return facts
        facts |= added


g.task1, g.evaluate = task1, evaluate
src = pathlib.Path(g.__file__).read_text(encoding="utf-8").split('if __name__ == "__main__":', 1)[1]
exec("if True:" + src, vars(g))
