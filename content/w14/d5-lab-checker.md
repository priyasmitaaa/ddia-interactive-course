---
title: Lab — Build a Linearizability Checker
kind: lab
minutes: 100
chapter: 9
objectives:
- Implement a register's sequential specification (read, write, compare-and-set)
- Implement a search for a linearization that respects real-time order
- Record concurrent histories from a replicated store and check them
- Explain why follower reads fail and leader reads pass
reading:
- Re-read what makes a system linearizable | 315-319
- Re-read implementing linearizable systems | 323-324
complete:
- All tests T1–T5 pass
- You can explain why "find any valid order" is the right test
- You answered the quiz
---

:::note Today is a building day
Two functions, about 40 lines. Recording the histories and windowing them are given. Budget about 90 minutes. The Linearizability visualization from Day 1 runs the same algorithm on a single history. If your checker disagrees with it, trust the visualization and look for the bug.
:::

:::intuition How the search works
<div class="figure">
<svg class="dg" viewBox="0 0 660 150" role="img" aria-label="Depth-first search over operations that may come next">
  <rect class="box" x="10" y="55" width="140" height="44" rx="8"/><text x="80" y="82" text-anchor="middle">state x = 0</text>
  <rect class="boxb" x="210" y="10" width="200" height="40" rx="8"/><text x="310" y="35" text-anchor="middle">try write(x,1) next → x = 1</text>
  <rect class="boxd" x="210" y="100" width="200" height="40" rx="8"/><text x="310" y="125" text-anchor="middle">try read→1 next → impossible</text>
  <rect class="boxb" x="460" y="10" width="190" height="40" rx="8"/><text x="555" y="35" text-anchor="middle">read→1 ✓ … continue</text>
  <path class="ln" d="M150 70 L210 30 M150 85 L210 120 M410 30 L460 30"/>
  <text x="10" y="40" class="sub">candidates = ops that no</text><text x="10" y="52" class="sub">pending op finished before</text>
</svg>
</div>

At each step, the candidates are the pending operations that could have taken effect next: those that no other pending operation *finished before they started*. Try each candidate against the register's specification. If its recorded result is impossible in the current state, prune. Memoize failures on (set of done operations, state). That's the whole algorithm.
:::

:::practice 31-linearizability-checker | Build it
Start with TODO 1 (`step`), then TODO 2 (`linearize`). Run T1–T4 after each, then T5, which records real threaded histories.
:::

:::quiz
### predict
Your checker gets a history where a read returns 7 but no operation ever wrote 7 (and the initial value is 0). What must it answer?
- [ ] Linearizable, because the read is concurrent with something
- [x] Not linearizable, since no order can make a read return a value that was never written
- [ ] It depends on timing
- [ ] It must crash
>>>
`step` rejects the read in every state the search can reach.

### mcq
Why is memoizing on (set of placed operations, current value) safe?
- [ ] Because operations are idempotent
- [x] Because whether the remaining operations can be linearized depends only on which ones remain and on the register's current value, not on the order the placed ones were applied in
- [ ] Because histories are short
- [ ] It isn't safe; it's a heuristic
>>>
The future of the search is determined by exactly those two things, so a failure from one order is a failure from any.

### mcq
Why do follower reads fail the check in T5, even though nothing crashed and no data was lost?
- [ ] Because the checker has a bug
- [x] Because asynchronous replication lets a reader see an older value after a newer one has already been written (or read), which a single copy could never do
- [ ] Because reads are too slow
- [ ] Because the writer uses compare-and-set
>>>
Stale reads from lagging followers are exactly what linearizability rules out (p. 323).

### explain
The windowing in T5 can miss violations but never reports false ones. Explain both halves of that claim.
>>>
It never reports a false violation because each window includes *every* operation that overlaps it in time, and the initial value may be any value written before the window. So if the whole history is linearizable, the restriction of that linearization to any window is valid, and the checker will find it. It can miss violations because a problem spanning two windows (for example a read early in window 1 that is inconsistent with a write far into window 3) is never examined as a whole, and starting each window with a permissive set of possible initial values can also hide some violations. Full-history checkers (Knossos, Porcupine) avoid this with cleverer search instead of windows.
:::
