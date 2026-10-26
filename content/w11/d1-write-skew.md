---
title: Write Skew and Phantoms
kind: lesson
minutes: 95
chapter: 7
objectives:
- Explain write skew with the doctors-on-call example and why it's a generalisation of lost updates
- Explain why atomic operations, lost-update detection and simple constraints don't prevent it
- Recognise the four-step pattern behind write skew in several applications
- Define phantoms and explain why SELECT FOR UPDATE can't lock rows that don't exist
- Explain materializing conflicts and why it's a last resort
reading:
- Preventing write skew and phantoms; characterizing write skew | 237-240
- More examples of write skew | 240-241
- Phantoms causing write skew; materializing conflicts | 241-242
complete:
- You reproduced write skew and the double booking under snapshot isolation in the simulator
- You can describe the four-step pattern
- You answered the quiz
---

:::problem Nobody is on call
A hospital app lets doctors go off call, provided **at least one** colleague stays on call for the shift. Alice and Bob are on call; both feel ill and click "go off call" at the same moment (Figure 7-8). Each transaction checks: are two or more doctors on call? Under snapshot isolation, both see **2**, so both proceed. Alice updates her record; Bob updates his. Both commit. **No doctor is on call.** No dirty write, no lost update — they wrote *different* rows — and yet a race condition broke the requirement.
:::

:::intuition A decision based on a premise that changes
This anomaly is **write skew** (p. 238). If the transactions had run one after the other, the second would have seen only one doctor and refused. It's a race condition only possible because they ran concurrently.

Write skew can be seen as a **generalisation of the lost update**: two transactions read the same objects, then update *some* of them (maybe different ones). When they update the *same* object, you get a dirty write or lost update.

Options are more limited than for lost updates (p. 239):
- **Atomic single-object operations** don't help — several objects are involved.
- **Automatic lost-update detection** doesn't help: write skew is *not* detected by PostgreSQL's repeatable read, MySQL/InnoDB's repeatable read, Oracle's serializable or SQL Server's snapshot isolation. **Preventing it automatically requires true serializable isolation.**
- **Constraints**: "at least one doctor on call" involves multiple objects; most databases can't express such constraints (triggers or materialized views get hacky).
- Second-best without serializability: **explicitly lock the rows the transaction depends on**: `SELECT * FROM doctors WHERE on_call = true AND shift_id = 1234 FOR UPDATE;`
:::

:::visual TxnSim | Write skew and the phantom booking
@props {"scenario":"writeSkew","level":"si"}
**Try this:**
1. **Write skew** at **Snapshot isolation**: both transactions count 2 and both go off call.
2. Switch to **Read committed** — same result.
3. Choose **Phantom (room booking)** at Snapshot isolation: each transaction checks there's *no* booking, then both insert one.
4. Keep these in mind: on Day 3 and Day 4 you'll run the same scenarios with 2PL and SSI.
:::

:::details The pattern, and phantoms (pp. 240–242)
**More examples:**
- **Meeting room booking** (Example 7-2): check for overlapping bookings; if none, insert. Snapshot isolation doesn't stop another user inserting a conflicting booking concurrently. (PostgreSQL range types help express it, but you still need serializability.)
- **Multiplayer game**: a lock prevents two players moving the *same* piece, but not two *different* pieces moving to the *same* square.
- **Claiming a username**: check, then create — unsafe under snapshot isolation; fortunately a **unique constraint** solves it (the second insert is aborted).
- **Preventing double-spending**: insert a tentative spending item, list all items, check the sum is positive — two concurrent spends can drive the balance negative without either noticing.

**The pattern** (p. 241):
1. A `SELECT` checks some requirement by searching for rows matching a condition (≥ 2 doctors on call; no booking for that room and time; no piece on that square; username free; money left).
2. Depending on the result, the application decides to go ahead (or abort).
3. If it goes ahead, it writes (`INSERT`, `UPDATE` or `DELETE`) and commits.
4. **The write changes the result of step 1's search**: repeating the `SELECT` now gives a different answer.

In the doctors case, the rows modified in step 3 were among those returned in step 1, so `SELECT FOR UPDATE` in step 1 can fix it. The other four check for the **absence** of rows, and the write **adds** a matching row: if step 1 returns nothing, `SELECT FOR UPDATE` has **nothing to lock**.

