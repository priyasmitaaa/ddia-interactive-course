---
title: Snapshot Isolation and MVCC
kind: lesson
minutes: 95
chapter: 7
objectives:
- Explain read skew (non-repeatable reads) and when it can't be tolerated (backups, analytics, integrity checks)
- Explain snapshot isolation and the principle "readers never block writers, writers never block readers"
- Apply the MVCC visibility rules to a set of row versions
- Explain how indexes work with MVCC, including append-only/copy-on-write B-trees
- Explain the naming confusion around "repeatable read"
reading:
- Snapshot isolation and repeatable read; read skew | 228-230
- Implementing snapshot isolation; visibility rules | 230-232
- Indexes and snapshot isolation; repeatable read and naming confusion | 232-233
complete:
- You applied the visibility rules in the MVCC visualization for several readers
- You saw read skew disappear under snapshot isolation in the transaction simulator
- You answered the quiz
---

:::problem $100 vanishes into thin air
Alice has $1,000 split over two accounts. A transfer moves $100 from one to the other. If she views her balances at the wrong moment, she sees account 1 **before** the incoming payment ($500) and account 2 **after** the outgoing transfer ($400): a total of $900 (Figure 7-6). Under read committed this is allowed — each value she saw *was* committed when she read it.

This is a **non-repeatable read** or **read skew**: re-reading account 1 at the end would give $600. For Alice, reloading fixes it. But some situations can't tolerate it (p. 229):

- **Backups** take hours while writes continue; parts of the backup are older than others, and if you restore it, the inconsistency (vanished money) becomes **permanent**.
- **Analytic queries and integrity checks** scan large parts of the database and return nonsense if they observe different parts at different points in time.
:::

:::intuition A frozen photograph of the database
**Snapshot isolation** — implemented with **multi-version concurrency control (MVCC)** — gives each transaction a **consistent snapshot**: all data committed at one point in time. Even if data changes afterwards, the transaction keeps seeing the old data from when it started. Long read-only queries (backups, analytics) become easy to reason about.

Supported by PostgreSQL, MySQL/InnoDB, Oracle, SQL Server and more. Like read committed, it uses **write locks** to prevent dirty writes, but **no locks for reads**. Its key performance principle: **readers never block writers, and writers never block readers** — long reads run on a snapshot while writes proceed normally.

It generalises yesterday's trick: read committed keeps at most two versions (committed, and uncommitted-new); snapshot isolation keeps **several committed versions**, because different in-progress transactions may need to see the database at different points in time.
:::

:::visual MVCCViz | Figure 7-7: which versions can each transaction see?
**Try this:**
1. Read as **tx 12**: rows created by 3 and 5 are visible; tx 13's changes (in progress when 12 started) are ignored. Total: $1,000.
2. Read as **tx 13**: it sees its own writes. Total: $1,000.
3. **Commit tx 13**, then read as tx 12 again: unchanged — it's a snapshot. **Start a new transaction**: it sees $600/$400.
4. Note the $9,999 row by aborted tx 11 — invisible to everyone.
:::

:::details How MVCC works (pp. 230–233)
PostgreSQL's design (others are similar): each transaction gets a unique, **always-increasing transaction ID** (txid). Every row version has a **created_by** field (txid that inserted it) and a **deleted_by** field (initially empty). A delete doesn't remove the row; it sets deleted_by. Later, when no transaction can see it any more, **garbage collection** removes it. An **update is a delete plus a create**: in Figure 7-7, tx 13 turns account 2's $500 into $400 by marking the $500 row deleted_by 13 and creating a $400 row created_by 13. (PostgreSQL txids are 32-bit and wrap around after ~4 billion; its vacuum process handles that.)

**Visibility rules** (p. 232):
1. At start, the database lists all transactions **in progress**; their writes are ignored, even if they later commit.
2. Writes by **aborted** transactions are ignored.
3. Writes by transactions with a **later txid** (started after me) are ignored, committed or not.
4. All other writes are visible.

Equivalently, an object is visible if (a) its creating transaction had committed when the reader started, and (b) it isn't marked deleted — or if it is, the deleting transaction hadn't committed when the reader started. By never updating in place, the database provides a consistent snapshot with small overhead.

