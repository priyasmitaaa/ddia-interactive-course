---
title: Review — Chapter 8 Checkpoint
kind: assessment
minutes: 70
chapter: 8
objectives:
- Retrieve all of Chapter 8 from memory
- Diagnose timing-related failures in unfamiliar systems
- Distinguish safety from liveness in your own designs
reading:
- Chapter 8 Summary | 302-303
complete:
- You did today's spaced review
- You answered the checkpoint without notes
- Exercises 28–30 are done (or consciously skipped)
---

:::review Today's spaced review
Scheduled questions from Weeks 1–13.
:::

:::task One page, from memory
Without notes, write one page titled **"What a node can and cannot know"**. Cover: the six cases of Figure 8-1; why timeouts are a trade-off; the two kinds of clock; why LWW loses data; confidence intervals and commit wait; causes of process pauses; majority decisions; fencing tokens; Byzantine faults and when to care; the three timing and three node-failure models; safety vs liveness. Check it against pp. 302–303 and this fortnight's lessons, and mark anything you missed as a topic to revisit.
:::

:::quiz Chapter 8 checkpoint
### scenario
A distributed cron service ensures "each job runs exactly once" by having workers take a 60-second lease on the job in Redis before running it. Occasionally a job's side effects (sending invoices) happen twice. Explain how, and propose a fix.
>>>
A worker takes the lease and starts the job. Then it's paused (GC, VM steal or migration, swap) or its network is delayed beyond 60 s. The lease expires and another worker takes it and runs the job, and then the first worker resumes and finishes sending, so the invoices go out twice (pp. 287–289, 293). The worker can't detect its own pause, so re-checking the lease doesn't close the gap. Fix: use a lock service that issues fencing tokens (e.g. a consensus-backed one like ZooKeeper) and make the side-effecting resource check them. For example, the invoice service records the highest token per job and rejects older ones, or, more generally, make the side effect idempotent with a unique job-run ID so a duplicate send is detected and dropped (p. 295).

### mcq
Which statement is TRUE?
- [ ] A TCP acknowledgment proves the remote application processed the request
- [ ] Monotonic clocks are suitable for ordering events across machines
- [x] With tight NTP synchronization, a packet can still appear to arrive before it was sent
- [ ] Fencing tokens protect against Byzantine nodes
>>>
NTP accuracy is limited by network delay, so the sender's and receiver's clocks can disagree by more than the transit time (p. 284). The others are false (pp. 273, 280, 295).

### mcq
Which system model assumes nodes may crash and later recover with their disk contents intact?
- [ ] Crash-stop
- [x] Crash-recovery
- [ ] Byzantine
- [ ] Synchronous
>>>
Crash-recovery: stable storage survives crashes, and in-memory state is lost (p. 299).

### tradeoff
You need globally ordered transaction timestamps across three datacenters. Compare a single timestamp-oracle server with a Spanner-like TrueTime approach.
- [x] A single oracle is simple and causally correct but adds a cross-datacenter round trip per transaction and is a bottleneck and single point of failure unless replicated; TrueTime avoids coordination but needs bounded clock uncertainty (GPS/atomic clocks) and adds a commit wait proportional to it
- [ ] The oracle is always faster
- [ ] TrueTime needs no special hardware
- [ ] Both are equivalent
>>>
Generating global IDs requires coordination and becomes a bottleneck. Spanner's commit wait trades latency for avoiding it, with GPS and atomic clocks keeping the uncertainty around 7 ms (pp. 285–286).

### explain
Classify and justify: (a) "Every message sent is eventually delivered if the network recovers"; (b) "A read never returns a value that was never written"; (c) "Replicas eventually converge"; (d) "At most one node holds the lease at any time".
>>>
(a) Liveness: it says something good eventually happens and can be unsatisfied at any given moment. (b) Safety: a violation is a specific read at a specific time and can't be undone. (c) Liveness: eventual consistency is a liveness property (p. 300). (d) Safety: two simultaneous holders is a violation you can pinpoint. As written, a lease-based system can't really guarantee it, because a paused node may *believe* it holds the lease, so the enforceable version is "the resource accepts writes only from the holder with the highest token".

### design
You run a ten-node cluster on a public cloud. Propose a "timing hygiene" checklist for the platform team, based on Chapter 8.
>>>
A good answer covers: (1) Measure RTT distributions continuously, including at peak, and set failure-detection timeouts from the data, or use adaptive (Phi Accrual) detectors (pp. 276). Consider the cascading-failure risk of aggressive timeouts (p. 273). (2) Use monotonic clocks for all timeouts and durations, and never wall-clock time (pp. 280–281). (3) Run NTP against several servers, alert on clock offset between nodes, and remove nodes that drift past a threshold (pp. 281–283, 298). Decide a leap-second policy (smearing). (4) Don't use LWW with wall-clock timestamps for data that matters. Use version vectors, conditional writes or logical clocks (p. 284). (5) Assume pauses: GC tuning or planned-outage GC (p. 290), disable swap, and watch steal time. (6) Every lock or lease protects its resource with fencing tokens checked by the resource (p. 295). (7) Inject faults regularly (pauses, partitions, clock jumps) and check safety properties from recorded histories (pp. 301–302).
:::
