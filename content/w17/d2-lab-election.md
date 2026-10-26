---
title: Lab — Leader Election with Terms and Quorums
kind: lab
minutes: 100
chapter: 9
objectives:
- Implement RequestVote handling with one vote per term and the up-to-date log rule
- Implement elections that need a strict majority, and stepping down on a higher term
- Write a safety checker for "at most one leader per term"
- Use fuzzing to show the correct protocol is safe and two plausible-looking bugs are not
reading:
- Re-read epoch numbering and quorums | 358-359
- Re-read fault-tolerant consensus | 355-356
complete:
- All tests T1–T4 pass
- You found and can explain both deliberate bugs
- You answered the quiz
---

:::note Today is a building day
Four small functions. The fuzzer that throws partitions and crashes at them is given. Budget about 90 minutes. The consensus simulator from Week 16 runs the same rules with a log attached. Use it to replay any case your tests flag.
:::

:::intuition Why one vote and a majority are enough
<div class="figure">
<svg class="dg" viewBox="0 0 660 150" role="img" aria-label="Two majorities of five nodes always overlap in at least one node">
  <rect class="boxa" x="20" y="40" width="330" height="70" rx="12"/><text x="30" y="32" class="sub">candidate X's majority (term 7)</text>
  <rect class="boxe" x="250" y="40" width="390" height="70" rx="12" style="fill-opacity:.35"/><text x="460" y="32" class="sub">candidate Y's majority (term 7)</text>
  <g font-weight="700"><text x="70" y="82">A</text><text x="150" y="82">B</text><text x="290" y="82">C ← votes once</text><text x="480" y="82">D</text><text x="580" y="82">E</text></g>
  <text x="20" y="135" class="sub">Any two groups of 3 out of 5 share a node. That node votes only once per term, so only one of X and Y can win term 7.</text>
</svg>
</div>
:::

:::practice 35-leader-election | Build it
TODOs 1–4. Run T1–T3 after each function, then T4, which fuzzes 1,000 random scenarios.
:::

:::quiz
### mcq
Why must a node persist its `voted_for` and `term` to disk before replying to a vote request?
- [ ] For logging
- [x] Because if it crashes and forgets, it could vote again in the same term after restarting, letting two candidates win that term
- [ ] Because elections are slow
- [ ] It doesn't need to
>>>
That's the "amnesia" problem from Chapter 8 (p. 301). The lab's fuzzer can detect it.

### predict
A leader in term 4 sends a heartbeat to a node that's already in term 6. What must happen?
- [ ] The node adopts term 4
- [x] The node rejects the heartbeat; the leader learns of term 6 and steps down
- [ ] Both become leaders
- [ ] The node crashes
>>>
The higher epoch always prevails (p. 358).

### mcq
Election safety held in every fuzzing run, yet many terms had no leader. Which property suffers?
- [ ] Safety
- [x] Liveness (progress): no leader means no writes until a later election succeeds
- [ ] Integrity
- [ ] Validity
>>>
Safety must always hold. Liveness depends on a majority and a calm enough network (pp. 300, 359).

### explain
Explain why the "half counts as a majority" bug on 4 nodes produces two leaders in the same term, using the overlap argument.
>>>
With 4 nodes and a "quorum" of 2, a partition into {A, B} and {C, D} lets each side gather 2 votes, a "majority" by the buggy rule, in the same term. Each node votes only once, but the two groups are disjoint, so no single node had to choose between the candidates. The safety argument depends on any two quorums sharing at least one node, which a strict majority (more than n/2) guarantees and n/2 doesn't (pp. 292–293, 358). The fuzzer finds hundreds of such terms, which shows how a small arithmetic slip turns into split brain.
:::
