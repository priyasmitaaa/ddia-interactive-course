---
title: Lab — leader election with terms and quorums, fuzz-tested
chapter: 9
topic: Epoch numbering, majority quorums, election safety, property-based fault injection
minutes: 100
---

## Objective

Implement the core of what p. 358 describes: **epoch numbers** (terms), **one vote per node per
term**, and **leadership only with a strict majority**. Then do what serious distributed-systems
teams do. Fuzz the protocol with random network partitions, crashes and restarts, and check the
safety property *"within each epoch, the leader is unique"* across thousands of elections. Two
deliberately broken variants show the checker finds real bugs.

The rules follow **Raft** (term numbers, the "log at least as up to date" vote rule). The book names
Raft but doesn't detail it, so this is a simplified subset. It isn't a complete consensus
implementation: there's no log replication protocol or commit rules here. The **Consensus**
visualization (RaftSim) in this week's lessons shows the same ideas running.

## Setup

Python 3.10+, standard library only. Files: `practice/35-leader-election/election.py` (TODOs 1–4)
and `test_election.py` (T1–T4). The fuzzer (given) runs 1,000 random scenarios in under a second.

## Predict first

1. Five nodes are split 2 | 3. Which side can elect a leader?
2. If a node may vote for two different candidates in the same term, can two leaders win the same term?
3. Four nodes, and someone decides "2 votes is a majority". What happens in a 2 | 2 split?

## Your task

1. **TODO 1** `handle_request_vote` → T1.
2. **TODO 2** `start_election` → T2.
3. **TODO 3** `handle_heartbeat` → T3.
4. **TODO 4** `election_safety_violations` → T4, which also runs the fuzzer.

## Run it

```
python practice/35-leader-election/test_election.py
python practice/35-leader-election/election.py
```

## Observe

- The correct protocol: over 10,000 elections, **zero** terms with two leaders, however the network
  is cut or nodes crash. Leaders can still be *deposed* constantly. Safety holds, while liveness
  (making progress) depends on the network (p. 359).
- **Voting twice per term**: two candidates can each gather a majority in the same term, because
  the two majorities overlap only in a node that voted for both.
- **Half is not a majority**: with 4 nodes, a 2 | 2 partition elects a leader on *each* side. Two
  groups of 2 don't have to overlap. Majority quorums work only because any two majorities share
  at least one node (pp. 292–293, 358).
- Restarted nodes keep their term and vote, because they're on disk. If a node "forgot" its vote
  after a crash, it could vote twice. Try making a restart also reset `voted_for` in the fuzzer and
  rerun. The checker catches it, but only about once in 10,000 elections. That's why such bugs
  survive ordinary testing and why fuzzing at scale matters.

## Questions

1. Why does a single node's vote-once-per-term rule, combined with majorities, guarantee at most one
   leader per term?
2. Why must a leader that receives a heartbeat rejection with a higher term step down immediately?
3. Why is "the candidate's log must be at least as up to date" needed, even though election safety
   holds without it?
4. The fuzzer shows many terms with *no* leader at all. Is that a bug? Which property is affected?

<details><summary>Discussion</summary>

1. A leader for term t needs votes from a majority. Any two majorities share a node, and that node
   votes at most once in term t, so two candidates can't both collect a majority in t (p. 358).
2. A higher term means a newer election happened, which a majority took part in. The old leader may
   have been declared dead during a pause or partition. If it kept acting, it could make conflicting
   decisions. That's the "delusional leader" of Chapter 8, and epochs are a form of fencing
   (pp. 293–295, 358).
3. It keeps committed data safe. A committed entry is stored on a majority, and any candidate needs
   votes from a majority. Some voter therefore has the entry and will refuse a candidate whose log
   lacks it. Without the rule, a node with a stale log could win and overwrite committed writes.
   This is part of the "recovery process" that keeps consensus safe after a leader change (p. 359).
4. No. Split votes and elections on a minority side fail, and the next timeout retries with a
   higher term. That's a liveness issue: progress needs a reachable majority and a calm-enough
   network. Frequent elections can hurt performance badly (pp. 359–360).
</details>
