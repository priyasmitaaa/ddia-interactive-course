---
title: Case Study — Choosing Ordering Guarantees for a Social App
kind: lesson
minutes: 75
chapter: 9
objectives:
- Match application requirements to the weakest sufficient guarantee (eventual, causal, sequential, linearizable)
- Identify hidden cross-channel dependencies in a multi-service design
- Choose between sequence numbers, Lamport timestamps, version vectors and total order broadcast for a given need
reading:
- Re-read ordering and causality | 330-333
- Re-read total order broadcast | 338-342
complete:
- You filled in the requirement → guarantee table before reading the analysis
- You found the cross-channel dependency in the design
- You answered the quiz
---

:::problem A small social app with five requirements
This scenario is made up for teaching, but each requirement maps onto ideas from this chapter. A photo-sharing app is deployed in two regions and has these requirements:
1. **Comments** under a photo must never show a reply before the comment it replies to.
2. **Usernames** must be unique, and the user is told immediately whether a name is taken.
3. **Like counts** may lag by a few seconds, but must never lose likes.
4. When a user changes a post's visibility to **"private"** and then shares a link to it with a friend in a chat, the friend must never see the post as public.
5. An **audit log** must list every admin action across all services in an order everyone agrees on.

Before reading on, write down for each requirement the **weakest guarantee** that satisfies it, and a mechanism.
:::

:::intuition The analysis
**1. Replies after comments.** This needs **causal consistency**. A reply causally depends on the comment it answers, like the question and answer in consistent prefix reads (Chapter 5). Concurrent comments can appear in any order. Mechanism: carry dependencies (for example the replied-to comment's version or a vector) and have replicas delay a reply until its parent is visible. Linearizability would work but is overkill, and it would cost availability in the cross-region setup (pp. 330–333).

**2. Unique usernames, decided now.** This needs **linearizable compare-and-set**, or equivalently total order broadcast, or equivalently consensus. Lamport timestamps can decide the winner only *after the fact* (pp. 337–338, 340–341). Mechanism: a consensus-backed registry (ZooKeeper or etcd style) or the log procedure. Region B can't register names while cut off from the consensus majority, which is CAP in action (pp. 326–327). Alternatively, accept compensating actions and send an apology email (p. 321).

**3. Like counts.** This needs only **eventual consistency plus no lost updates**. LWW on a counter would lose concurrent increments. Use a commutative counter (a CRDT) or per-region counters summed on read (Chapter 5, Chapter 7's lost updates).

**4. Private, then share.** This is a **cross-channel timing dependency**, like Figure 9-5. The visibility change goes through the posts database, and the link goes through the chat service, so the friend can open the link before the visibility change has reached the replica serving them. Options: linearizable reads of visibility, or, since we control the chat channel, attach the post's version or log position to the shared link and have the reader wait until its replica has reached that version (read-your-writes style, p. 323). Linearizability would preserve this causality automatically (p. 332).

**5. Audit log order.** This needs a **total order that everyone agrees on**, which is **total order broadcast**: a single replicated log, with each service appending admin actions. Per-service sequence numbers or wall-clock timestamps give an order, but not one consistent with causality across services, and not a finalized one (pp. 335–336, 339).
:::

:::details The table
| Requirement | Weakest sufficient guarantee | Mechanism | Unavailable during a region split? |
|---|---|---|---|
| Replies after comments | Causal consistency | Dependency tracking (versions or vectors) | No |
| Unique usernames, now | Linearizable CAS ≡ total order broadcast ≡ consensus | Consensus-backed registry or log procedure | Yes, on the minority side |
| Like counts | Eventual + no lost updates | CRDT counter / per-region sums | No |
| Private, then share | Causality across channels | Version in the link, or linearizable read | Linearizable read: yes; version-wait: delays only |
| Audit log | Total order broadcast | Replicated log (consensus) | Yes, for appends on the minority side |

The pattern: **only some requirements need consensus**. Paying for linearizability everywhere would make the whole app slow and unavailable during network faults. Paying for nothing would produce the anomalies of Chapters 5 and 8. "Watch your causality", and spend coordination only where uniqueness or a final order is really needed.
:::

:::quiz
### mcq
Which requirement in the case study genuinely needs consensus (or an equivalent)?
- [ ] Showing replies after their comments
- [ ] Like counts
- [x] Telling a user immediately whether a username is free
- [ ] None of them
>>>
Deciding uniqueness right now needs linearizable cas, which is equivalent to consensus (pp. 338, 342).

### mcq
Why is LWW a bad choice for like counts, even though counts may lag?
- [ ] LWW is too slow
- [x] Concurrent increments from different replicas would overwrite each other, and LWW keeps only one, silently losing likes
- [ ] LWW needs a leader
- [ ] LWW can't store integers
>>>
Use commutative operations or a CRDT counter instead (Chapters 5, 7, 8).

### predict
The app uses each service's wall-clock timestamps to merge admin actions into one audit log. What can go wrong?
- [ ] Nothing, timestamps are totally ordered
- [x] Clock skew can order a causally later action before an earlier one, and a late-arriving action can still be inserted earlier, so the order is neither causal nor final
- [ ] The log will have gaps
- [ ] Timestamps are too large
>>>
Physical timestamps aren't consistent with causality, and only total order broadcast fixes the order at delivery (pp. 336, 340).

### design
Design requirement 4 ("private, then share") without making every read linearizable.
>>>
When the user changes visibility, the posts service returns the new version number (or log position) of the post. The client then includes it when sharing, so the chat message carries `post_id` plus `min_version`. When the friend opens the link, the posts service reads from a replica and checks that the replica's version of that post is at least `min_version`. If not, it waits briefly, routes the read to the leader, or retries. This preserves the causal dependency across the two channels, the same technique as read-your-writes with a remembered timestamp (Chapter 5, p. 323). Everything else can stay on fast, eventually consistent reads. Linearizable reads would also work but would add latency to every post view and fail during region splits.
:::

:::connect Where this goes next
Tomorrow's review closes the ordering week. Then consensus itself: atomic commit and two-phase commit, then fault-tolerant consensus with epochs and quorums, and finally ZooKeeper.
:::
