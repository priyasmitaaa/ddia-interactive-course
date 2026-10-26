---
title: Replication II — Multiple Leaders, No Leader, and Concurrent Writes
part: Part II · Distributed Data
chapters:
- 5
---
What if more than one node accepts writes? Multi-leader replication (for multiple datacenters, offline clients and collaborative editing) and leaderless, Dynamo-style replication with quorums. Both allow concurrent writes, so you'll learn to detect them (happens-before, version vectors) and resolve them without losing data.
