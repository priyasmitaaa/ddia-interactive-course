---
title: Review — Brokers, Logs and Databases as Streams
kind: review
minutes: 60
chapter: 11
objectives:
- Retrieve the two broker designs and when to use each
- Explain CDC, compaction and event sourcing from memory
- Catch up on Exercises 40–42
reading:
- Re-read the first half of the Chapter 11 summary | 462-463
complete:
- You did today's spaced review
- You filled in the broker comparison table from memory
- Exercises 40–42 are done (or consciously skipped)
---

:::review Today's spaced review
Scheduled questions from Weeks 1–20.
:::

:::task Broker comparison table, from memory
Make two columns, **AMQP/JMS-style** and **log-based**, with rows: what happens to a message after it's processed; how load balancing works; ordering guarantees; how progress is tracked; how a new consumer can see old messages; best-fit workloads. Then add a third column, **database + CDC**, and fill in what you can. Check against pp. 430–436 and 463.
:::

:::quiz Week 20 checkpoint
### mcq
Which statement about log-based brokers is FALSE?
- [ ] Consumers track progress with an offset per partition
- [ ] Old messages can be replayed by resetting offsets
- [x] Each message is deleted once a consumer has processed it
- [ ] Parallelism is limited by the number of partitions
>>>
Logs retain messages until retention or compaction removes them. Deleting after processing is the AMQP/JMS model (pp. 433, 436).

### mcq
Why is a log-based broker a good transport for CDC events?
- [ ] It deletes events quickly
- [x] It preserves the order of events within a partition, avoiding the reordering that load balancing plus redelivery causes
- [ ] It supports SQL queries
- [ ] It uses 2PC
>>>
CDC must apply changes in the database's order (p. 440).

### scenario
A bank wants a new "monthly spending by category" feature, computed over 5 years of transactions. Its current system stores only account balances. Compare implementing it with and without an event-sourced design.
>>>
Without events, the bank has only current balances, the integrated state. The history of individual credits and debits has been lost, unless it exists in a separate ledger table, so the feature can't be computed retrospectively (pp. 444–446). It would need new data capture going forward and could only show data from launch. With event sourcing, or with an append-only ledger of transactions as the system of record (the accountants' approach, p. 445), the new feature is just a new read view. A new consumer processes the full event history from the beginning to build "spending per category per month", runs alongside the existing balance view with no schema migration, and goes live once caught up (p. 446). Deterministic processing means it can be rebuilt if its logic changes.

### explain
Explain why dual writes need atomic commit to be correct, and how CDC avoids that requirement.
>>>
With dual writes, the application performs two independent writes to two systems. If the first succeeds and the second fails, or the process crashes in between, the systems disagree. Preventing that means making both writes happen or neither, which is atomic commit, expensive and operationally problematic across heterogeneous systems (pp. 438, 354). Concurrent dual writes can also interleave differently at each system (Figure 11-4). CDC avoids both problems by having only one write: to the system of record. The derived system is updated from that database's own change log, in the database's commit order, asynchronously, and a failed consumer simply resumes from its offset and retries. There's nothing to commit atomically across systems, because the second system is a follower, not a second leader (pp. 439–440).
:::
