---
title: Multi-Leader Replication and Write Conflicts
kind: lesson
minutes: 95
chapter: 5
objectives:
- Explain the three use cases for multi-leader replication (multi-datacenter, offline clients, collaborative editing)
- Compare single- and multi-leader setups across datacenters on performance and fault tolerance
- Explain why write conflicts arise and why synchronous conflict detection defeats the purpose
- Describe conflict avoidance and convergent conflict resolution (LWW, replica priority, merge, siblings)
- Recognise subtle conflicts such as double-booking
reading:
- Multi-leader replication and its use cases | 161-164
- Handling write conflicts | 164-167
- Custom conflict resolution, automatic conflict resolution, what is a conflict? | 167-168
complete:
- You tried every resolution strategy in the visualization, including LWW with clock skew
- You can name the three use cases with an example of each
- You answered the quiz
---

:::problem One leader is a single choke point
Single-leader replication has one big downside: **all writes go through one node**. If you can't reach the leader — say the network between you and it is down — you can't write at all (p. 161). With users on several continents, every write also travels to wherever the leader is. The natural extension: let **several nodes accept writes**, each forwarding its changes to the others — **multi-leader** (master–master, active/active) replication. Each leader is simultaneously a follower of the other leaders.
:::

:::intuition Where multiple leaders make sense
Within one datacenter it rarely makes sense — the benefits rarely outweigh the complexity. But in three situations it does (pp. 161–164):

**1. Multi-datacenter operation.** A leader in each datacenter; regular leader–follower replication inside each datacenter; leaders replicate to each other between datacenters (Figure 5-6). Compared with single-leader:
- **Performance**: writes are processed locally and replicated asynchronously, hiding the inter-datacenter latency from users.
- **Datacenter outages**: each datacenter keeps working independently; replication catches up when the failed one returns (vs. failing over to a follower elsewhere).
- **Network problems**: inter-datacenter traffic crosses the public internet. Single-leader is sensitive to that link (writes depend on it); async multi-leader tolerates interruptions.
Tools: Tungsten Replicator (MySQL), BDR (PostgreSQL), GoldenGate (Oracle). But it's often retrofitted, with pitfalls around auto-increment keys, triggers and integrity constraints — "often considered dangerous territory that should be avoided if possible".

**2. Clients with offline operation.** Calendar apps on your phone, laptop and tablet must work without internet. Each device has a local database acting as a leader, syncing asynchronously when online — replication lag of hours or days. Architecturally: each device is a "datacenter" with an extremely unreliable network. (CouchDB is designed for this.)

**3. Collaborative editing.** Google Docs, Etherpad: each user's edits apply instantly to their local copy and replicate asynchronously. Locking the document first is equivalent to single-leader replication; for fast collaboration with tiny units of change (a keystroke) and no locks, you get all the challenges of multi-leader — including conflict resolution.
:::

:::visual ConflictSim | Two leaders, one title
Figure 5-7: user 1 changes a wiki page title from A to B on leader 1; at the same time user 2 changes it from A to C on leader 2.

**Try this:**
1. **none**: each leader applies writes in arrival order → they disagree forever.
2. **last write wins**: converges, but one user's write is silently lost. Now set user 2 to write 100 ms *after* user 1, and give leader 2's clock **−300 ms** skew: the later write loses.
3. **replica ID**, **merge** ("B/C"), **keep siblings**: compare what's lost and who has to clean up.
:::

:::details Handling write conflicts (pp. 164–168)
**The biggest problem with multi-leader replication is write conflicts.** In a single-leader database, the second writer would block or be aborted and retry. In multi-leader, both writes succeed locally and the conflict is detected **asynchronously, later** — possibly too late to ask the user. You could detect conflicts synchronously (wait for all replicas before acknowledging), but then you lose the main advantage of multi-leader — you might as well use single-leader.

**Conflict avoidance.** The simplest strategy: make all writes for a given record go through the **same leader** — e.g. route each user to their "home" datacenter. From that user's point of view it's single-leader. It breaks down when the designated leader must change (a datacenter fails, or the user moves).

**Converging towards a consistent state.** With no defined order of writes, replicas must still end up with the same value (**convergent** resolution). Options:
- give each write a unique ID (timestamp, random number, UUID, hash), highest wins — with timestamps this is **last write wins (LWW)**: popular but **dangerously prone to data loss**;
- writes from the higher-numbered replica always win — also data loss;
- **merge** the values (e.g. alphabetical concatenation "B/C");
- **record the conflict** in a data structure that preserves everything, and resolve it later in application code (perhaps asking the user).