**Indexes.** One option: the index points to **all versions**; index queries filter out invisible ones; GC removes index entries along with old versions (PostgreSQL optimises by avoiding index updates when versions fit on the same page). Another: CouchDB, Datomic and LMDB use **append-only / copy-on-write B-trees**: a write copies the modified pages and their parents up to the root; untouched pages are shared. **Each write transaction creates a new root**, and each root is a consistent snapshot — no txid filtering, but compaction and GC are needed.

**Naming confusion.** The SQL standard is based on System R's 1975 isolation levels — before snapshot isolation was invented — so it has no such level, but defines **repeatable read**, which superficially resembles it. So Oracle calls snapshot isolation *serializable*, PostgreSQL and MySQL call it *repeatable read* (to claim compliance). The standard's definitions are ambiguous and imprecise; implementations of "repeatable read" differ a lot; a formal definition exists in research but most implementations don't meet it; and IBM DB2 uses "repeatable read" for serializability. "**Nobody really knows what repeatable read means.**"
:::

:::visual TxnSim | Read skew under three levels
@props {"scenario":"readSkew","level":"rc"}
Step through Figure 7-6 at **Read committed** (Alice sees $900), then at **Snapshot isolation** (Alice sees $1,000 although the transfer commits in the middle of her transaction).
:::

:::quiz
### mcq
Why is read skew unacceptable for a backup that runs for hours?
- [ ] Backups need serializable isolation for speed
- [x] Different parts of the backup would reflect different points in time; restoring it would make the inconsistency permanent
- [ ] Read skew causes dirty writes in the backup
- [ ] It isn't a problem; reloading fixes it
>>>
p. 229. Snapshot isolation gives the backup one consistent point in time.

### mcq
What is the key performance principle of snapshot isolation?
- [ ] Every read takes a shared lock
- [x] Readers never block writers, and writers never block readers
- [ ] All transactions run on one thread
- [ ] Writes never need locks
>>>
Writers still lock against other writers (to prevent dirty writes), but reads need no locks (p. 230).

### predict
Transaction 12 started while transaction 13 was in progress. Transaction 13 then commits an update to account 2 (deleting the $500 version, creating $400). What does transaction 12 see when it reads account 2 afterwards?
- [ ] $400, because 13 has committed
- [x] $500 — tx 13 was in progress when 12 started, so both its deletion and its creation are ignored
- [ ] Both versions
- [ ] Nothing
>>>
Rule 1 (and rule 3, since 13 > 12). You can check it in the MVCC visual.

### mcq
How does an append-only (copy-on-write) B-tree provide snapshots?
- [ ] By locking every page
- [x] Each write transaction creates new copies of modified pages up to a new root; each root is a consistent snapshot, so no transaction-ID filtering is needed
- [ ] By storing txids in every key
- [ ] By running all writes serially
>>>
CouchDB, Datomic, LMDB (pp. 232–233). Old roots and pages need garbage collection.

### mcq
A colleague says: "We use REPEATABLE READ in both MySQL and DB2, so we have the same guarantees." What's wrong?
- [ ] Nothing
- [x] The name means different things: in MySQL (and PostgreSQL) it's a form of snapshot isolation, while DB2 uses it for serializability; even same-named levels differ between databases
- [ ] Repeatable read doesn't exist in MySQL
- [ ] DB2 doesn't support transactions
>>>
p. 233: "nobody really knows what repeatable read means".

### explain
State the MVCC visibility rules in your own words, and explain why an update is implemented as a delete plus a create.
>>>
When a transaction starts, it notes which transactions are still in progress. It then ignores writes by those transactions, by aborted transactions, and by transactions that started after it; everything else committed is visible. A row version is visible if its creator is visible to me and it isn't deleted by a transaction visible to me. Updates are delete + create because the old version must remain readable for transactions whose snapshots predate the update; keeping both versions (tagged by txid) lets every transaction see its own consistent snapshot, and old versions are garbage-collected once no transaction can see them.
:::

:::connect Where this goes next
In next week's lab you'll implement exactly these visibility rules in Python, then extend them to serializable snapshot isolation. MVCC is also the same idea as Chapter 5's version numbers and Chapter 11's immutable event logs: keep history, derive the view.
:::
