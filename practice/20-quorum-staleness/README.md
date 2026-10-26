---
title: How stale are quorum reads? Quantifying "eventual"
chapter: 5
topic: Quorums, w + r > n, staleness over time, availability trade-off
minutes: 40
---

## Objective

The book says eventual consistency is "deliberately vague", and that for operability it's
important to quantify "eventual" (p. 176). You'll build a Monte-Carlo model of a Dynamo-style
write followed by a read, and measure the probability of a stale read for different `n, w, r`,
for reads made some time after the write, and with replicas down.

## Setup

Python 3.10+. Open `practice/20-quorum-staleness/staleness.py`. Only `trial()` needs writing;
the harness runs 20,000 trials per configuration.

## Predict first

1. With n = 3, w = 1, r = 1, roughly what fraction of reads right after a successful write are stale: 1%, 10%, 25%, 60%?
2. With n = 3, w = 2, r = 2 (w + r > n), what fraction is stale in this model?
3. With 20% of replicas down, how often will writes with w = 3 fail?

## Your task

Implement `trial()` following the four steps in its docstring.

## Run it

```
python practice/20-quorum-staleness/staleness.py
```

## Observe

- With w + r > n, stale reads disappear in this model: any w replicas and any r replicas must overlap (Figure 5-11).
- With w + r ≤ n, a sizeable fraction of reads made *immediately* after the write are stale — but the probability falls quickly with time. "Eventual" can be measured: here, after ~4 mean network delays it's under 1%.
- Bigger w protects reads but costs availability: with replicas failing, w = n writes fail half the time, w = 1 almost never — the book's n/w/r dial (pp. 173–175).

## Questions

1. Your model says P(stale) = 0 for w + r > n. List three real-world effects from p. 175 that would make it non-zero.
2. Why does increasing n with w = r = 1 make staleness *worse*?
3. Which configuration would you choose for (a) a shopping cart, (b) a "likes" counter displayed on posts, (c) a password-change table? Why?
4. Sloppy quorums keep writes available when home replicas are unreachable. How would they change this model's stale-read results?

<details><summary>Discussion</summary>

1. Sloppy quorums (writes landing outside the home replicas), concurrent writes resolved by LWW with clock skew, writes concurrent with the read, writes that failed overall but succeeded on some replicas without rollback, and a replica with the new value failing and being restored from an old one (p. 175).
2. Each write initially exists on only 1 of n replicas, and a read asks just 1: with more replicas, it's more likely you hit one that hasn't received it yet.
3. Reasonable answers: (a) high availability matters, conflicts can be merged → w = 1 or 2 with sibling merging; (b) staleness is harmless → w = r = 1; (c) staleness could let an old password work → strict quorum (w + r > n) or, better, a strongly consistent store (Chapter 9).
4. Writes may go to stand-in nodes outside the n home replicas, so a read of r home replicas can miss them even when w + r > n, until hinted handoff completes — the stale probability is no longer zero (p. 177).
</details>
