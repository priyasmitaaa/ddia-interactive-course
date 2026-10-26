---
title: Request Routing and Parallel Queries
kind: lesson
minutes: 75
chapter: 6
objectives:
- Explain request routing as an instance of service discovery
- Compare the three routing approaches of Figure 6-7
- Explain how coordination services (ZooKeeper) and gossip protocols keep routing information current
- Describe what MPP databases do differently for complex queries
- Summarise Chapter 6
reading:
- Request routing | 205-207
- Parallel query execution; Summary | 207-209
complete:
- You caused and fixed a stale-routing failure in the visualization
- You can name which systems use ZooKeeper, gossip, or a routing tier
- You answered the quiz
---

:::problem Which node do I talk to?
The data is partitioned across nodes, and partitions move during rebalancing. When a client wants key "foo", **which IP address and port should it connect to** (p. 205)? This is an instance of a general problem called **service discovery** — any networked software aiming for high availability has it, and many companies have written (and open-sourced) their own tools.
:::

:::intuition Three places to put the knowledge
Figure 6-7:

1. **Any node forwards.** Clients contact any node (e.g. via a round-robin load balancer). If it owns the partition, it answers; otherwise it forwards to the right node.
2. **Routing tier.** All requests go to a partition-aware load balancer that forwards them; it doesn't handle requests itself.
3. **Partition-aware client.** The client knows the assignment and connects directly to the right node — fewest hops.

In all three, the hard part is the same: **how does whoever makes the routing decision learn about changes to the partition-to-node assignment?** All participants must agree, otherwise requests go to the wrong nodes. Agreement in a distributed system is **consensus** — hard to implement correctly (Chapter 9).
:::

:::visual RoutingSim | Routing, and stale routing
**Try this:** send a request in each mode. Then **untick** "coordination service notifies routers", rebalance, and send again — the router's view is stale. Refresh it. Tick the notification back on and rebalance: routers stay correct.
:::

:::details Coordination services, gossip, and MPP (pp. 206–208)
**Coordination service.** Many systems keep cluster metadata in a separate service such as **ZooKeeper** (Figure 6-8): each node registers itself; ZooKeeper holds the authoritative mapping of partitions to nodes; routing tiers or partition-aware clients **subscribe** and are notified whenever a partition changes owner or a node joins or leaves. Examples: LinkedIn's **Espresso** uses **Helix** (built on ZooKeeper) with a routing tier; **MongoDB** has a similar architecture with its own **config servers** and **mongos** routing daemons; **HBase, SolrCloud and Kafka** use ZooKeeper to track partition assignment.

**Gossip.** **Cassandra and Riak** use a gossip protocol among nodes to spread and agree on cluster-state changes; requests can go to any node, which forwards them (approach 1). More complexity in the database nodes, no external coordination dependency.

**Couchbase** doesn't rebalance automatically, simplifying agreement; it's usually configured with a routing tier called **moxi**, which learns about routing changes from the cluster nodes.

Clients still need IP addresses of the routing tier or nodes, but those change rarely, so **DNS** is often enough.

**Parallel query execution.** So far: queries reading or writing one key (plus scatter/gather for local indexes) — about the level most NoSQL stores support. **MPP (massively parallel processing)** relational databases, usually for analytics, support far more: a warehouse query with joins, filters, grouping and aggregation is broken by the **query optimizer** into stages and partitions, many executed in parallel on different nodes — especially valuable for large scans. (More techniques in Chapter 10.)

### Chapter 6 summary (pp. 208–209)
Partitioning spreads data and query load evenly, avoiding hot spots; it requires a scheme that suits the data and **rebalancing** as nodes come and go.
- **Key range**: sorted keys, a partition owns min..max — efficient range queries, risk of hot spots; usually rebalanced dynamically by splitting.
- **Hash**: destroys ordering (inefficient range queries) but spreads load; usually a fixed number of partitions, several per node, moved whole.
- **Hybrids**: compound keys (one part for the partition, another for sort order).
- Secondary indexes: **document-partitioned** (local; write one partition, scatter/gather reads) or **term-partitioned** (global; one-partition reads, multi-partition writes).
- Routing: from partition-aware load balancing to sophisticated parallel query engines.
By design each partition operates mostly independently — that's how partitioned databases scale. But what if a write to one partition succeeds and another fails? → **transactions** (next chapter).
:::

:::quiz
### mcq
What is the core difficulty shared by all three request-routing approaches?
- [ ] Choosing a load-balancing algorithm
- [x] The component making the routing decision must learn about changes in the partition-to-node assignment, and all participants must agree on it
- [ ] Encrypting requests
- [ ] Clients being written in different languages
>>>
p. 206. That agreement problem is consensus (Chapter 9).

### mcq
Which system uses gossip among nodes instead of an external coordination service?
- [ ] HBase
- [ ] Kafka (as of 2016)
- [x] Cassandra
- [ ] Espresso
>>>
Cassandra and Riak gossip cluster state; HBase, SolrCloud and Kafka used ZooKeeper; Espresso used Helix on ZooKeeper (pp. 206–207).

### predict
A partition-aware client cached the partition map an hour ago. Since then, rebalancing moved the partition for key K. What happens when the client requests K?
- [ ] It's automatically redirected by DNS
- [x] It contacts a node that no longer owns K's partition; that node must reject or forward the request, and the client should refresh its map
- [ ] It gets K's old value from cache
- [ ] Nothing changes, because keys never move between partitions
>>>
Keys don't change partitions, but partitions change nodes. Stale routing info needs detection (e.g. an epoch/version) and refresh — as in this week's lab.

### mcq
Why is DNS often sufficient for finding the routing tier or nodes, even though it's slow to update?
- [ ] DNS is a consensus protocol
- [x] Those IP addresses change much less often than the assignment of partitions to nodes
- [ ] DNS stores partition maps
- [ ] Routing tiers don't need IP addresses
>>>
Partition assignments change on every rebalance, so they need a fast notification mechanism like ZooKeeper. The set of machines (and their addresses) changes far more rarely, so DNS's slow propagation is acceptable for finding them (p. 207).

### explain
In one paragraph, explain the difference between what a typical NoSQL store and an MPP data warehouse do with a query on partitioned data.
>>>
A typical NoSQL store supports simple access: read or write one key, routed to the partition that owns it (or scatter/gather a simple secondary-index lookup to all partitions and merge). An MPP data warehouse accepts complex queries with joins, filtering, grouping and aggregation; its query optimizer breaks the query into multiple execution stages and partitions, runs many of them in parallel on different nodes, and exchanges intermediate results between nodes — which pays off especially for queries that scan large parts of the data (pp. 207–208).
:::

:::connect Where this goes next
Tomorrow's lab builds a partitioned store with a metadata service, a router that detects stale information using an epoch number, rebalancing and scatter/gather. Epoch numbers come back in a big way in Chapters 8 and 9 (fencing tokens, consensus epochs).
:::
