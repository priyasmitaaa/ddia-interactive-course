---
title: Case Study — Designing a Multi-Region Order System with Part II
kind: lesson
minutes: 100
chapter: 9
objectives:
- Apply replication, partitioning, transactions, fault models and consensus to one realistic design
- Justify each choice with the weakest guarantee that meets the requirement
- Identify failure scenarios and say which guarantees still hold
reading:
- Re-read the Chapter 9 summary | 363-365
complete:
- You wrote your own design for each requirement before reading the reference design
- You listed three failure scenarios and the behavior of your design in each
- You answered the quiz
---

:::problem An online store, two regions, five requirements
This is a made-up scenario for practice. Every decision in the reference design cites the chapter it comes from. Requirements:
1. **Catalog browsing** must be fast in both regions and stay available during a region split. Slightly stale prices are tolerable for browsing.
2. **Placing an order** reserves stock. Stock must **never oversell** for limited editions, while ordinary items may oversell occasionally, fixed by apology and backorder.
3. An order updates **inventory**, **payments** and an **order history** that live in different services.
4. **Order IDs** must be unique and roughly increasing for support staff. They need not be causally ordered across regions.
5. Exactly one **worker** should run the nightly settlement job.

Write your design first: replication method, partitioning, isolation or consistency level, and coordination mechanism, for each requirement.
:::

:::intuition A reference design
**1. Catalog** (Chapters 5, 6). Single-leader replication per partition with **asynchronous followers in both regions**. Reads come from local followers. Stale prices are acceptable, but use **read-your-writes** for catalog admins (Chapter 5). During a region split, browsing continues from local replicas, which are stale but available (CAP: we chose availability, p. 326). Partition by product key with hash partitioning, since most catalog queries are by key, and use a document-partitioned secondary index for category browsing, accepting scatter/gather (Chapter 6).

**2. Stock.** Two different requirements:
- *Limited editions*: never oversell. This is a uniqueness constraint, so it needs **linearizable compare-and-set** (p. 321): a conditional decrement (`UPDATE stock SET n = n − 1 WHERE item = ? AND n > 0`) on the item's **single leader**. The leader is elected through **consensus** (etcd/ZooKeeper, or a consensus-replicated database partition), so failover can't create two leaders, and epochs fence stale ones (pp. 358, 295). During a split, the region without the leader **can't sell** limited editions. That's the right trade-off for this requirement.
- *Ordinary items*: occasional oversell is OK. Accept orders locally, multi-leader style, and use a **compensating** workflow (backorder, apology, discount) for the rare oversell (p. 321). This stays available during a split.

**3. Inventory + payment + history** (Chapters 7, 9). Avoid heterogeneous **XA** across three services: a coordinator in the app server becomes a stateful single point of failure, in-doubt locks block, and failures are amplified (p. 354). Instead, make the order service write the order and an "order placed" event **atomically in its own database** (a single-node transaction), and let the other services consume the event idempotently. Chapter 11 covers this pattern (change data capture and event logs). Use **idempotency keys** so retried requests don't double-charge.

**4. Order IDs** (Chapter 9). Unique and roughly increasing, but not causal across regions: **block allocation** or node-ID bits (p. 335) are perfect. They're fast, scalable and coordination-free. Don't pay for total order broadcast where causality isn't needed.

**5. Settlement job** (Chapters 8, 9). A **lease** from a consensus-based coordination service, with a **fencing token** that the settlement ledger checks on every write, so a worker paused past its lease can't double-settle (pp. 293–295, 360–361).
:::

:::details Failure scenarios
| Scenario | Catalog | Limited-edition orders | Ordinary orders | Settlement |
|---|---|---|---|---|
| Region link cut | Both regions browse (possibly stale) | Only the region with the leader sells | Both sell; rare oversell → compensation | Runs wherever the coordination majority is |
| Stock leader GC-paused 30 s | Unaffected | New leader elected (higher epoch); old leader's writes fenced | Unaffected | Unaffected |
| App server crashes mid-order | Unaffected | Conditional decrement is atomic: committed or not | Same | Unaffected |
| Settlement worker paused past lease | — | — | — | Another worker takes over; paused worker's writes rejected (token) |
| Coordination ensemble loses majority | Unaffected | No leader changes possible; current leader keeps working until its lease lapses | Unaffected | No new settlement starts (safe, not live) |

The pattern again: **consensus only where uniqueness or exclusivity is required** (limited stock, settlement ownership). Everything else uses cheaper, more available mechanisms.
:::

:::quiz
### mcq
Why does the reference design avoid XA across inventory, payments and order history?
- [ ] XA is not supported by databases
- [x] A heterogeneous coordinator makes app servers stateful, in-doubt transactions hold locks and block, and any failing participant fails the whole transaction (failure amplification)
- [ ] XA can't handle money
- [ ] XA is too new
>>>
p. 354. The event-based alternative is developed in Chapter 11.

### mcq
Which requirement justifies consensus?
- [ ] Catalog browsing
- [ ] Order IDs
- [x] Never overselling limited editions (linearizable conditional update with a consensus-elected leader) and exclusive settlement ownership
- [ ] Ordinary-item orders
>>>
Uniqueness and exclusivity are the problems equivalent to consensus (p. 364).

### tradeoff
During a region split, limited-edition sales stop in one region. What would you tell the product manager?
- [x] That's the deliberate CAP-style choice for this requirement: selling in both regions during a split could oversell; alternatives are partitioning stock per region in advance, or accepting rare oversells with compensation
- [ ] It's a bug and should be fixed with LWW
- [ ] Use more replicas to avoid it
- [ ] NTP would fix it
>>>
Linearizability needs the majority side when partitioned (p. 327). Pre-allocating stock per region is another form of partitioning.

### design
Extend the design: support staff want to see a customer's orders in the exact causal order they were placed, across both regions. What do you add, and what don't you need?
>>>
Customers' orders are causally related through the customer: each one is placed after they saw the previous one. So we need causal ordering per customer, not a global total order. Options: route each customer's orders to a "home" partition and leader (single-leader per customer), whose replication log gives a causally consistent sequence (pp. 334–335). Or attach Lamport timestamps carried by the client session (it remembers the max seen and sends it with each order, p. 337), so later orders always get larger timestamps even across regions. We don't need total order broadcast or consensus across all customers, because concurrent orders by different customers can appear in any order. Block-allocated order IDs (requirement 4) aren't sufficient for this, since they aren't causal.
:::

:::connect Where this goes next
Tomorrow: how to keep learning beyond the book. How to read distributed-systems papers and Jepsen analyses critically, using the vocabulary you now have.
:::
