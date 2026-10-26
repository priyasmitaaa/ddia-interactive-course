---
title: Problems with Replication Lag
kind: lesson
minutes: 95
chapter: 5
objectives:
- Explain read scaling with followers and what "eventual consistency" really promises
- Explain read-your-writes consistency and four techniques to implement it, including cross-device issues
- Explain monotonic reads and how sticky routing provides it
- Explain consistent prefix reads and why partitioning causes violations
- Explain why application-level workarounds are fragile and why transactions exist
reading:
- Problems With Replication Lag | 155-156
- Reading your own writes | 156-158
- Monotonic reads | 158-159
- Consistent prefix reads; solutions for replication lag | 159-161
complete:
- You broke and fixed all three anomalies in the visualization
- You can name the guarantee that each anomaly violates
- You answered the quiz
---

:::problem Users notice lag
Followers let you scale reads: most web workloads are reads, so add followers and spread the reads, also serving users from nearby replicas (p. 155). That only works with **asynchronous** replication (synchronous to all followers would make any single failure stop all writes). But then a follower can be behind, so the same query on the leader and a follower can give different answers.

If you stop writing and wait, followers catch up: **eventual consistency** (coined by Douglas Terry et al., popularised by Werner Vogels). "Eventually" is deliberately vague — there's no limit to how far behind a replica can be. Normally lag is a fraction of a second; near capacity or with network problems it can be seconds or minutes. Then users see strange things.
:::

:::intuition Three anomalies, three guarantees
| What the user sees | Guarantee that prevents it |
|---|---|
| "I posted a comment and it vanished." (Figure 5-3) | **Read-your-writes** (read-after-write) consistency |
| "A comment appeared, then disappeared when I refreshed." (Figure 5-4) | **Monotonic reads** |
| "I saw the answer before the question." (Figure 5-5) | **Consistent prefix reads** |

Each is **weaker** than "always see the latest data", but **stronger** than plain eventual consistency — and each can often be provided cheaply.
:::

:::visual LagAnomalySim | Break them, then fix them
**Try each tab:**
1. **Read your own writes:** set lag above the re-read delay → the comment is missing. Then try both fixes.
2. **Monotonic reads:** give the followers very different lags and press "Route both reads randomly" until the comment appears then disappears. Then tick the sticky-routing fix.
3. **Consistent prefix:** make Mr Poons' partition slower than Mrs Cake's. Then tick the same-partition fix.
:::

