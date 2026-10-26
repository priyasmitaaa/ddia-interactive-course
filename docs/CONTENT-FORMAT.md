# Content format (for editing or adding lessons)

Lessons are plain Markdown files. The validator (`npm test`) checks every rule below, so a malformed lesson
fails the build instead of the learner.

## Files

```
content/w07/week.md                 one per week
content/w07/d3-sync-async.md        one per day: d1 … d6 (the file name after "dN-" is free)
practice/19-leader-follower/README.md + starter code     one folder per exercise
practice/_solutions/19-leader-follower/                  reference solution
src/viz/ReplicationSim.tsx + src/viz/index.ts            visualizations (registered by name)
```

## week.md

```markdown
---
title: Replication I — Leaders, Followers and Replication Lag
part: Part II · Distributed Data
chapters:
- 5
---
One-paragraph summary shown on the course map.
```

## Lesson frontmatter

```markdown
---
title: Synchronous vs Asynchronous Replication
kind: lesson            # lesson | lab | review | assessment | project | supplement
minutes: 90             # 30–120; day 6 (review/assessment) must be ≤ 75
chapter: 5              # optional; if set, every reading must be inside that chapter's pages
objectives:             # ≥ 2
- Explain …
reading:                # "Section name | printed pages" (single page "312" or range "147-149")
- Synchronous vs asynchronous replication | 147-149
complete:               # ≥ 1: the "you're done when…" criteria
- You answered the quiz
---
```

Rules: lessons of kind `lesson` with a chapter need at least one reading entry. Across the whole course, **every printed
page of every chapter must be covered** by some reading entry. Page numbers are printed pages in the Sixth Early
Release PDF (PDF page = printed + 22).

## Sections

The body is a sequence of fenced sections:

```markdown
:::problem The problem, in one line
Text (Markdown).
:::

:::intuition Optional title
:::

:::details How it really works (pp. 147–149)
:::

:::visual ReplicationSim | Title shown above the visualization
@props {"initialTab": "lag"}
**Try this:** numbered steps…
:::

:::practice 19-leader-follower | Title
One paragraph about what to do.
:::

:::quiz
(questions, see below)
:::

:::connect Where this goes next
:::
```

Section types: `problem`, `intuition`, `details`, `visual`, `practice`, `quiz`, `connect`, `note`, `extra`
(shown as *Beyond the book*, used for anything not in the PDF), `review` (inserts the spaced-review session), and
`task`. Every lesson needs at least 3 sections and more than 400 words (120 for reviews), with no placeholder text.

`:::visual Name` must name a component registered in `src/viz/index.ts`. `@props` (optional, first line) is JSON
passed to the component. `:::practice id` must be an existing `practice/<id>/` folder.

## Quiz questions

```markdown
### mcq                       (also: predict, tradeoff)
Question text?
- [ ] wrong option
- [x] the correct option (exactly one)
- [ ] wrong option
>>>
Explanation shown after answering (more than 30 characters; cite pages).

### explain                   (also: short, scenario, design)
Question text?
>>>
Model answer (more than 40 characters) the learner compares their own answer with.
```

Lessons of kind `lesson` and `supplement` need at least 4 questions, and others at least 3. Options must be distinct.

## Links inside text

| Markdown | Opens |
|---|---|
| `[p. 248](pdf:248)` | the PDF at printed page 248 |
| `[PDF p. 270](pdfp:270)` | the PDF at raw PDF page 270 |
| `[the SSI lesson](lesson:w11d4)` | another lesson |
| `[Exercise 26](ex:26-mvcc-ssi)` | an exercise page |

Inline SVG is allowed for static figures. Use the `dg` class and its helpers (`box`, `boxa`…`boxe`, `ln`, `sub`) so
figures follow light and dark themes.

## Exercise README

Frontmatter: `title`, `chapter`, `topic`, `minutes`. Required headings, in this order: `## Objective`, `## Setup`,
`## Predict first`, `## Your task`, `## Run it`, `## Observe`, `## Questions` (with a `<details>` discussion).
The folder must contain code (`.py`, `.sql` or `.sh`). Put the reference solution in `practice/_solutions/<id>/`, and
check it with `python tools/check_solutions.py <number>`.

## After editing

```
npm test                          # validator + all tests
python tools/gen_curriculum.py    # refresh docs/CURRICULUM.md
```