A write in one transaction that changes the result of a search query in another is a **phantom**. Snapshot isolation avoids phantoms in *read-only* queries, but in read-write transactions they cause particularly tricky write skew.

**Materializing conflicts** (p. 242): if the problem is that there's no object to lock, introduce one: e.g. a table with a row for every room and 15-minute time slot for the next six months. A booking transaction `SELECT … FOR UPDATE`s the relevant slot rows, then checks and inserts. The table holds no booking data — it's purely a collection of locks. It turns a phantom into a lock conflict on concrete rows. But it's hard and error-prone to get right, and ugly to leak concurrency control into the data model — **a last resort**; serializable isolation is much preferable.
:::

:::quiz
### mcq
Why is the doctors-on-call anomaly neither a dirty write nor a lost update?
- [ ] Because it involves only reads
- [x] Because the two transactions update different objects (Alice's row and Bob's row); the conflict is in a premise they both read
- [ ] Because it happens under read uncommitted only
- [ ] Because the database aborts one transaction
>>>
Each transaction wrote its own row, so no write was overwritten; the problem is that both decided based on a count that the other's write made false. That's write skew (p. 238).

### mcq
Which databases' snapshot isolation automatically prevents write skew?
- [ ] PostgreSQL repeatable read
- [ ] Oracle serializable
- [ ] MySQL/InnoDB repeatable read
- [x] None of them — preventing write skew automatically requires true serializable isolation
>>>
The lost-update detection in these snapshot-isolation implementations only notices two writes to the same object; write skew writes different objects, so it slips through (p. 239).

### predict
Two users concurrently try to register the username "ada" under snapshot isolation; each first checks that no row with that name exists. The table has a UNIQUE constraint on username. What happens?
- [ ] Both accounts are created
- [x] One insert succeeds; the other is aborted by the unique-constraint violation
- [ ] Both are aborted
- [ ] The database deadlocks
>>>
Write skew in principle, but a unique constraint is a simple fix (p. 241).

### mcq
Why can't `SELECT … FOR UPDATE` prevent double-booking a meeting room?
- [ ] FOR UPDATE only works on primary keys
- [x] The check looks for the absence of rows; when no bookings exist, there are no rows to lock, and the conflicting write inserts a new row (a phantom)
- [ ] FOR UPDATE is not supported under snapshot isolation
- [ ] Bookings are stored in another database
>>>
You can only lock rows that exist. The check finds no rows, so nothing gets locked, and the competing transaction inserts a new matching row — a phantom (pp. 241–242).

### tradeoff
What does "materializing conflicts" mean, and why is it a last resort?
- [x] Creating rows that exist purely to be locked (e.g. one per room and time slot), turning phantoms into ordinary lock conflicts — but it's error-prone and leaks concurrency control into the data model
- [ ] Storing conflicts as siblings
- [ ] Writing conflicts to a log
- [ ] Using a materialized view
>>>
p. 242. Serializable isolation is much preferable.

### scenario
A points-redemption service checks a user's balance (sum of transactions) and inserts a negative "redemption" row if the balance suffices. Users have discovered they can redeem twice by double-clicking. Explain the anomaly and give two fixes.
>>>
It's write skew via phantoms (the double-spending example, p. 241): both concurrent transactions sum the same existing rows, both see enough points, and each inserts a new redemption row that the other's check didn't see; the balance goes negative. Fixes: run the transaction under serializable isolation (2PL or SSI), so one aborts and is retried; or materialize the conflict by locking a per-user row (e.g. `SELECT … FROM accounts WHERE user_id = ? FOR UPDATE`) before checking — or keep the balance in a single row updated atomically with a condition (`UPDATE accounts SET balance = balance − 100 WHERE user_id = ? AND balance >= 100`). An idempotency key also stops double-clicks specifically.
:::

:::connect Where this goes next
Isolation levels are hard to understand, inconsistently implemented, and the anomalies are hard to test for. The researchers' answer since the 1970s: just use serializability. The rest of this week: three ways to implement it, starting tomorrow with the most literal one — run transactions one at a time.
:::
