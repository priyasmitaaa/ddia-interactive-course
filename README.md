# DDIA Interactive Course

**A complete, self-paced, interactive course for *Designing Data-Intensive Applications* (Martin Kleppmann, O'Reilly).**
24 weeks · 6 days a week · 1–2 hours a day · 144 lessons · 45 hands-on exercises and labs · a capstone project.

The course turns the book into a daily plan. Every lesson follows the same rhythm (**Learn → Visualize → Practice →
Quiz → Complete**), cites exact pages to read, and includes an interactive visualization or a coding exercise that
shows the real mechanism. Every question you answer feeds a **spaced-repetition** review system, so you keep what
you learned.

> **About the book:** this repository does **not** contain the book. You need your own copy. The course is written for the
> *Sixth Early Release* PDF (2016), which covers Chapters 1–11. All page references are printed page numbers in that
> PDF (PDF page = printed page + 22). Material from outside it, such as the published edition's final chapter or
> developments since 2016, is clearly labelled **Beyond the PDF / Beyond the book**.

---

## Quick start

### Option A: open it in the browser (any device, nothing to install)

**https://priyasmitaaa.github.io/ddia-interactive-course/**

This hosted copy is published automatically by GitHub Pages once the repository is **public**, or private on a
plan that includes Pages (see [docs/SETUP.md](docs/SETUP.md#hosted-site-github-pages)). It works on phones, tablets
and any computer, and progress is saved in that browser automatically. Page links can't open the PDF there, since
it's never uploaded, so they tell you which page to open in your own copy instead. To run the Python exercises you
still need a computer with Python (Option B).

### Option B: run it on your computer (full experience: page links open the PDF, exercises run locally)

You need **Node.js 18+** (https://nodejs.org) and, for the exercises, **Python 3.10+** (https://python.org).

```bash
git clone https://github.com/priyasmitaaa/ddia-interactive-course.git
cd ddia-interactive-course
```

Then tell the course where your PDF is, using **one** of these:
- copy it into the folder as `book.pdf`, or
- create a file named `.pdfpath` containing the full path to your PDF on its first line, or
- set the environment variable `DDIA_PDF` to the PDF's path.

Start it:
- **Windows:** double-click `start-course.bat`
- **macOS / Linux:** `./start-course.sh` (or `sh start-course.sh`)
- **Any OS, by hand:** `npm install` once, then `npm start`

The course opens at **http://localhost:5317**. Always use that address, because progress is saved per address.

Full instructions, including moving your progress between devices: **[docs/SETUP.md](docs/SETUP.md)**.

---

## What's inside

| Weeks | Topic | Book |
|---|---|---|
| 1 | Reliable, scalable and maintainable applications | Ch 1 |
| 2 | Data models and query languages | Ch 2 |
| 3–4 | Storage and retrieval: hash indexes, LSM-trees, B-trees, column stores | Ch 3 |
| 5 | Encoding and evolution | Ch 4 |
| 6 | Part I consolidation, Project 1 (log-structured KV store), Part I exam | — |
| 7–8 | Replication | Ch 5 |
| 9 | Partitioning | Ch 6 |
| 10–11 | Transactions | Ch 7 |
| 12–13 | The trouble with distributed systems | Ch 8 |
| 14–16 | Consistency and consensus | Ch 9 |
| 17 | Part II consolidation, 2PC and leader-election labs, Part II exam | — |
| 18–19 | Batch processing | Ch 10 |
| 20–21 | Stream processing | Ch 11 |
| 22 | Beyond the PDF (clearly marked) and final exam | — |
| 23–24 | Capstone: **MiniKV**, a replicated, partitioned key-value store | Ch 3–11 |

The full day-by-day plan is in **[docs/CURRICULUM.md](docs/CURRICULUM.md)**.

**Features**
- **144 structured lessons**: the problem, the intuition, how it really works, a visualization, practice, a quiz, and
  connections to other chapters. Each has explicit "you're done when…" criteria.
- **49 interactive visualizations** (many with several modes) that run the actual mechanism, not animations: an LSM-tree and B-tree, byte-exact
  Protocol Buffers/Thrift/Avro encodings, quorum replication, partition rebalancing, every isolation-level anomaly,
  fencing tokens, a linearizability checker, Raft-style elections, 2PC, MapReduce joins, Kafka-style logs,
  event-time windows, exactly-once processing, and more.
- **45 exercises and labs** in plain Python (standard library only), each with a README (objective, setup, predict,
  task, run, observe, questions with a discussion) and a **verified reference solution**.
- **Spaced repetition**: every question you answer comes back at growing intervals (1, 4, 10, 25, 60, 150 days),
  sooner if you missed it. There's also a struggling-topics view and mixed quizzes.
- **Checkpoints**: a weekly review day, chapter assessments, Part I and Part II exams, and a final exam.
- **No accounts, no tracking, no gamification.** Progress lives in your browser, with one-click backup and restore.

How to use the app day to day: **[docs/NAVIGATION.md](docs/NAVIGATION.md)**.

---

## Repository layout

```
content/            the lessons: content/wNN/dN-*.md (markdown + small section syntax), wNN/week.md
practice/           45 exercises (README + starter code); practice/_solutions/ = reference solutions
src/                the web app (React + TypeScript + Vite)
  components/       Home (Learn), LessonView, Quiz, Review, Practice, Progress
  lib/              lesson parser, spaced repetition, progress store, router, PDF links
  viz/              the interactive visualizations (one file each)
tests/              content validator, visualization logic tests, SRS tests, browser end-to-end test
tools/              check_solutions.py (runs every reference solution), gen_curriculum.py
docs/               SETUP, NAVIGATION, CURRICULUM, CONTENT-FORMAT
MANIFEST.md         build status and verified source facts
```

## Quality checks

```bash
npm test                          # 300+ checks: every lesson's structure, quiz answers, page references
                                  # (every page of every chapter is assigned), visualization logic vs the book's
                                  # figures, spaced-repetition scheduling
npm run e2e                       # real browser (needs `npm run dev` and Chrome/Chromium): learner flow + every
                                  # lesson and exercise page renders with no console errors
python tools/check_solutions.py   # runs all 45 reference solutions
npm run build                     # production build (what GitHub Pages serves)
```

Every push to `main` runs the tests and redeploys the hosted copy (`.github/workflows/pages.yml`).

Writing or editing lessons: **[docs/CONTENT-FORMAT.md](docs/CONTENT-FORMAT.md)**.

## Credits and licence

*Designing Data-Intensive Applications* is © Martin Kleppmann, published by O'Reilly Media. This is an independent,
unofficial study companion. It contains no text of the book beyond short quotations and paraphrase for study,
and it refers you to your own copy for all reading. Buy the book. It's excellent.

Course material in this repository (lessons, code, visualizations) is provided for personal study.
