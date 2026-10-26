---
title: Review — Chapter 5 Checkpoint
kind: assessment
minutes: 70
chapter: 5
objectives:
- Retrieve all three replication approaches and their trade-offs
- Choose a replication design for new scenarios
- Mix Chapter 5 with Part I ideas
reading:
- Chapter 5 Summary | 186-187
complete:
- You did today's spaced review
- You answered the checkpoint without notes
- Exercises 18–21 are done (or consciously skipped)
---

:::review Today's spaced review
Scheduled questions from Weeks 1–8.
:::

:::task Compare the three approaches
Make a table from memory with rows **single-leader / multi-leader / leaderless** and columns **who accepts writes**, **conflicts?**, **failover?**, **typical consistency**, **good for**, **example systems**. Check against the summary (p. 186).
:::

:::quiz Chapter 5 checkpoint
### design
A note-taking app must work offline on phones and laptops, sync when online, and never lose a note's edits. Choose a replication approach and describe how conflicts are detected and resolved.
>>>
Multi-leader (each device is a leader with a local database), syncing asynchronously when online — the "clients with offline operation" case (p. 163). Detect concurrency with version vectors (each device a replica) so the sync server can tell overwrites from concurrent edits without trusting device clocks. Resolve without data loss: keep concurrent versions as siblings and merge — ideally with a CRDT or operational-transformation-style text merge so concurrent edits to one note combine automatically; otherwise present both versions to the user. Deletions need tombstones so deleted notes don't resurrect. Avoid LWW, which would silently drop one device's edits.

### mcq
Which statement about leaderless replication is correct?
- [ ] It requires failover when a node is down
- [ ] w + r > n guarantees linearizable reads in all cases
- [x] Clients write to and read from several replicas in parallel, using version numbers to detect stale values
- [ ] It's always single-datacenter
>>>
pp. 171–172. And w + r > n has edge cases (p. 175).

### tradeoff
A team wants to "upgrade" from single-leader to multi-leader replication inside one datacenter for higher availability. What does the book suggest?
- [ ] Always do it; more leaders are always better
- [x] Rarely worth it within a single datacenter: the benefits rarely outweigh the complexity of write conflicts and retrofitted pitfalls
- [ ] It's required for read scaling
- [ ] Only do it with synchronous conflict detection
>>>
p. 161, p. 163 ("dangerous territory").

### scenario
After a failover, a user's recently posted comment disappears and then reappears minutes later on a different page load. Name the anomalies that could explain this and how you'd investigate.
>>>
Possibilities: (1) the comment was an acknowledged write lost in failover from an async leader (but then it wouldn't reappear — unless the old leader's writes were later reconciled); (2) **read-your-writes** violated: the comment hasn't reached the replica serving the read yet; (3) **monotonic reads** violated: successive reads go to replicas with different lag, so it appears and disappears. Investigate: check replication lag metrics and routing of the user's requests across replicas, whether reads are sticky, whether the client tracks its last write position, and whether failover discarded writes (compare old leader's log).

### mcq
Which correctly matches the replication-log method to its property?
- [ ] WAL shipping — easiest for external systems to parse
- [ ] Statement-based — safe with NOW() and RAND()
- [x] Logical log — decoupled from storage engine, enables different versions on leader and followers, and change data capture
- [ ] Trigger-based — lowest overhead
>>>
WAL shipping is low-level and storage-specific; statement-based breaks on non-determinism; trigger-based has the highest overhead. The logical log describes rows, not disk blocks, so it's both version-independent and easy for other systems to consume (pp. 152–155).

### explain
Explain how today's ideas connect to Week 1's Twitter example: which replication-lag guarantee would a user notice first if timelines were served from lagging replicas?
>>>
Most noticeable: **read-your-writes** — a user tweets and doesn't see their own tweet on their timeline/profile right away, so they think it failed (and may post again). Also **monotonic reads** — refreshing could show a new tweet and then hide it. Twitter's fan-out caches are themselves derived data updated asynchronously (eventually consistent), so the same reasoning applies: show the user's own writes from an authoritative source or a sufficiently fresh replica, and keep each user's reads sticky.
:::
