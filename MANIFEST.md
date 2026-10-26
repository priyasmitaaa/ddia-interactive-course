# DDIA Course — Build Manifest

Persistent record of what is built and verified. If anything is added later, update this file in the same commit.
`npm test` checks every lesson file for structure, quiz answers, visualization names, exercise links, page references
and **full page coverage** of every chapter.

## Source facts (verified from the PDF)

- Edition: **Sixth Early Release (2016-07-11)**, 491 PDF pages.
- Contains: About this Book, Part I (Ch 1–4), Part II (Ch 5–9), Part III intro, Ch 10, Ch 11 (ends p. 469).
- **Does not contain**: Chapter 12 "The Future of Data Systems", Glossary, Index (published edition only).
- Page mapping: **PDF page = printed page + 22** (checked on pages 9, 79, 179, 279, 379, 459).
- Material from outside this PDF is always labelled: `:::extra` sections ("Beyond the book") and Week 22's
  `supplement` lessons ("Beyond the PDF"), which carry no page references.
- The PDF is never committed (`book.pdf`, `.pdfpath`, `*.pdf` are git-ignored) and never deployed.

## Course shape

24 weeks × 6 days = 144 lessons, 208 scheduled hours (about 1.45 h/day). Day 6 of every week is a lighter review
or checkpoint (≤ 75 min). Day-by-day plan: `docs/CURRICULUM.md` (generated).

| Weeks | Topic | Book pages |
|---|---|---|
| 1 | Ch 1 Reliable, Scalable, Maintainable | 1–21 |
| 2 | Ch 2 Data Models & Query Languages | 25–63 |
| 3–4 | Ch 3 Storage & Retrieval | 67–101 |
| 5 | Ch 4 Encoding & Evolution | 107–136 |
| 6 | Part I consolidation + Project 1 (log-structured KV store) + Part I exam | — |
| 7–8 | Ch 5 Replication (+ Part II intro) | 141–187 |
| 9 | Ch 6 Partitioning | 191–209 |
| 10–11 | Ch 7 Transactions | 213–259 |
| 12–13 | Ch 8 Trouble with Distributed Systems | 265–303 |
| 14–16 | Ch 9 Consistency & Consensus | 311–365 |
| 17 | Part II consolidation: 2PC lab, leader-election lab, design case study, paper reading, Part II exam | — |
| 18–19 | Ch 10 Batch Processing (+ Part III intro) | 375–418 |
| 20–21 | Ch 11 Stream Processing | 425–464 |
| 22 | Beyond the PDF (supplementary, clearly marked) + final exam | — |
| 23–24 | Capstone: MiniKV (encoding, LSM storage, replication, failover/fencing, partitioning, change stream) | — |

## Status

### Platform
- [x] App shell (Learn / Review / Practice / Progress), hash routing, light/dark themes, mobile layout
- [x] Lesson parser + renderer (markdown sections, inline SVG, PDF page links, lesson/exercise links)
- [x] Quiz engine (choice + self-graded free answers) + spaced repetition (Leitner, 1/4/10/25/60/150 days)
- [x] Progress persistence (localStorage) + backup download / restore
- [x] PDF served locally at ./book.pdf (DDIA_PDF, book.pdf or .pdfpath); hosted build explains pages instead
- [x] Content validator (`tests/content.test.ts`): 24 weeks × 6 days, every chapter page covered
- [x] Visualization logic tests vs the book's figures (`tests/encoders`, `txnsim`, `ch8viz`–`ch11viz`)
- [x] SRS + progress-store unit tests (`tests/srs.test.ts`)
- [x] Browser end-to-end test (`tests/e2e.mjs`): learner flow, persistence, review, every lesson & exercise page
- [x] Launchers: `start-course.bat` (Windows), `start-course.sh` (macOS/Linux)
- [x] Production build (`npm run build`, relative base) + GitHub Pages workflow (`.github/workflows/pages.yml`)
- [x] Docs: README, docs/SETUP, docs/NAVIGATION, docs/CURRICULUM, docs/CONTENT-FORMAT

### Weeks (lessons authored + validated)
- [x] W1 Ch1 — viz: DataSystemFlow, MttfCalc, FanoutSim, PercentileSim — ex 01, 02, 03
- [x] W2 Ch2 — viz: ResumeModel, NormalizationSim, GraphQuery — ex 04–07
- [x] W3 Ch3 OLTP — viz: HashIndexSim, LSMTreeSim, BTreeSim — ex 08 (Bitcask lab), 09
- [x] W4 Ch3 OLAP — viz: ColumnStoreViz, DataCubeViz — ex 10, 11, 12 (LSM lab)
- [x] W5 Ch4 — viz: EncodingBytes (byte-exact vs Figures 4-1…4-5), SchemaResolver, RollingUpgradeSim — ex 13–16
- [x] W6 Part I — ex 17 (Project 1) + Part I exam
- [x] W7–W8 Ch5 — viz: ReplicationSim, FailoverSim, LagAnomalySim, ConflictSim, TopologySim, QuorumSim, CartVersionSim — ex 18–21
- [x] W9 Ch6 — viz: PartitionSim, SecondaryIndexSim, RebalanceSim, RoutingSim — ex 22, 23 (lab)
- [x] W10–W11 Ch7 — viz: TxnSim (6 anomalies × 5 levels), MVCCViz — ex 24, 25, 26 (lab), 27
- [x] W12–W13 Ch8 — viz: NetworkTimeoutSim, ClockSkewLWW, LeaseFencingSim — ex 28, 29, 30 (lab)
- [x] W14–W16 Ch9 — viz: LinearizabilityViz, QuorumRaceSim, CAPSim, CausalityViz, TOBSim, TwoPCSim, RaftSim — ex 31 (lab), 32, 33
- [x] W17 Part II — ex 34 (2PC lab), 35 (election lab) + design case study + paper reading + Part II exam
- [x] W18–W19 Ch10 — viz: PipelineViz, MapReduceViz, JoinViz, BatchFaultsViz, PregelViz — ex 36, 37 (lab), 38, 39
- [x] W20–W21 Ch11 — viz: BrokerSim, LogBrokerSim, DualWriteSim, EventSourcingViz, StreamTimeViz, ExactlyOnceSim — ex 40–43, 44 (lab)
- [x] W22 Beyond the PDF (4 supplement lessons) + final exam + whole-book review
- [x] W23–W24 Capstone — ex 45 MiniKV: 6 milestones, 20 tests, reference solution, fuzzer (200 scenarios), demo

### Verification (last full run)
- [x] `npm test` — all pass (content, visualization logic, SRS)
- [x] `npm run e2e` — all checks pass, 144 lessons + 45 exercise pages render, no console errors
- [x] `python tools/check_solutions.py` — all 45 reference solutions pass
- [x] `npm run build` — succeeds

## Build notes

- Write lesson/code files with the file tool, not shell heredocs: the shell layer collapses `\\`.
- Starters are generated from solutions by replacing the marked bodies with `TODO` hints and `raise NotImplementedError`.
- Visual check helper: `node tests/viz-shots.mjs <outdir> <lessonIds...>` (dev server must be running).
