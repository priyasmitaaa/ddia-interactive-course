---
title: Lab — An Exactly-Once Stream Processor
kind: lab
minutes: 100
chapter: 11
objectives:
- Reproduce double-counting under at-least-once processing with crashes
- Implement idempotent writes keyed by the event offset
- Implement an atomic transaction over state and the input offset
- Make an external side effect (email) idempotent with a deduplication key, and explain its limits
reading:
- Re-read atomic commit revisited and idempotence | 461-462
- Re-read rebuilding state after a failure | 462-462
complete:
- All tests T0–T3 pass
- You can explain why recording the dedupe key before sending gives at-most-once
- You answered the quiz
---

:::note Today is a building day
Three methods, about 50 lines. The log, the crash injector and the at-least-once baseline are given. Budget about 90 minutes. The Exactly-once visualization from yesterday shows the same four strategies step by step.
:::

:::intuition The three commit orders
<div class="figure">
<svg class="dg" viewBox="0 0 660 180" role="img" aria-label="Three orderings of state write and offset commit and what a crash between them does">
  <text x="10" y="22" font-weight="700">at-least-once</text>
  <rect class="boxb" x="150" y="8" width="150" height="24" rx="4"/><text x="225" y="25" text-anchor="middle" class="sub">balance += amount</text>
  <text x="315" y="25" fill="var(--v-d)" font-weight="700">💥</text>
  <rect class="boxa" x="340" y="8" width="150" height="24" rx="4"/><text x="415" y="25" text-anchor="middle" class="sub">commit offset (file)</text>
  <text x="505" y="25" class="sub">→ replay → applied twice</text>
  <text x="10" y="82" font-weight="700">idempotent</text>
  <rect class="boxb" x="150" y="68" width="260" height="24" rx="4"/><text x="280" y="85" text-anchor="middle" class="sub">balance += amount, last_offset = off (if newer)</text>
  <text x="420" y="85" fill="var(--v-d)" font-weight="700">💥</text>
  <text x="445" y="85" class="sub">→ replay → skipped ✓</text>
  <text x="10" y="142" font-weight="700">transactional</text>
  <rect class="boxe" x="150" y="126" width="340" height="28" rx="4"/><text x="320" y="145" text-anchor="middle" class="sub">BEGIN · balance += amount · next_offset = off+1 · COMMIT</text>
  <text x="500" y="145" class="sub">💥 inside → rolled back ✓</text>
</svg>
</div>
:::

:::practice 44-exactly-once | Build it
Do TODO 1 (`run_idempotent`), TODO 2 (`run_transactional`), then TODO 3 (`notify`). Run T0 first to see the bug you're fixing.
:::

:::quiz
### predict
In `run_idempotent`, the offset file is committed only every 7 events, and a crash happens 5 events after the last commit. What happens on restart?
- [ ] The 5 events are lost
- [x] The 5 events are replayed, but each account's stored last_offset shows they were already applied, so they're skipped
- [ ] They're applied twice
- [ ] The processor refuses to start
>>>
Replays are expected. Idempotence makes them harmless (p. 461).

### mcq
Why does the transactional version need no separate offset file?
- [ ] Offsets aren't needed
- [x] The input offset is stored in the same database and the same transaction as the balances, so on restart it's read from there and is always consistent with the state
- [ ] SQLite tracks Kafka offsets automatically
- [ ] Because it never crashes
>>>
That's atomic commit of state plus offset in its cheapest form: one store (p. 461).

### mcq
Your `notify` inserts the dedupe key, then sends the email. A crash between the two does what?
- [ ] Sends the email twice
- [x] Loses the email: the key says "sent" but it never was (at-most-once)
- [ ] Nothing, since it's exactly-once
- [ ] Sends it to the wrong person
>>>
Swapping the order gives at-least-once instead. True exactly-once needs the email service to dedupe by your key, or to take part in atomic commit.

### explain
Which of the book's idempotence assumptions does the lab's log satisfy, and which would break if two processors handled the same accounts after a botched failover?
>>>
The log file replays the same events in the same order from any offset, and the processing (adding amounts) is deterministic, so the first two assumptions hold (p. 462). The third, that no other node concurrently updates the same value, holds only because a single processor instance runs at a time. If a supposedly dead processor were still running after failover, both could apply events concurrently. One might skip an event the other applied, or their conditional writes could interleave and produce inconsistent last_offset/balance pairs across accounts. You'd need fencing (an epoch or token checked on every write) to reject the zombie's writes (pp. 293–295, 462).
:::
