---
title: Lab — Build Leader-Based Replication
kind: lab
minutes: 110
chapter: 5
objectives:
- Implement asynchronous and synchronous replication with acknowledgements
- Implement in-order apply and catch-up recovery using log positions
- Implement read-your-writes using the position of the client's last write
- Measure data loss from failover with async vs sync followers
reading:
- Re-read synchronous vs asynchronous replication | 147-149
- Re-read handling node outages | 150-152
complete:
- All tests T1–T5 pass
- You can explain each test's assertion in book terms
- You answered the quiz
---

:::note Today is a building day
This week's ideas become ~60 lines of Python on a simulated network. The simulator (`Sim`) is a **discrete-event** simulator: events are scheduled at simulated times and processed in order when you call `sim.run()`. Nothing is random except small network jitter, so tests are fast and repeatable — the same technique real distributed-systems teams use to test failure scenarios (deterministic simulation testing). Budget ~90 minutes.
:::

:::intuition The replication protocol in three messages
<div class="figure">
<svg class="dg" viewBox="0 0 640 170" role="img" aria-label="Messages between leader and follower">
  <rect class="boxa" x="20" y="60" width="130" height="50" rx="8"/><text x="85" y="90" text-anchor="middle" font-weight="700">Leader</text>
  <rect class="boxb" x="490" y="60" width="130" height="50" rx="8"/><text x="555" y="90" text-anchor="middle" font-weight="700">Follower</text>
  <path class="lna" d="M150 70 H490"/><text x="320" y="62" text-anchor="middle">("replicate", lsn, (key, value))</text>
  <path class="ln" d="M490 90 H150"/><text x="320" y="85" text-anchor="middle">("ack", lsn)  — "I have everything up to lsn"</text>
  <path class="lnd dash" d="M490 105 H150"/><text x="320" y="125" text-anchor="middle">("catchup", from_lsn) — "I'm missing entries from here"</text>
  <text x="320" y="155" text-anchor="middle" class="sub">the LSN (position in the leader's log) is what makes ordering, acks and catch-up simple</text>
</svg>
</div>

- The follower applies entries **strictly in log order**. If an entry arrives with a gap before it, something was lost while it was down → ask for a catch-up.
- The leader acknowledges a write to the client **immediately** (async) or after **all synchronous followers** have acked that LSN.
- Read-your-writes: the client remembers the LSN of its last acknowledged write; a follower may serve the read only if it has applied at least that LSN.
:::

:::practice 19-leader-follower | Build it
TODOs 1–5 in order. Each test group maps to one book claim — read the test before writing the code.
:::

:::quiz
### predict
A follower has applied LSNs 0–2 and then receives `("replicate", 5, …)`. What should it do?
- [ ] Apply it, skipping 3 and 4
- [ ] Ignore it forever
- [x] Recognise a gap and send `("catchup", 3)` to the leader
- [ ] Crash
>>>
Applying out of order would break "apply all writes in the same order as the leader" (p. 147). Requesting from its next position is catch-up recovery (p. 150).

### mcq
In test T2, why must the acknowledgement time be less than ~400 ms even though follower 2 is 400 ms away?
- [ ] Because follower 2 is faster
- [x] Because only synchronous followers are waited for; follower 2 is asynchronous
- [ ] Because the test is wrong
- [ ] Because acks are sent before replication
>>>
Semi-synchronous replication: wait for the synchronous follower(s) only.

### mcq
In T4, why does the read go to the leader right after the write, but to follower f2 later?
- [ ] f2 is down at first
- [x] Right after the write, f2's applied LSN is below the client's last-write LSN; once f2 catches up, it can serve the read without violating read-your-writes
- [ ] The leader is faster
- [ ] Random routing
>>>
Position tracking only sends reads to the leader when necessary, preserving the read-scaling benefit (p. 157).

### explain
What does test T5 demonstrate, and how does it relate to the book's warning about asynchronous replication?
>>>
It shows that after the leader crashes, the most up-to-date asynchronous follower is promoted, but some writes that the client had been told succeeded never reached it — they're lost. With a synchronous follower, every acknowledged write is on that follower, so failing over to it loses nothing. This is the book's point that with async replication "a write is not guaranteed to be durable, even if it has been confirmed to the client" (p. 149), and the first failover danger on p. 151.
:::

:::connect Where this goes next
Keep this code — next week's leaderless lab and the capstone (Weeks 23–24) reuse the same simulator. Tomorrow is a review day; next week: multiple leaders and no leader at all.
:::
