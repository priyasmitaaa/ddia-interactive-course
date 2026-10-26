# DDIA Course — Build Manifest

Persistent checklist of what is genuinely built. If development stops mid-way, resume from the
first unchecked item. `npm run validate` checks every lesson file for structure, quiz answers,
visualization names, exercise links and page references (and full page coverage once all weeks exist).

## Source facts (verified from the PDF)

- File: `D:\Martin-Kleppmann---Designing-Data-Intensive-Applications_-O'Reilly-Media-(2017).pdf`
- Edition: **Sixth Early Release (2016-07-11)**, 491 PDF pages.
- Contains: About this Book, Part I (Ch 1–4), Part II (Ch 5–9), Part III intro, Ch 10, Ch 11 (ends p. 469).
- **Does not contain**: Chapter 12 "The Future of Data Systems", Glossary, Index (final print edition only).
- Page mapping: **PDF page = printed page + 22** (checked on pages 9, 79, 179, 279, 379, 459).
- Some final-edition material is absent from this early release (e.g. size-tiered vs leveled
  compaction); lessons mark such material as "Beyond the book".

## Course shape

24 weeks × 6 days. Day 6 of every week is a lighter review / catch-up day.

| Weeks | Topic | Book pages |
|---|---|---|
| 1 | Ch 1 Reliable, Scalable, Maintainable | 1–21 |
| 2 | Ch 2 Data Models & Query Languages | 25–63 |
| 3–4 | Ch 3 Storage & Retrieval | 67–101 |
| 5 | Ch 4 Encoding & Evolution | 107–136 |
| 6 | Part I consolidation + Project 1 (log-structured KV store) | — |
| 7–8 | Ch 5 Replication (+ Part II intro) | 141–187 |
| 9 | Ch 6 Partitioning | 191–209 |
| 10–11 | Ch 7 Transactions | 213–259 |
| 12–13 | Ch 8 Trouble with Distributed Systems | 265–303 |
| 14–16 | Ch 9 Consistency & Consensus | 311–366 |
| 17 | Part II consolidation | — |
| 18–19 | Ch 10 Batch Processing (+ Part III intro) | 375–418 |
| 20–21 | Ch 11 Stream Processing | 425–464 |
| 22 | Beyond this PDF (supplementary, clearly marked) + synthesis | — |
| 23–24 | Capstone: MiniKV | — |

## Build notes

- Write lesson/code files with the file tool, not shell heredocs: the shell layer collapses `\\`.
- Exercise READMEs live in `practice/<id>/README.md` and are rendered in the site.
- Reference solutions live in `practice/_solutions/<id>/` and are run to verify each exercise.
- Visual check helper: `node tests/viz-shots.mjs <outdir> <lessonIds...>` (dev server must be running).

## Status

### Platform
- [x] App shell (Learn / Review / Practice / Progress)
- [x] Lesson parser + renderer (markdown sections, inline SVG, PDF page links)
- [x] Quiz engine (choice + self-graded free answers) + spaced repetition (Leitner)
- [x] Progress persistence (localStorage) + backup/restore
- [x] PDF served at /book.pdf, lesson links open exact pages
- [x] Content validator (tests/content.test.ts)
- [ ] SRS unit tests
- [ ] End-to-end browser test (tests/e2e.mjs)
- [ ] start-course.bat launcher + README

### Weeks (lessons authored + validated)
- [x] W1 Ch1 — viz: DataSystemFlow, MttfCalc, FanoutSim, PercentileSim — ex 01, 02, 03
- [x] W2 Ch2 — viz: ResumeModel, NormalizationSim, GraphQuery — ex 04, 05, 06, 07
- [x] W3 Ch3 OLTP — viz: HashIndexSim, LSMTreeSim, BTreeSim — ex 08 (Bitcask lab), 09
- [x] W4 Ch3 OLAP — viz: ColumnStoreViz, DataCubeViz — ex 10, 11, 12 (LSM lab)
- [x] W5 Ch4 — viz: EncodingBytes (byte-exact vs book, tests/encoders.test.ts), SchemaResolver, RollingUpgradeSim — ex 13, 14, 15, 16
- [x] W6 Part I project — ex 17 (Project 1: hints, format v2, group commit, background compaction, bench vs SQLite) + Part I exam
- [x] W7–W8 Ch5 — viz: ReplicationSim, FailoverSim, LagAnomalySim, ConflictSim, TopologySim, QuorumSim, CartVersionSim — ex 18, 19 (lab), 20, 21
- [ ] W9 Ch6
- [ ] W10–W11 Ch7
- [ ] W12–W13 Ch8
- [ ] W14–W16 Ch9
- [ ] W17 Part II consolidation
- [ ] W18–W19 Ch10
- [ ] W20–W21 Ch11
- [ ] W22 Beyond the PDF
- [ ] W23–W24 Capstone
