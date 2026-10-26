---
title: Lab — two-phase commit with crash recovery
chapter: 9
topic: Atomic commit, 2PC's system of promises, the commit point, in-doubt transactions, coordinator recovery
minutes: 110
---

## Objective

Implement two-phase commit the way p. 347–349 describes it, including the parts that make it work:
durable *prepared* records (a YES vote is a promise), the coordinator's decision in its own log (the
**commit point**), retrying phase 2 until done, and **recovery**. Then crash the coordinator at
every interesting moment and watch the in-doubt transaction hold its locks and block other work
until recovery (pp. 352–353). Finally, see what an operator's "heuristic decision" does to atomicity.

## Setup

Python 3.10+, standard library only. Files: `practice/34-two-phase-commit/twopc.py` (TODOs 1–4)
and `test_twopc.py` (T1–T5). Each component's durable log is a JSON-lines file in a temporary
directory, written with `fsync`. A "crash" wipes memory, and recovery replays the log. The **2PC**
visualization in this week's lessons shows the same states step by step.

## Predict first

1. The coordinator crashes after DB 1 committed but before DB 2 heard the decision. What state is DB 2
   in, and can another transaction read Bob's balance?
2. The coordinator crashes after collecting two YES votes but before writing its decision. On
   recovery, should it commit or abort?
3. DB 2 itself crashes while in doubt and restarts. Should Bob's row still be locked?

## Your task

1. **TODO 1** `Participant.prepare` → T1.
2. **TODO 2** `Coordinator.commit` → T2. Put the `_maybe_crash` calls exactly where the comments say.
   T3 relies on them.
3. **TODO 3** `Coordinator.recover` → T3.
4. **TODO 4** `Participant.recover` → T4.
5. T5 needs no code. Read it and the `heuristic_abort` helper.

## Run it

```
python practice/34-two-phase-commit/test_twopc.py
python practice/34-two-phase-commit/twopc.py
```

## Observe

- A crash *before* the commit point resolves to abort, and *after* it to commit, even if no
  participant has heard yet. The single-node atomic commit on the coordinator's disk decides
  (p. 349).
- In doubt, DB 2 refuses to let anyone read Bob's row. That isn't a bug. 2PC must keep the locks,
  even across DB 2's own restart (p. 353), and this is why a slow coordinator recovery makes parts
  of an application unavailable.
- `heuristic_abort` gets DB 2 unstuck, and $30 vanishes: DB 1 committed and DB 2 aborted. "Heuristic"
  is a euphemism for *probably breaking atomicity* (p. 353).
- Count the `fsync` calls in a single transfer. Forced disk writes plus extra round trips are why
  2PC is slow (p. 350).

## Questions

1. Why must the participant write its *prepared* record **before** replying YES?
2. Why can't an in-doubt participant just abort after a timeout? Why can't it just commit?
3. The coordinator here lives in the application process with its log on local disk (as with XA,
   p. 352). What does that do to the "stateless application server" model?
4. Which of consensus's four properties does 2PC fail to provide, and why (p. 356)?

<details><summary>Discussion</summary>

1. YES is a promise to commit later, whatever happens. If the participant crashed after replying but
   before recording the transaction durably, it would come back without the data and couldn't keep
   the promise. The coordinator might already have decided to commit (p. 348).
2. Aborting could contradict a commit decision that other participants have already applied. That's
   Figure 9-10, where DB 2 committed. Committing could contradict an abort, because another
   participant might have voted NO. Only the coordinator knows (p. 349).
3. The coordinator's log becomes durable system state, as important as the databases. If that server
   is lost, in-doubt transactions can't be resolved automatically. The app server is no longer
   stateless and needs the same care as a database (p. 354).
4. **Termination.** If the coordinator crashes and never returns, in-doubt participants wait forever.
   Consensus must make progress while a majority of nodes is up, but 2PC requires *every* participant's
   vote and waits on the one coordinator (pp. 355–356, 359).
</details>
