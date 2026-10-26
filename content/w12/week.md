---
title: The Trouble with Distributed Systems I — Networks, Clocks and Pauses
part: Part II · Distributed Data
chapters:
- 8
---
Chapter 8 turns pessimism up to the maximum. This week covers the three things a node can't trust. The first is the network: messages get lost or delayed, and a missing reply tells you nothing. The second is its clock: clocks drift, jump and disagree. The third is its own execution, which can be paused at any moment without the node noticing. You'll measure the timeout trade-off, watch last-write-wins drop writes because of a 3 ms skew, and see a paused lease holder corrupt data.
