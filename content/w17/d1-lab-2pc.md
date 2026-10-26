---
title: Lab — Two-Phase Commit with Crash Recovery
kind: lab
minutes: 110
chapter: 9
objectives:
- Implement prepare as a durable promise, and the coordinator's commit point
- Implement coordinator recovery that enforces logged decisions and aborts undecided transactions
- Implement participant recovery that keeps in-doubt transactions and their locks
- Demonstrate blocking on coordinator failure, and how heuristic decisions break atomicity
reading:
- Re-read a system of promises; coordinator failure | 347-349
- Re-read holding locks while in doubt; recovering from coordinator failure | 352-353
complete:
- All tests T1–T5 pass
- You counted the fsyncs in one transfer and can say which ones are essential
- You answered the quiz
---

:::note Today is a building day
Four functions, about 70 lines. The bank, the logs and the crash injection are given. Budget about 100 minutes. Keep the 2PC visualization from Week 16 open. Each test corresponds to a scenario you can step through there.
:::

:::intuition Where the durable writes go
<div class="figure">
<svg class="dg" viewBox="0 0 660 190" role="img" aria-label="2PC sequence with durable log writes marked">
  <text x="20" y="30" font-weight="700">Coordinator</text><text x="20" y="100" font-weight="700">DB 1</text><text x="20" y="165" font-weight="700">DB 2</text>
  <line x1="110" x2="650" y1="26" y2="26" stroke="var(--ink-3)"/><line x1="110" x2="650" y1="96" y2="96" stroke="var(--ink-3)"/><line x1="110" x2="650" y1="161" y2="161" stroke="var(--ink-3)"/>
  <rect class="boxa" x="120" y="14" width="64" height="24" rx="4"/><text x="152" y="31" text-anchor="middle" class="sub">log begin</text>
  <path class="ln" d="M190 26 L240 96 M190 26 L240 161"/>
  <rect class="boxc" x="240" y="84" width="84" height="24" rx="4"/><text x="282" y="101" text-anchor="middle" class="sub">log prepared</text>
  <rect class="boxc" x="240" y="149" width="84" height="24" rx="4"/><text x="282" y="166" text-anchor="middle" class="sub">log prepared</text>
  <path class="ln" d="M324 96 L380 26 M324 161 L380 26"/>
  <rect class="boxd" x="380" y="12" width="120" height="28" rx="4"/><text x="440" y="31" text-anchor="middle" font-weight="700" style="font-size:12px">COMMIT POINT</text>
  <path class="ln" d="M500 26 L540 96 M500 26 L560 161"/>
  <rect class="boxb" x="540" y="84" width="80" height="24" rx="4"/><text x="580" y="101" text-anchor="middle" class="sub">log commit</text>
  <rect class="boxb" x="560" y="149" width="80" height="24" rx="4"/><text x="600" y="166" text-anchor="middle" class="sub">log commit</text>
</svg>
</div>

Every box is an `fsync`. The **prepared** records make the YES votes keepable after a crash. The **commit point** is the single durable fact that decides the outcome. The participants' **commit** records let them finish without asking again after their own restart.
:::

:::practice 34-two-phase-commit | Build it
TODOs 1–4, then read T5. Put the `_maybe_crash` calls exactly where the comments say. The T3 tests rely on them to crash at the right moments.
:::

:::quiz
### predict
In your implementation, the coordinator crashes right after writing "commit tx1" to its log, before sending anything. On recovery, what must happen?
- [ ] Abort, because no participant has committed yet
- [x] Commit on every participant: the decision is in the log, so it must be enforced
- [ ] Ask the participants to vote again
- [ ] Nothing; the participants will time out
>>>
That's the point of no return (p. 348), and test T3's "crash right after decision".

### mcq
Why does `Participant.recover` re-acquire the locks of prepared transactions?
- [ ] For performance
- [x] Because the transaction is still in doubt and may yet commit; if other transactions could change those rows meanwhile, committing later could violate isolation or the constraints that the YES vote checked
- [ ] Because locks are stored in the log
- [ ] It doesn't need to
>>>
Correct 2PC preserves in-doubt locks even across reboots (p. 353).

### mcq
Which `fsync` could you remove without breaking atomicity, if you accept slower recovery?
- [ ] The participant's prepared record
- [ ] The coordinator's decision record
- [x] The participant's commit record, if the participant can instead ask the coordinator for the outcome after a restart (as long as the coordinator keeps its decision)
- [ ] None of them can ever be removed
>>>
The prepared record and the decision are the two promises. The participant's commit record is an optimization, as long as the coordinator remembers its decision until every participant has acknowledged it.

### explain
Your T5 test shows money "vanishing" after a heuristic abort. Explain exactly which promise was broken and by whom.
>>>
DB 2 voted YES in phase 1, promising to commit if the coordinator decided commit, and giving up its right to abort (p. 348). The coordinator then decided commit (logged at the commit point), and DB 1 committed, subtracting $30 from Alice. The heuristic abort made DB 2 abort unilaterally, without the coordinator's decision, breaking DB 2's own promise. The result: DB 1 committed and DB 2 aborted, so Alice lost $30 and Bob never received it. Atomicity is violated. That's why "heuristic" is a euphemism for probably breaking atomicity, and why it should only be used to escape catastrophes, followed by manual reconciliation (p. 353).
:::
