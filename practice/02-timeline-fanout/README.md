---
title: Twitter timelines — fan-out on read vs on write
chapter: 1
topic: Load parameters, fan-out, read/write trade-offs
minutes: 50
---

## Objective

Rebuild the Twitter example from the book (pp. 9–11) on a synthetic social graph and *measure*
how the choice of approach moves work between writes and reads. You will see why the
**distribution of followers** — not the tweet rate — is the load parameter that matters.

## Setup

Python 3.10+, nothing to install. Open `practice/02-timeline-fanout/timelines.py`.

- `build_graph()` creates 20,000 users whose popularity follows a power law: a handful of
  "celebrities" with thousands of followers, most users with a few.
- `build_workload()` mixes posts and timeline reads at about **1 : 65** (Twitter's 2012 ratio of
  4.6k tweets/s to 300k timeline reads/s).
- `PullTimelines` (approach 1, query on read) is already implemented. Read it.

## Predict first

1. Approach 2 will do far fewer read operations. Roughly how many *write* operations will it do compared with approach 1: 2×, 25×, or 1000×?
2. What will the "worst single post" cost be under approach 2, and which user causes it?

## Your task

1. Implement `PushTimelines.post` and `.read` (approach 2, fan-out on write).
2. Implement `HybridTimelines.post` and `.read`: fan out for normal users, but for users with more than
   `celebrity_threshold` followers, store the tweet once and merge it in at read time.
3. The harness checks that your timelines contain **exactly** the same tweets as approach 1, so a
   wrong merge order will be caught.
4. Experiment: change `celebrity_threshold` (e.g. 200, 1000, 5000) in the `run(...)` call for the
   hybrid and watch both columns move.

## Run it

```
python practice/02-timeline-fanout/timelines.py
```

## Observe

- Approach 1: ~1 write per post, but tens of lookups per timeline read — and reads are 65× more frequent.
- Approach 2: reads become a single lookup; writes multiply by the number of followers. The worst post
  (by the most-followed user) costs thousands of writes in one go — on real Twitter, over 30 million.
- Hybrid: the worst-case post shrinks dramatically. The threshold is a dial between read cost and write cost.

## Questions

1. Express each approach's cost in terms of load parameters: posts/s, reads/s, average followers, average followees, and the follower distribution.
2. Why does the *average* number of followers (75 on Twitter) give a misleading picture of the fan-out problem?
3. Twitter tries to deliver tweets within 5 seconds. Which approach makes that latency target hardest, and for whom?
4. In the hybrid, what happens to read cost if you set the threshold very low? Very high?

<details><summary>Discussion</summary>

1. Pull: writes ≈ posts/s; reads ≈ reads/s × followees. Push: writes ≈ posts/s × followers-of-poster; reads ≈ reads/s. Hybrid: writes ≈ posts/s × followers (only for non-celebrities); reads ≈ reads/s × (1 + celebrities followed).
2. The distribution is heavily skewed. Averages hide the tail: one celebrity post costs millions of writes, which dominates latency and capacity planning even though it is rare.
3. Fan-out on write, for followers of celebrities: 30 million cache inserts must finish within 5 s.
4. Very low → almost everybody is a "celebrity", so you are back to approach 1 (expensive reads). Very high → nobody is, so you are back to approach 2 (expensive celebrity posts).
</details>
