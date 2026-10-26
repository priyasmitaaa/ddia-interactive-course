---
title: Lab — Leases, GC Pauses and Fencing Tokens
kind: lab
minutes: 100
chapter: 8
objectives:
- Implement a lease-based lock service that issues increasing fencing tokens
- Reproduce the Figure 8-4 corruption with real threads and fix it with fencing (Figure 8-5)
- Write a checker for the uniqueness and monotonic-sequence safety properties
- Use the checker to show that two independent counters break uniqueness
reading:
- Re-read the leader and the lock; fencing tokens | 293-295
- Re-read correctness of an algorithm; safety and liveness | 299-300
complete:
- All tests T1–T4 pass
- You can explain why the storage service, not the client, must check the token
- You answered the quiz
---

:::note Today is a building day
About 40 lines of code across three functions. The thread choreography of Figure 8-4 is given, and you write the lock service, the storage check and the property checker. Budget about 90 minutes. If a test fails, compare with the lease simulator in this week's lessons.
:::

:::intuition The three pieces
<div class="figure">
<svg class="dg" viewBox="0 0 660 160" role="img" aria-label="Lock service issues tokens; clients write to storage with tokens; storage rejects older tokens">
  <rect class="boxa" x="10" y="50" width="170" height="64" rx="8"/><text x="95" y="76" text-anchor="middle" font-weight="700">LockService</text><text x="95" y="95" text-anchor="middle" class="sub">lease + token 33, 34, …</text>
  <rect class="box" x="245" y="10" width="160" height="50" rx="8"/><text x="325" y="40" text-anchor="middle">client 1 (paused)</text>
  <rect class="box" x="245" y="100" width="160" height="50" rx="8"/><text x="325" y="130" text-anchor="middle">client 2</text>
  <rect class="boxb" x="470" y="50" width="180" height="64" rx="8"/><text x="560" y="76" text-anchor="middle" font-weight="700">Storage</text><text x="560" y="95" text-anchor="middle" class="sub">reject token &lt; max seen</text>
  <path class="ln" d="M180 70 L245 35 M180 95 L245 125 M405 35 L470 70 M405 125 L470 95"/>
  <text x="430" y="30" class="sub">write(33)</text><text x="430" y="140" class="sub">write(34)</text>
</svg>
</div>

The checker is separate from the service. It receives a **history** of requests (start time, end time, token) and looks for violations. This is how distributed systems are usually tested: run them, record what clients observed, then check the history against the properties.
:::

:::practice 30-fencing-lab | Build it
TODOs 1–3. Read `figure_8_4` before you start. The pause sits between "check the lease" and "use the lease", exactly where the book puts it on p. 287.
:::

:::quiz
### predict
In your lab with fencing on, a third client got token 35 and wrote, and then client 2 (token 34), slowed down by a pause, tries to write again. What happens?
- [ ] Accepted, because client 2's lease was valid when it started
- [x] Rejected, because storage has already seen 35
- [ ] Accepted, because 34 > 33
- [ ] Storage asks the lock service
>>>
Storage only remembers the highest token it has seen. Any write with a lower token is outside the current lock holder's protection (p. 295).

### mcq
Why must a renewal of a still-valid lease keep the same token instead of issuing a new one?
- [ ] To save numbers
- [x] Because the holder's in-flight writes carry its token; if renewal changed it, the holder's own earlier-token writes could be rejected, and the token would no longer identify "one lease period of one holder"
- [ ] Because ZooKeeper doesn't support new tokens
- [ ] It doesn't matter
>>>
The token increases when the lock is granted to a new holder (p. 294). A renewal is the same grant extended.

### mcq
Your checker flags two requests that overlap in time and got tokens in "reverse" order. Is that a violation of monotonic sequence?
- [ ] Yes
- [x] No: the property only constrains requests where one completed before the other began; concurrent requests may be ordered either way
- [ ] Only if they came from the same client
- [ ] Only for safety, not liveness
>>>
That's why the property is stated in terms of "x completed before y began" (p. 300).

### explain
The two-counter `BrokenTokenService` might look reasonable: two lock servers for availability, each with its own counter. Explain what goes wrong and what the correct approach would need.
>>>
Each server increments its own counter independently, so both hand out 101, then both 102, and so on. Uniqueness breaks immediately, and monotonic sequence breaks as well, because a later request can get a smaller or equal number from the other server. Storage then can't tell which holder is newer. There's no single source of truth. Making several servers agree on one increasing sequence, so that the service survives a node failure, is exactly the consensus problem of Chapter 9. In practice you'd use a consensus-based coordination service such as ZooKeeper, whose zxid or cversion increases monotonically and can serve as the fencing token (p. 295).
:::
