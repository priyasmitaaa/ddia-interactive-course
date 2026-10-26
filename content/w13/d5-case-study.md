---
title: Case Study — Anatomy of a Split-Brain Incident
kind: lesson
minutes: 75
chapter: 8
objectives:
- Diagnose a realistic multi-cause incident using Chapters 5–8 together
- Identify which failure detector, clock, lease and replication assumptions each step violated
- Propose layered fixes and classify them as safety or liveness improvements
reading:
- Re-read the leader and the lock; fencing tokens | 293-295
- Re-read the Chapter 8 summary | 302-303
complete:
- You wrote your own diagnosis for each stage before reading the analysis
- You produced a list of fixes, each labeled safety or liveness
- You answered the quiz
---

:::problem 02:14, Saturday: two leaders
This scenario is made up for teaching, but every mechanism in it comes from the book. A payments ledger runs on a single-leader database with **asynchronous** replication to two followers (Chapter 5). A separate coordinator holds the leader **lease** (30 s, renewed when fewer than 10 s remain, as in the loop on p. 287) and runs failure detection with a **fixed 2-second heartbeat timeout**. Writes also update a balance **cache** in a leaderless store that resolves conflicts with **LWW** using each app server's time-of-day clock (Chapter 5, Chapter 8).

**What the logs show:**
1. 02:13:40: a nightly reconciliation job starts and saturates the network. Heartbeat round trips grow from 1 ms to around 1.5 s.
2. 02:14:02: the leader (node A) starts a **full garbage collection** that lasts **38 s**.
3. 02:14:04: heartbeats from A time out. The coordinator waits for A's lease to expire, **promotes follower B**, and gives it the lease.
4. 02:14:40: A finishes GC. It had already passed its `lease.isValid()` check and was processing a batch of 120 payments, so it **commits them locally** and acknowledges them to clients. They never reach B.
5. 02:14:41: A tries to renew its lease, is refused, and steps down. Its 120 local writes are **discarded** when it rejoins as a follower of B.
6. Meanwhile, app servers updating the balance cache run on two hosts whose clocks differ by **4 s** (one host's NTP traffic had been blocked by a firewall change weeks earlier). Some balance updates are silently overwritten by older ones.

Before reading on, write down for each step: **which assumption failed**, and **which chapter's idea would have prevented or contained it**.
:::

:::intuition The analysis
<div class="figure">
<svg class="dg" viewBox="0 0 660 170" role="img" aria-label="Incident timeline: network saturation, GC pause on A, failover to B, A's stale writes, and LWW cache corruption">
  <line x1="20" x2="650" y1="60" y2="60" stroke="var(--ink-3)"/><line x1="20" x2="650" y1="120" y2="120" stroke="var(--ink-3)"/>
  <text x="20" y="50" font-weight="700">Node A (old leader)</text><text x="20" y="110" font-weight="700">Node B (new leader)</text>
  <rect x="140" y="50" width="300" height="20" fill="var(--warn-soft)" stroke="var(--v-c)"/><text x="150" y="65" class="sub">38 s GC pause (lease expires inside it)</text>
  <rect class="boxe" x="200" y="110" width="440" height="20" rx="4"/><text x="210" y="125" class="sub">holds the lease from ~02:14:34</text>
  <circle cx="445" cy="60" r="6" fill="var(--v-d)"/><text x="455" y="45" fill="var(--v-d)" font-weight="700">120 writes committed and acked on A</text>
  <text x="455" y="85" class="sub">… then lost on rejoin</text>
  <text x="20" y="160" class="sub">02:14:00            02:14:20            02:14:40            02:15:00 (schematic)</text>
</svg>
</div>

**Step 1, false suspicion risk (Ch 8, timeouts).** Queueing near capacity pushes RTTs toward the 2 s timeout (pp. 274–275). Even before the GC, the detector was close to declaring a healthy node dead. A fixed timeout chosen in quiet conditions is fragile, and adaptive detection or isolating batch traffic would help (p. 276).

**Steps 2–3, the pause (Ch 8, process pauses).** A 38 s stop-the-world GC is entirely plausible (p. 288). From the coordinator's view, A is indistinguishable from a crashed node (Figure 8-1), so failing over is a *correct* decision by the majority's truth (p. 292).

**Step 4, the real bug (Ch 8, the leader and the lock).** A acted on a stale belief, "I'm the leader", formed before the pause. That's Figure 8-4 with a database instead of a file. Nothing at the *resource* rejected A's writes. A was its own storage, so it never checked whether its authority was still current. The fix is **fencing**: each leadership term carries an increasing token (an epoch), and every write path must check it. Here that means A must not acknowledge commits without confirming with the coordinator or a quorum of followers that its epoch is still current. Followers and any external resources reject writes from an older epoch. Chapter 9 makes this rigorous: consensus with epoch numbers, and leaders that must get a quorum to accept each decision.

**Step 5, lost acknowledged writes (Ch 5, failover pitfalls).** With asynchronous replication, the new leader may not have the old leader's latest writes, and they're commonly discarded, which violates the clients' durability expectations. The book discusses this exact hazard when covering failover, including GitHub's incident (Chapter 5). Synchronous or semi-synchronous replication to at least one follower narrows the window, and fencing stops new writes from being accepted by a deposed leader at all.

**Step 6, silent cache corruption (Ch 8, LWW and clocks).** A 4 s skew means writes from the slow host lose to older writes from the fast host until the skew has elapsed (p. 284). Nobody noticed, because broken clocks cause silent data loss, not crashes (p. 283). The fixes: monitor clock offsets and eject drifting nodes, and don't use LWW for values that matter. Use causality tracking or conditional updates instead.
:::

:::details Layered fixes, classified
| Fix | Protects | Kind |
|---|---|---|
| Fencing tokens / epochs checked on every write path | No writes accepted from a deposed leader | **Safety** |
| Leader confirms its epoch with a quorum before acknowledging commits | No acknowledged write can be lost to a concurrent leader | **Safety** |
| Semi-synchronous replication (at least one follower acks) | Fewer acknowledged writes lost on failover | Safety (durability) |
| Stop relying on LWW for balances; use version checks or causality | No silently dropped balance updates | **Safety** |
| Monitor clock offsets; remove nodes that drift | Limits damage from silent clock faults | Safety (detection) |
| Adaptive failure detection; isolate batch traffic | Fewer needless failovers | **Liveness** / availability |
| GC tuning, "planned outage" GC, periodic restarts | Shorter, rarer pauses | Liveness / latency |

The pattern: **safety fixes make bad outcomes impossible**, even if every timing assumption breaks. **Liveness fixes make bad situations rarer**. You need both, but the safety fixes must not depend on timing. That's the design principle behind every algorithm in Chapter 9 (pp. 300–301).
:::

:::quiz
### mcq
At step 3, the coordinator declared A dead while A was only paused. Was that decision wrong?
- [ ] Yes, the coordinator should have waited for A to respond
- [x] No: from outside, a long pause is indistinguishable from a crash; the system must act on the majority's view, and the bug was that A kept acting on its stale belief afterwards
- [ ] Yes, because GC pauses never last that long
- [ ] No, because A had crashed
>>>
A node cannot trust its own judgment, and the system can't wait forever. The danger is what the "dead" node does when it comes back (pp. 292–293).

### mcq
Which single fix most directly prevents step 4 (the deposed leader committing writes)?
- [ ] A longer heartbeat timeout
- [ ] More RAM to shorten GC
- [x] An increasing epoch or fencing token that the write path checks (with a quorum or the coordinator) before acknowledging writes
- [ ] NTP on all servers
>>>
Longer timeouts and GC tuning make it rarer. Fencing makes it impossible regardless of timing (pp. 294–295).

### tradeoff
Raising the heartbeat timeout from 2 s to 60 s would have avoided this failover. Why is that not a real fix?
- [x] It only changes liveness: a 60 s pause would cause the same bug, and real crashes would now take a minute to detect; safety must not depend on timing assumptions
- [ ] Because 60 s is too short
- [ ] Because timeouts don't affect failover
- [ ] It is a real fix
>>>
Timeouts trade detection speed against false suspicions (p. 273). They can't prevent a stale leader from acting.

### scenario
After the incident, someone proposes: "Have A check its lease again right before each commit." Evaluate the proposal.
>>>
It narrows the window but doesn't close it. A can be paused *between* the second check and the commit, exactly as it was paused after the first check (pp. 287–289). Any check by the actor itself has this gap, because the thread can't notice it was paused. The robust approach moves the check to the receiving side: followers or the storage reject writes tagged with an outdated epoch or fencing token, or the commit requires acknowledgment from a quorum that knows the current epoch (p. 295, Chapter 9). Re-checking locally is still a reasonable cheap mitigation that makes the bug rarer, but it isn't a guarantee.

### design
Sketch how you'd test that the fixed system is safe, using ideas from Chapter 8.
>>>
State the properties first. Safety: no acknowledged payment is ever lost; at most one leader's writes are accepted per epoch; balances reflect all acknowledged payments. Liveness: with a majority up and the network healthy, writes eventually succeed. Then inject the faults the chapter describes and record histories. Pause the leader process (SIGSTOP, or a simulated GC) for longer than the lease. Add network delay and partitions, including asymmetric ones (drop only outbound packets). Step or skew clocks on app servers. Kill and restart nodes, and occasionally wipe a disk. After each run, check the recorded client history against the safety properties (as in Lab 30's checker) and measure liveness separately (time to recover). Theoretical analysis plus this kind of empirical fault-injection testing are both needed (pp. 299–302).
:::

:::connect Where this goes next
Tomorrow's checkpoint covers all of Chapter 8. Then Chapter 9 turns from problems to solutions: linearizability, ordering, and consensus. These are the tools that make "exactly one leader" and "increasing epochs" actually work.
:::
