---
title: Lab — Build MVCC and Serializable Snapshot Isolation
kind: lab
minutes: 110
chapter: 7
objectives:
- Implement multi-version storage with created_by/deleted_by and the four visibility rules
- Implement first-committer-wins lost-update detection
- Implement SSI-style validation for read-write transactions
- Demonstrate in tests that SI allows write skew and SSI prevents it
reading:
- Re-read implementing snapshot isolation and visibility rules | 230-232
- Re-read detecting stale reads and writes that affect prior reads | 254-256
complete:
- All tests T1–T5 pass
- You can explain why your SSI aborts more than PostgreSQL's
- You answered the quiz
---

:::note Today is a building day
You'll write the core of a database's concurrency control in ~60 lines. The data structures, scans and abort logic are given; you write visibility, writes and commit-time validation. Budget ~90 minutes. The Transactions simulator in the lessons implements the same ideas — use it to check your intuition when a test fails.
:::

:::intuition The three checks in one picture
<div class="figure">
<svg class="dg" viewBox="0 0 660 170" role="img" aria-label="Snapshot reads, then commit-time checks">
  <rect class="boxa" x="10" y="40" width="190" height="70" rx="8"/><text x="105" y="65" text-anchor="middle" font-weight="700">read / scan</text><text x="105" y="84" text-anchor="middle" class="sub">from my snapshot</text><text x="105" y="99" text-anchor="middle" class="sub">(visibility rules 1–4)</text>
  <rect class="boxb" x="235" y="40" width="160" height="70" rx="8"/><text x="315" y="65" text-anchor="middle" font-weight="700">write</text><text x="315" y="84" text-anchor="middle" class="sub">mark old deleted_by me</text><text x="315" y="99" text-anchor="middle" class="sub">append new version</text>
  <rect class="boxd" x="430" y="10" width="220" height="60" rx="8"/><text x="540" y="33" text-anchor="middle" font-weight="700">commit check 1 (SI)</text><text x="540" y="52" text-anchor="middle" class="sub">concurrent commit wrote MY key? → abort</text>
  <rect class="boxe" x="430" y="90" width="220" height="70" rx="8"/><text x="540" y="113" text-anchor="middle" font-weight="700">commit check 2 (SSI)</text><text x="540" y="132" text-anchor="middle" class="sub">I wrote something, and a concurrent</text><text x="540" y="147" text-anchor="middle" class="sub">commit wrote what I READ? → abort</text>
  <path class="ln" d="M200 75 H235 M395 70 L430 40 M395 85 L430 125"/>
</svg>
</div>

"Concurrent commit" = a transaction whose commit came after my start. Check 1 is first-committer-wins (lost-update detection); check 2 catches outdated premises (write skew and phantoms).
:::

:::practice 26-mvcc-ssi | Build it
TODOs 1–4. T5's first test deliberately asserts that plain snapshot isolation *allows* write skew — make sure you understand why before moving on to TODO 4.
:::

:::quiz
### predict
In your implementation, transaction 7 started while transaction 5 was still active. Transaction 5 then commits a new version of key K. Transaction 7 reads K. Which version does it get?
- [ ] Transaction 5's new version
- [x] The previous version — tx 5 was in progress when tx 7 started (rule 1)
- [ ] None
- [ ] Both
>>>
Visibility is fixed at the start of the transaction; that's what makes it a snapshot.

### mcq
Why does T5's SSI test allow the reader-only transaction to commit even though a concurrent transaction changed data it scanned?
- [ ] Because scans aren't tracked
- [x] Because a read-only transaction saw a consistent snapshot and can't cause write skew; validation only applies to transactions that wrote something
- [ ] Because it committed first
- [ ] Because the write was to a different prefix
>>>
The book's reason for deferring aborts until commit (p. 254).

### mcq
Which check makes a counter's lost update fail with SerializationFailure in your database?
- [x] First-committer-wins: a transaction that committed after my start created a version of a key I wrote
- [ ] The SSI read check
- [ ] A deadlock detector
- [ ] The visibility rules
>>>
That's TODO 3 — PostgreSQL's repeatable read does the same (p. 236).

### explain
Your SSI implementation aborts a read-write transaction whenever any concurrent transaction that committed first wrote any data it read. Describe a case where this aborts unnecessarily, and what real SSI implementations do about it.
>>>
Example: T reads key X (and doesn't use it for its decision in a meaningful way, or the other transaction's write didn't actually change the result relevant to T), writes Y; U concurrently writes X and commits first. The schedule "T then U" would be equivalent and serializable (T read the old X, which is consistent with T running before U), as long as U didn't also depend on something T wrote. Our coarse rule aborts T anyway. Real SSI tracks read-write dependencies between transactions and aborts only when there's a "dangerous structure" (e.g. two consecutive rw-dependencies forming a potential cycle); PostgreSQL uses such theory to reduce unnecessary aborts, trading bookkeeping for precision (p. 256).
:::

:::connect Where this goes next
Chapter 7 is done. Tomorrow's checkpoint, then Chapter 8: everything that can go wrong when the machines running these transactions talk over a network — and why "a timeout tells you nothing" (Week 1's exercise) becomes the central problem.
:::