:::details Techniques (pp. 156–161)
### Reading your own writes
Guarantee: if a user reloads the page, they always see updates **they** submitted. (No promise about other users' updates.) Techniques:

- **Read data the user may have modified from the leader**, everything else from followers. E.g. a user's own profile is only editable by them: read your own profile from the leader, others' profiles from followers.
- If most things are user-editable, that sends too much to the leader. Instead: read from the leader **for one minute after the user's last update**, or monitor lag and avoid followers more than a minute behind.
- **Client remembers the timestamp of its last write**; the system ensures the replica serving the user has applied at least up to it — otherwise use another replica or wait. The timestamp can be **logical** (a log sequence number) or the system clock (then clock synchronisation matters — Chapter 8). *(This is what you'll build in tomorrow's lab.)*
- With **multiple datacenters**, requests that must go to the leader must be routed to the leader's datacenter.

**Cross-device** read-after-write (desktop and phone): remembered timestamps don't work, because one device doesn't know about the other's writes — the metadata must be centralised; and devices may be routed to different datacenters (home broadband vs mobile network), so you may first need to route all of a user's devices to the same datacenter.

### Monotonic reads
Time goes backwards when a user makes several reads from different replicas — first a fresh one, then a stale one — typical when refreshing a page routed to random servers. Monotonic reads: if a user makes reads in sequence, they won't read older data after having read newer data. (They may still see old data — just not go backwards.) Simple implementation: **each user always reads from the same replica**, e.g. chosen by a hash of the user ID. (If that replica fails, reads must be rerouted.)

### Consistent prefix reads
A causality problem: Mrs Cake's answer replicates faster than Mr Poons' question, so an observer sees the answer first. Guarantee: if writes happen in a certain order, anyone reading them sees them in that order. It's mainly a problem in **partitioned** databases (Chapter 6): if all writes went through one log in one order, readers would always see a consistent prefix; but partitions operate independently with **no global ordering**. One fix: write causally related data to the **same partition** — not always efficient. In general it needs something like distributed transactions with snapshot isolation (Chapter 7) — or the causality tracking of Chapter 9.

### Solutions for replication lag (pp. 160–161)
Ask: how does the application behave if lag grows to minutes or hours? If badly, design for a stronger guarantee. **"Pretending that replication is synchronous, when in fact it is asynchronous, is a recipe for problems down the line."** Applications can provide stronger guarantees themselves (reading some things from the leader), but that's complex and easy to get wrong. It would be better if developers could trust the database to do the right thing — **that is why transactions exist**. Many distributed systems abandoned transactions, claiming they're too expensive and that eventual consistency is inevitable at scale. The book: *that is not necessarily true* (Chapter 7, Chapter 9).
:::

:::quiz
### mcq
A user changes their display name, then reloads the page and sees the old name. Which guarantee was violated?
- [x] Read-your-writes (read-after-write) consistency
- [ ] Monotonic reads
- [ ] Consistent prefix reads
- [ ] Durability
>>>
The user's own write wasn't visible to them, because the read went to a follower that hadn't received it yet (Figure 5-3).

### mcq
How can monotonic reads be achieved simply?
- [ ] Read everything from the leader
- [x] Always route a given user's reads to the same replica, e.g. chosen by a hash of the user ID
- [ ] Use synchronous replication to all followers
- [ ] Add more followers
>>>
A single replica only moves forward in time, so a user who always reads from it never sees time go backwards (p. 158).

### predict
A user writes from their laptop, then opens the app on their phone. Your read-your-writes mechanism stores "timestamp of last write" in the laptop's browser. What does the phone see?
- [ ] Always the new data
- [x] Possibly stale data: the phone doesn't know the laptop's last-write timestamp, so it can't make sure its replica is fresh enough
- [ ] An error
- [ ] The laptop's cache
>>>
Cross-device read-after-write needs centralised metadata, and possibly routing both devices to the same datacenter (p. 157).

### mcq
Why are consistent prefix read violations especially likely in partitioned databases?
- [ ] Partitions have no replicas
- [x] Different partitions replicate independently, so there's no global ordering of writes across them
- [ ] Partitions use statement-based replication
- [ ] Readers can only read one partition
>>>
A question in partition 1 and its answer in partition 2 can be replicated at different speeds (Figure 5-5, p. 160).

### tradeoff
Your social app reads everything from followers. Which policy gives read-your-writes for profile edits with the least extra leader load?
- [ ] Read all data from the leader
- [x] Read only the user's own profile (and other things they just edited) from the leader; everything else from followers
- [ ] Make all followers synchronous
- [ ] Disable caching
>>>
The book's first technique: if you know what the user might have modified, only those reads need the leader (p. 157). For apps where everything is editable, use "leader for a minute after a write" or position tracking instead.

### explain
Explain the sentence "Pretending that replication is synchronous, when in fact it is asynchronous, is a recipe for problems down the line." Give an example.
>>>
With async replication, followers can lag arbitrarily, especially under load or during failures. If application code is written as if every replica is always current, it works in testing (lag is tiny) and fails in production exactly when things are stressed. Example: a checkout page writes "order placed" to the leader, then immediately reads the order history from a follower to show a confirmation — during a lag spike, the order isn't shown and the user places it again, creating a duplicate order.
:::

:::connect Where this goes next
Tomorrow you'll implement read-your-writes with log positions in the lab. Read-your-writes, monotonic reads and consistent prefix reads are all weaker cousins of **linearizability** and **causal consistency** (Chapter 9) — keep this table; it grows into a whole ladder of consistency models.
:::