**Custom conflict resolution logic**, run either **on write** (as soon as the conflict is detected in the replication stream — e.g. Bucardo lets you write a Perl snippet; must be quick, can't prompt a user) or **on read** (all conflicting versions are stored and returned to the application on the next read, which resolves them and writes back — CouchDB). Resolution usually applies per row/document, not per transaction.

**Automatic conflict resolution** (sidebar). Custom code is error-prone: Amazon's shopping cart once preserved added items but not removals, so removed items reappeared. Research directions: **CRDTs** (conflict-free replicated data types — sets, maps, lists, counters that merge sensibly; some in Riak 2.0), **mergeable persistent data structures** (git-like three-way merge), and **operational transformation** (behind Etherpad and Google Docs, for ordered lists like text).

**What is a conflict?** Sometimes obvious (two writes to one field). Sometimes subtle: a meeting-room booking system where two bookings for the same room and time are created on different leaders — each leader's availability check passed. No quick ready-made answer (Chapter 7 calls this write skew).
:::

:::extra Since 2016
CRDTs have matured a lot: libraries like Automerge and Yjs power "local-first" collaborative apps, and databases such as Redis Enterprise (active-active) and Azure Cosmos DB offer CRDT-based multi-region writes. Martin Kleppmann himself works extensively on CRDTs (Automerge). The book's core warning still holds: generic LWW silently loses data; data-type-aware merging is what makes multi-leader safe.
:::

:::quiz
### mcq
Which situation is the strongest case for multi-leader replication?
- [ ] A single datacenter with high read load
- [x] A calendar app that must accept edits on phones and laptops while offline, syncing later
- [ ] A bank ledger that must never have conflicts
- [ ] A read-only analytics warehouse
>>>
Offline clients are a classic multi-leader use case: each device is a leader with an extremely unreliable link (p. 163). A single datacenter rarely benefits; a ledger wants to avoid conflicts entirely.

### predict
Two leaders each apply their own write first and the other's write when it arrives, with no conflict resolution: leader 1 sees B then C, leader 2 sees C then B. Final state?
- [ ] Both show C
- [ ] Both show B
- [x] Leader 1 shows C and leader 2 shows B — forever inconsistent
- [ ] Both show "B/C"
>>>
That's why every multi-leader scheme must resolve conflicts in a convergent way (p. 166).

### mcq
Why not just detect conflicts synchronously in multi-leader replication?
- [ ] It's impossible
- [x] Waiting for all replicas before acknowledging removes the main advantage — each replica accepting writes independently — so you might as well use single-leader
- [ ] It causes data loss
- [ ] It requires CRDTs
>>>
Synchronous detection means a write can't succeed until every leader has confirmed it — so a slow or unreachable datacenter blocks writes everywhere, exactly what multi-leader was supposed to avoid (p. 165).

### tradeoff
What is the main cost of resolving conflicts with last write wins?
- [x] Concurrent writes that were acknowledged as successful are silently discarded; with clock skew, even the write that really came later can lose
- [ ] Replicas never converge
- [ ] It requires user intervention
- [ ] It doubles storage
>>>
LWW converges but sacrifices durability (pp. 166, 180) — you saw it with clock skew in the visual.

### mcq
Which strategy turns a multi-leader setup into "essentially single-leader" from each user's point of view?
- [ ] Last write wins
- [ ] Operational transformation
- [x] Conflict avoidance: route all writes for a given record (e.g. a user's data) through the same leader
- [ ] Recording siblings
>>>
p. 165–166. It breaks down when the home leader must change.

### explain
A meeting-room booking app runs active/active in two datacenters. Explain why it can double-book a room even though it checks availability before every booking, and what this teaches about "what is a conflict".
>>>
Each booking is checked against the local leader's data. Two users in different datacenters book the same room and time concurrently: each local check finds the room free (neither booking has replicated yet), so both succeed. After replication there are two overlapping bookings — but they're different records, so there's no "same field written twice" conflict for the database to notice. The conflict is in an application-level invariant (no overlapping bookings for one room), which the replication system doesn't know about. Detecting such conflicts needs more than per-record resolution (p. 168; Chapter 7's write skew).
:::

:::connect Where this goes next
"Concurrent writes" will get a precise definition on Friday (happens-before). The double-booking problem returns in Chapter 7 as **write skew**, and its proper solution needs serializability or consensus. Tomorrow: how writes travel between more than two leaders.
:::
