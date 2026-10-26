---
title: Consistency and Consensus I — Linearizability
part: Part II · Distributed Data
chapters:
- 9
---
Chapter 9 moves from problems to solutions: general-purpose abstractions that let applications ignore some distributed-systems faults. This week covers the strongest common one, linearizability: make a replicated system behave as if there were a single copy of the data. You'll judge histories with a checker, see why strict quorums aren't enough, work out what CAP actually says, and build your own checker to catch a stale read.
