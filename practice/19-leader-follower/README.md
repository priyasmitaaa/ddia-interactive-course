---
title: Lab — leader-based replication, lag and failover
chapter: 5
topic: Sync vs async replication, catch-up recovery, read-your-writes, failover data loss
minutes: 100
---

## Objective

Build single-leader replication on a simulated network and *prove* (with tests) four facts from
the book: synchronous replication blocks when its follower is down (p. 148); followers recover by
asking for the log from their last position (p. 150); reading your own writes needs the leader or
a sufficiently caught-up replica (p. 157); and failover with asynchronous replication loses
acknowledged writes (p. 151).

## Setup

Python 3.10+. Files in `practice/19-leader-follower/`: `replication.py` (TODOs 1–5) and
`test_replication.py`. The given `Sim` is a discrete-event simulator: nothing happens until you
call `sim.run()`, and time is simulated milliseconds — so tests are fast and deterministic.

## Predict first

1. With one synchronous follower 50 ms away (each direction ~55 ms), roughly how long until a write is acknowledged?
2. If the leader crashes 150 ms after the first of five writes sent every 30 ms, which writes will the fastest follower have?
3. With `read_your_writes=True`, when does a read go to the leader, and when can a follower serve it?

## Your task

1. **TODO 1** `Leader.write` → T1.
2. **TODO 2** acks on the leader and in-order apply on the follower → T2.
3. **TODO 3** catch-up recovery (`catchup` message, `reconnect`) → T3.
4. **TODO 4** `Client.read` with read-your-writes → T4.
5. **TODO 5** `failover` → T5.

## Run it

```
python practice/19-leader-follower/test_replication.py
```

## Observe

- Async: acknowledgement at time 0; followers converge later.
- Sync: acknowledgement after one round trip to the synchronous follower, never waiting for the async one; and **no acknowledgement at all** while it's down.
- After an outage, a follower requests exactly the entries it missed — the LSN is what makes catch-up easy.
- Async failover: the new leader is missing writes the client was told had succeeded.

## Questions

1. Why is "one synchronous follower, the rest asynchronous" (semi-synchronous) a common compromise?
2. In T5, the old leader comes back with the lost writes still in its log. What should it do with them, and why is that dangerous (think: GitHub's primary keys)?
3. Your read-your-writes implementation relies on the client knowing its last write's LSN. What breaks if the same user writes from their phone and reads on their laptop?
4. How would you choose the failure-detection timeout before triggering failover?

<details><summary>Discussion</summary>

1. It guarantees an up-to-date copy on at least two nodes (leader + one follower) without letting any single follower outage block writes: if the synchronous follower fails, an async one is made synchronous (p. 148).
2. Usually discard them (they conflict with whatever the new leader accepted), which silently drops acknowledged writes; and if other systems already used those writes' IDs (e.g. a cache keyed by auto-increment IDs), the new leader may reuse the same IDs for different rows — inconsistency, even data disclosure (p. 151).
3. The laptop doesn't know the phone's last LSN; the metadata would have to be centralised, and the two devices may even be routed to different datacenters (p. 157).
4. Too long → slow recovery; too short → unnecessary failovers during load spikes or network glitches, which make an overloaded system worse (pp. 151–152). Chapter 8 discusses timeouts in depth.
</details>
