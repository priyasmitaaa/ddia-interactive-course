---
title: Failure detectors — fixed timeouts vs. Phi Accrual
chapter: 8
topic: Timeouts, unbounded delays, queueing, adaptive failure detection
minutes: 45
---

## Objective

Feel the trade-off on p. 273 in numbers: a short timeout declares healthy nodes dead, a long one
takes ages to notice a real crash. Then build the adaptive alternative the book mentions on p. 276 —
a **Phi Accrual failure detector** (used in Akka and Cassandra) that learns the distribution of
heartbeat intervals and outputs a suspicion level instead of yes/no.

## Setup

Python 3.10+, standard library only. Open `practice/28-failure-detectors/detectors.py`.
Everything runs in simulated time (two simulated minutes per run, well under a second of real time).

The delay model — exponential queueing that grows like load/(1−load), plus occasional pauses that
block the connection — is a simplification made for this exercise, not data from the book.

## Predict first

1. At 30% load with no pauses, which fixed timeout will have false suspicions: 150 ms, 500 ms, 2 s?
2. At 90% load, the median delay barely changes but the tail grows. What happens to the 150 ms timeout?
3. With occasional pauses of up to 1.5 s, can *any* detector both avoid false suspicions and detect
   a crash in under a second?

## Your task

1. **TODO 1** `FixedTimeoutDetector.suspect`.
2. **TODO 2** `PhiAccrualDetector.phi` — the formula is in the comments. Phi = −log10 of the
   probability that a heartbeat arrives even later than what we've already waited. Phi 1 ≈ 10% chance
   of being wrong, phi 3 ≈ 0.1%, phi 8 ≈ 0.000001% — under the (optimistic) normal-distribution assumption.
3. **TODO 3** `evaluate` — the monitor loop that counts false-suspicion episodes and the time to
   detect the real crash.

## Run it

```
python practice/28-failure-detectors/detectors.py
```

## Observe

- At low load everything works; the only difference is detection time (≈ the timeout).
- At 90% load, the 150 ms timeout fires repeatedly on a perfectly healthy node — every one of those
  would trigger a failover, moving load onto the remaining nodes (the cascading-failure risk on p. 273).
- Phi adapts: its detection time grows as jitter grows, without you re-tuning anything.
- With pauses, only the 2-second timeout avoids false suspicions — and it takes ~2 s to detect a crash.
  Neither fixed nor adaptive detectors can tell a long pause from a crash. Nothing can, from the outside (Figure 8-1).

## Questions

1. Why does the detection time of a fixed-timeout detector barely depend on load, while phi's does?
2. Phi assumes intervals are normally distributed. Why is that wrong for real networks, and in which
   direction does the error push you?
3. What's the point of `min_std_ms`? What would happen without it on a very quiet network?
4. Your monitoring flags a node as "suspected" 10 times a day, but it's never actually down. What would
   you change, and what does that cost you?

<details><summary>Discussion</summary>

1. A fixed detector always waits the same `timeout` after the last heartbeat; the crash is noticed
   about one timeout after the last heartbeat that arrived. Phi measures the spread of intervals: with
   more jitter, the standard deviation grows, so reaching a given phi takes longer — it automatically
   trades detection speed for fewer false alarms as conditions change (p. 276).
2. Real delays are heavy-tailed (queueing, pauses, retransmissions), so very late heartbeats are far
   more likely than a normal distribution predicts. Phi therefore *overestimates* its confidence: a
   "one in a million" phi of 8 fires more often than that. Practical detectors add safety margins
   (e.g. Akka's acceptable heartbeat pause).
3. On a quiet network the standard deviation can be tiny (a fraction of a millisecond), so a heartbeat
   arriving just 2 ms late would produce an enormous phi. The floor keeps the detector from becoming
   hypersensitive.
4. Lengthen the timeout (or raise the phi threshold), or make the measurement path more robust
   (dedicated network, avoid GC pauses in the heartbeat thread). The cost is slower detection of real
   failures — longer unavailability on a crash. There is no "correct" value; choose experimentally from
   the measured distribution (p. 276) and your tolerance for each kind of error.
</details>
