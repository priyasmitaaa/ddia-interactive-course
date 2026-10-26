---
title: Think like a vertex — a Pregel engine
chapter: 10
topic: Bulk synchronous parallel graph processing, supersteps, message passing, graph partitioning
minutes: 50
---

## Objective

Build the core of the **Pregel model** (pp. 412–414). Run vertex programs in supersteps. A vertex
keeps its state in memory and reacts only to the messages sent to it in the previous superstep. The
job ends when no messages are in flight. Implement single-source shortest paths and connected
components on it, and check them against Dijkstra and BFS. Then measure the book's warning: with
hash partitioning, most messages cross machines (p. 414).

## Setup

Python 3.10+, standard library only. Files: `practice/39-pregel/pregel.py` (TODOs 1–3) and
`test_pregel.py`. The test graph has 20 dense "communities" of 50 vertices with a few links between
them, like a social network. Vertex IDs are contiguous within a community. The **Pregel**
visualization this week steps through supersteps on a 7-vertex graph.

## Predict first

1. On a path of 10 vertices, how many supersteps does connected-components need?
2. Does the choice of partitioner change the number of messages? The number of cross-machine messages?
3. Will the total number of messages be smaller or larger than the number of edges?

## Your task

1. **TODO 1** `run_pregel`: the engine, including the barrier between supersteps and message counting.
2. **TODO 2** `sssp_compute`: relax distances, and send only when something improved.
3. **TODO 3** `components_compute`: propagate the smallest label.

## Run it

```
python practice/39-pregel/test_pregel.py
python practice/39-pregel/pregel.py
```

## Observe

- Both algorithms match the single-machine references exactly. Vertices that learn nothing new send
  nothing, so they do no work in later supersteps.
- The **intermediate state (messages) is several times larger than the graph**: about 41,000 messages
  for about 9,000 edges in components. This is the overhead the book warns about (p. 414).
- **Hash partitioning** sends about three quarters of all messages across machines. A range
  partitioner that happens to keep communities together cuts that several-fold, with the same
  algorithm and the same total messages. Real graphs rarely come pre-sorted like this, and finding
  such a partitioning is hard, which is why hashing is common (p. 414).
- PageRank (given) runs a fixed number of supersteps with every vertex active, so it's a very
  different cost profile from SSSP, where only the "frontier" is active.

## Questions

1. Why can't plain MapReduce express "repeat until no distance changes" efficiently (p. 412)?
2. How does Pregel's fault tolerance work, and why does it need the barrier (p. 413)?
3. The whole graph here fits in memory on your laptop. What does the book say about that case (p. 414)?
4. Why is "the data is a graph" different from "the dataflow is a DAG" (box, p. 412)?

<details><summary>Discussion</summary>

1. A MapReduce job makes a single pass. Iteration needs an external scheduler running one job per
   step, and each job reads the entire input and writes a completely new output, even if only a few
   vertices changed (p. 412). Pregel keeps vertex state in memory and only processes vertices that
   have messages.
2. Vertex state is checkpointed at the end of supersteps. After a failure, the computation rolls
   back to the last checkpoint, or only the lost partition is recomputed if the algorithm is
   deterministic and messages are logged. The barrier guarantees that every message of a superstep
   is delivered exactly once in the next superstep, which makes a superstep boundary a consistent
   point to checkpoint (p. 413).
3. If the graph fits in memory on one machine, a single-machine (even single-threaded) algorithm
   will quite likely beat a distributed batch process. If it fits on one machine's disks, tools like
   GraphChi are viable. Go distributed only when you must (p. 414).
4. In dataflow engines the *operators* form a graph (DAG), while the data is relational-style tuples.
   In graph processing the *data itself* is a graph of vertices and edges. It's an unfortunate naming
   collision (p. 412).
</details>
