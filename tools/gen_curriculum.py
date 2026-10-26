"""Generate docs/CURRICULUM.md from content/ (so the document never drifts from the course).
    python tools/gen_curriculum.py
"""
from __future__ import annotations

import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONTENT = os.path.join(ROOT, "content")
KIND = {"lesson": "", "lab": "Lab", "review": "Review", "assessment": "Checkpoint", "project": "Project",
        "supplement": "Beyond the PDF"}


def frontmatter(path: str) -> tuple[dict, str]:
    text = open(path, encoding="utf-8").read().replace("\r\n", "\n")
    head, body = text[4:].split("\n---", 1)
    fm: dict = {}
    key = None
    for line in head.split("\n"):
        m = re.match(r"^\s*-\s+(.*)$", line)
        if m and key:
            fm[key].append(m.group(1).strip())
            continue
        m = re.match(r"^([A-Za-z_]+):\s*(.*)$", line)
        if m:
            key = m.group(1)
            fm[key] = [] if m.group(2) == "" else m.group(2).strip()
    return fm, body.strip()


def main() -> None:
    out = ["# Curriculum", "",
           "Generated from `content/` by `tools/gen_curriculum.py`. 24 weeks × 6 days, about 1–2 hours a day;",
           "day 6 of every week is a lighter review or checkpoint. Page numbers are the printed pages of the",
           "Sixth Early Release PDF (PDF page = printed page + 22).", ""]
    total_min = 0
    exercises = set()
    for w in sorted(d for d in os.listdir(CONTENT) if re.match(r"w\d\d$", d)):
        wdir = os.path.join(CONTENT, w)
        meta, summary = frontmatter(os.path.join(wdir, "week.md"))
        out += [f"## Week {int(w[1:])} — {meta.get('title', '')}", "", f"*{meta.get('part', '')}*", "", summary, "",
                "| Day | Lesson | Type | Minutes | Reading (printed pages) | Exercise |", "|---|---|---|---|---|---|"]
        for f in sorted(x for x in os.listdir(wdir) if re.match(r"d\d-", x)):
            fm, body = frontmatter(os.path.join(wdir, f))
            reading = fm.get("reading") or []
            pages = ", ".join(r.split("|")[1].strip() for r in reading if "|" in r) if isinstance(reading, list) else ""
            ex = sorted(set(re.findall(r"^:::practice\s+([\w-]+)", body, re.M)))
            exercises.update(ex)
            total_min += int(fm.get("minutes", 0) or 0)
            out.append(f"| {f[1]} | {fm.get('title', '')} | {KIND.get(fm.get('kind', 'lesson'), '')} | {fm.get('minutes', '')} | "
                       f"{pages or '—'} | {', '.join(ex) or '—'} |")
        out.append("")
    out[5:5] = ["", f"**Total:** {total_min // 60} hours of scheduled study time, "
                    f"{len(exercises)} hands-on exercises and labs.", ""]
    path = os.path.join(ROOT, "docs", "CURRICULUM.md")
    os.makedirs(os.path.dirname(path), exist_ok=True)
    open(path, "w", encoding="utf-8").write("\n".join(out) + "\n")
    print(f"wrote {path}: {total_min // 60} h, {len(exercises)} exercises")


if __name__ == "__main__":
    main()
