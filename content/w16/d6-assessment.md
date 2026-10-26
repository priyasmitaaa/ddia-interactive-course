---
title: Review — Chapter 9 Checkpoint
kind: assessment
minutes: 70
chapter: 9
objectives:
- Retrieve all of Chapter 9 from memory
- Choose the right guarantee and tool for coordination problems
- Explain the equivalences between consensus problems
reading:
- Chapter 9 Summary | 363-365
complete:
- You did today's spaced review
- You answered the checkpoint without notes
- Exercises 31–33 are done (or consciously skipped)
---

:::review Today's spaced review
Scheduled questions from Weeks 1–16.
:::

:::task The equivalence map, from memory
On a blank page, write "consensus" in the middle and the six problems the summary calls equivalent around it (p. 364). Draw an arrow for each construction you know: total order broadcast → linearizable cas (the log procedure), linearizable increment-and-get → total order broadcast, consensus → total order broadcast (repeated rounds), cas → locks and leases, total order broadcast → fencing tokens. Label each arrow with one sentence.
:::

:::quiz Chapter 9 checkpoint
### scenario
A team built automatic failover for their PostgreSQL cluster with a script: "if the leader misses 3 health checks, promote the most up-to-date follower." Twice this year they've had two leaders. Explain using Chapter 9, and propose a better design.
>>>
Automatic failover is a consensus problem: all nodes must agree on one leader (p. 343). A health-check script isn't a proven consensus algorithm, so it misbehaves in adverse network conditions. A partition or a GC pause makes the old leader look dead while it keeps accepting writes, and there's no epoch to stop it, so they get split brain (pp. 357–358, 365). Better: use a consensus-based coordination service (etcd, ZooKeeper, Consul) to hold a leader lease or lock, with an increasing epoch or fencing token. Make the old leader step down when it can't renew. Have the database or clients reject writes tagged with an older epoch. Accept that failover then needs a majority of the coordination ensemble. Tools like Patroni follow this pattern. (Patroni isn't from the book.)

### mcq
Which of these is NOT equivalent to consensus, according to the book?
- [ ] Total order broadcast
- [ ] A linearizable compare-and-set register
- [ ] Atomic transaction commit
- [x] A linearizable read/write register without atomic operations
>>>
Footnote x, p. 340: a plain linearizable read/write register is "easier" and can be implemented without consensus.

### mcq
Why can't Dynamo-style quorums implement a linearizable compare-and-set?
- [ ] Because they use too many replicas
- [x] Because cas needs consensus; quorum reads and writes (even with synchronous read repair) give at most linearizable reads and writes
- [ ] Because of clock skew
- [ ] They can
>>>
Synchronous read repair and read-before-write make reads and writes linearizable, but a compare-and-set must atomically decide based on the current value across replicas, which is equivalent to consensus (pp. 325, 342).

### tradeoff
For a payments service, you're choosing between XA transactions across the payments database and the message broker, and a design without distributed transactions. What does Chapter 9 say about XA's risks?
- [x] XA gives atomicity across both, but the coordinator is a single point of failure that makes app servers stateful, in-doubt transactions hold locks and can block large parts of the app, orphaned transactions need manual resolution, and failures are amplified because every participant must respond
- [ ] XA has no risks if the network is reliable
- [ ] XA is faster than local transactions
- [ ] XA supports SSI across systems
>>>
pp. 352–354. Chapter 11 discusses the alternatives.

### explain
Contrast how 2PC and a Raft-like consensus algorithm handle the failure of the node that coordinates decisions.
>>>
In 2PC, the coordinator alone holds the decision. If it fails after participants vote yes, they're in doubt. They can't commit or abort on their own, they hold their locks, and they must wait for the coordinator to recover and read its log. That blocks, and it doesn't satisfy termination (pp. 349, 356). In a consensus algorithm, the leader isn't irreplaceable. When it's suspected dead, the others elect a new leader with a higher epoch using a majority vote. Every decision also needs a majority, and the election and decision quorums overlap, so the new leader learns of anything that might have been decided and a stale leader can't get decisions accepted. Progress continues as long as a majority is up, and safety holds even if it isn't (pp. 358–359).

### design
Design a "distributed cron" that runs each scheduled job exactly once across a 10-node worker fleet, using Chapter 8 and 9 concepts.
>>>
Use a coordination service (ZooKeeper or etcd, 3 or 5 nodes) rather than a home-grown protocol. Workers register with sessions and ephemeral nodes, which gives agreed membership (p. 363). For each job run, elect an owner via a linearizable lock or lease (cas on `/jobs/<job>/<run>`). Each acquisition yields a monotonically increasing fencing token (zxid, p. 361). The owner executes the job, and every side-effecting resource checks the token, or the side effect is made idempotent with the run ID as a key, so a paused or partitioned ex-owner can't run it twice (pp. 293–295). Watches notify other workers when an owner's session dies, so another can take over (p. 361). Accept the trade-offs: if the coordination ensemble loses its majority, no new runs start (unavailability, not duplicates), and false session timeouts cause extra takeovers that fencing keeps safe. If you need "exactly once" for external side effects that can't check tokens (for example sending email), the best you can do is at least once plus idempotency on the receiving side.
:::
