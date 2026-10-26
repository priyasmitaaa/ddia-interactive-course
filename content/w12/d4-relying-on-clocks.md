---
title: Relying on Synchronized Clocks — LWW, Confidence Intervals and Spanner
kind: lesson
minutes: 95
chapter: 8
objectives:
- Explain why broken clocks lead to silent data loss rather than crashes, and why clock offsets must be monitored
- Walk through Figure 8-3 and explain how last-write-wins drops a causally later write
- State the three fundamental problems with LWW based on physical timestamps
- Explain why a clock reading should be thought of as a confidence interval
- Explain how Spanner uses TrueTime intervals and commit wait to get causally consistent timestamps
reading:
- Relying on synchronized clocks | 282-283
- Timestamps for ordering events | 283-284
- Clock readings have a confidence interval | 284-285
- Synchronized clocks for global snapshots | 285-286
complete:
- You reproduced Figure 8-3 in the visualization and found the skew at which LWW stops losing the increment
- You showed with confidence intervals why Spanner needs commit wait
- Exercise 29 Part B is done
- You answered the quiz
---

:::problem Clocks fail silently
A day may not have exactly 86,400 seconds. Time-of-day clocks can move backwards. One node's time may be quite different from another's (p. 282). As with networks, robust software must be prepared for clocks to be wrong.

What makes clocks worse than networks is that **incorrect clocks go unnoticed**. A defective CPU or a misconfigured network gets noticed quickly because nothing works. A defective quartz or a misconfigured NTP client leaves things *seeming* to work while the clock drifts further from reality. Software that relies on synchronized clocks then suffers **silent and subtle data loss** rather than a dramatic crash (pp. 282–283). The book's advice: if you rely on synchronized clocks, **monitor the clock offsets between all machines**, and declare dead and remove any node that drifts too far.
:::

:::intuition Figure 8-3: the increment that vanished
A multi-leader database (similar to Figure 5-9; p. 283):
1. Client A writes **x = 1** on node 1, which timestamps it **42.004** by node 1's clock.
2. The write is replicated to node 3.
3. Client B, on node 3, reads x = 1 and **increments** it: x = 2, timestamped **42.003** by node 3's clock.
4. Both writes reach node 2, which keeps the one with the higher timestamp: **x = 1**.

B's write is *unambiguously later* (it read A's value), yet it has the earlier timestamp. The skew between nodes 1 and 3 was under 3 ms, better than you can usually expect. B's increment is **lost**, and nobody gets an error.

This conflict resolution strategy is **last write wins (LWW)**, widely used in multi-leader replication and in leaderless databases like **Cassandra** and **Riak** (Chapter 5). Generating timestamps on the client instead of the server doesn't change the fundamental problems (p. 284):
- **Writes mysteriously disappear.** A node with a lagging clock can't overwrite values written by a node with a fast clock until the skew has elapsed. Arbitrary amounts of data are silently dropped.
- **LWW can't distinguish sequential from concurrent writes.** B's increment definitely came after A's write, but LWW only sees timestamps. You need causality tracking such as version vectors (Chapter 5).
- **Ties.** Two nodes can generate the same timestamp, especially with millisecond resolution. A tiebreaker, even a large random number, is needed, but it can also violate causality.

Even with tight NTP sync you could send a packet at 100 ms by the sender's clock and receive it at 99 ms by the recipient's, so it seems to arrive before it was sent. Could NTP get accurate enough? Probably not. Its accuracy is limited by network round-trip time plus drift, and correct ordering would need the clock to be **much more accurate than the network delay it's ordering**. **Logical clocks** are safer. They're based on incrementing counters, not oscillating quartz, and they capture only relative order, not time of day. More in Chapter 9, "Ordering Guarantees" (p. 284).
:::

:::visual ClockSkewLWW | Last write wins with skewed clocks
@props {"initialTab":"lww"}
**Try this:**
1. Press **Figure 8-3 values**. Node 3's clock is 3 ms behind and B's increment is lost.
2. Increase **B's think time** until B wins. How long must B wait after seeing A's write? Compare with the skew.
3. Set the skew to +3 ms. Now node 3's writes always win, even if one were truly older.
4. Switch to the **logical counter**. The causally later write wins regardless of skew.
5. Open the **Confidence intervals** tab. Set ε = 7 ms and move "B starts after A by" from 0 to 20 ms: when do the intervals stop overlapping? Then turn on **commit wait**.
:::

:::details Confidence intervals, TrueTime and Spanner (pp. 284–286)
**A clock reading has a confidence interval** (p. 285). You might read a clock with microsecond or nanosecond *resolution*, but that doesn't make it *accurate* to that precision. Drift from an imprecise quartz can easily be several milliseconds even when syncing with a local NTP server every minute. With a public internet server, the best accuracy is probably tens of milliseconds, spiking past 100 ms under congestion. So a reading is better thought of as a **range**: "95% confident the time is between 10.3 and 10.5 seconds past the minute". If you only know the time ± 100 ms, the microsecond digits are meaningless.

The uncertainty can be calculated. With a GPS receiver or atomic clock attached, the manufacturer reports the error range. From a server, it's the expected drift since the last sync, plus the server's uncertainty, plus the round-trip time. But most APIs **don't expose it**: `clock_gettime()` doesn't tell you whether the error is 5 ms or 5 years. The exception is **Google's TrueTime API** in Spanner. It returns **[earliest, latest]**, and the true time is somewhere inside. The width depends on how long it's been since the last sync with an accurate source.

**Synchronized clocks for global snapshots** (pp. 285–286). Snapshot isolation (Chapter 7) needs a monotonically increasing transaction ID: writes with a later ID are invisible to the snapshot. On a single node a counter is enough. Across many machines, possibly in several datacenters, a global ID is hard because it requires coordination. The ID must also reflect **causality**: if B reads a value A wrote, B needs a higher ID. With many small, rapid transactions, generating IDs becomes an untenable bottleneck. (Footnote: generators like Twitter's **Snowflake** hand out *approximately* increasing IDs by giving blocks to nodes, but they generally can't guarantee causal order.)

Could synchronized clock timestamps serve as transaction IDs? The obstacle is uncertainty. Spanner's observation: if two intervals **don't overlap** (A_earliest < A_latest < B_earliest < B_latest), B **definitely** happened after A. Only overlapping intervals leave the order uncertain. So Spanner **deliberately waits for the length of the confidence interval before committing a read-write transaction**. Any transaction that could read the data then starts late enough that the intervals don't overlap. To keep the wait short, Google deploys a **GPS receiver or atomic clock in each datacenter**, synchronizing clocks to within about **7 ms**.

In 2016 this was an area of active research, "not yet implemented in mainstream databases outside of Google" (p. 286).
:::

:::extra Beyond the 2016 text
**Not from the book.** Since this early release, several databases have used clock-based ideas, often with **hybrid logical clocks** (HLC), which combine physical time with a logical counter so timestamps stay close to wall-clock time but still respect causality. CockroachDB and YugabyteDB use HLCs. Cloud providers also now offer more accurate time services, for example Amazon Time Sync Service with microsecond-level accuracy on supported instances and an API that reports error bounds, similar in spirit to TrueTime. Check current documentation for the details. The book's core point still holds: correctness depends on knowing your clock's error bound.
:::

:::practice 29-clocks-lww | LWW with skewed clocks vs logical counters (Part B)
Count how many of 1000 *sequential* increments LWW silently loses as skew grows, then fix it with a logical counter.
:::

:::quiz
### mcq
In Figure 8-3, why does node 2 end up with x = 1?
- [ ] Because node 2's clock is wrong
- [x] Because B's causally later write received an earlier timestamp from node 3's slightly lagging clock, and LWW keeps the higher timestamp
- [ ] Because the write from node 3 was lost in the network
- [ ] Because node 1 is the leader
>>>
The timestamps (42.004 vs 42.003) contradict the real order. LWW trusts the timestamps, so B's increment is silently discarded (pp. 283–284).

### predict
Node 3's clock is 3 ms behind node 1's. Replication from node 1 to node 3 takes 1 ms. How long after seeing A's write must B wait for its write to win under LWW?
- [ ] No wait at all
- [ ] 1 ms
- [x] More than 2 ms (B's timestamp is real time − 3 ms, and it gets a 1 ms head start from replication)
- [ ] 3 ms
>>>
Writes from the lagging node are dropped until the skew has elapsed (p. 284). You can check this with the think-time slider.

### mcq
Which of these is NOT one of the book's problems with LWW using physical timestamps?
- [ ] A node with a lagging clock can't overwrite values from a node with a fast clock
- [ ] It can't distinguish sequential writes from truly concurrent ones
- [ ] Two nodes may generate identical timestamps, needing a tiebreaker
- [x] It requires a leader to assign timestamps
>>>
LWW needs no leader, which is why it's popular in leaderless databases like Cassandra and Riak. The three listed problems are on p. 284.

### mcq
Why do clock problems tend to cause data loss rather than crashes?
- [ ] Because databases ignore timestamps
- [x] Because a drifting clock or misconfigured NTP leaves everything apparently working, so software that relies on the clock quietly makes wrong decisions
- [ ] Because clocks are only used for logging
- [ ] Because NTP repairs data automatically
>>>
That's why you must monitor clock offsets and remove nodes whose clocks drift too far (pp. 282–283).

### tradeoff
Spanner waits out the clock uncertainty before committing each read-write transaction. What does that buy, and what does it cost?
- [x] Timestamps that are guaranteed to reflect causality, enabling distributed snapshot isolation without a central ID generator; the cost is extra commit latency, kept small by GPS receivers and atomic clocks in each datacenter
- [ ] Faster commits, at the cost of weaker consistency
- [ ] Freedom from clock synchronization, at the cost of storage
- [ ] Lower hardware costs, at the cost of uncertainty
>>>
Non-overlapping confidence intervals mean a definite order. Waiting makes sure any later reader's interval doesn't overlap. Spanner keeps the uncertainty around 7 ms (p. 286).

### explain
A colleague says: "Our servers' clocks have nanosecond resolution, so our event timestamps are accurate to the nanosecond." Respond using the book.
>>>
Resolution isn't accuracy. A clock can be read with nanosecond resolution and still be wrong by milliseconds or more. Quartz drift can reach several milliseconds even with frequent NTP sync on the local network, and syncing over the internet is accurate to tens of milliseconds at best, spiking past 100 ms under congestion (p. 285). A reading is really a confidence interval, and if you know the time only to ±100 ms, the nanosecond digits mean nothing. Most clock APIs don't even report their uncertainty. TrueTime is an exception. For ordering events across machines, use logical clocks or an explicit uncertainty bound like TrueTime, not raw timestamps.

### scenario
A shopping-cart service on a leaderless store uses LWW. Users occasionally report that an item they added "disappeared" a few seconds after they removed a different item. Suggest a cause and two fixes.
>>>
Cause: the add and the remove go to different replicas whose time-of-day clocks are skewed. The later operation gets an earlier timestamp, or both are treated as overwriting one cart value, and LWW silently discards one of them (pp. 283–284). LWW also can't tell sequential operations from concurrent ones. Fixes: (1) stop using LWW for the cart value. Track causality with version vectors and merge siblings, for example as a set union with tombstones for removals (Chapter 5), or use a CRDT set. (2) If you must keep timestamps, use logical or hybrid logical clocks so causally later writes get larger timestamps, and monitor clock offsets, removing nodes that drift. Storing each cart item as its own key or row also avoids whole-cart overwrites.
:::

:::connect Where this goes next
Clocks can be wrong, but at least a node *knows* it's reading a clock. Tomorrow: a node that doesn't even know time has passed, because its execution was paused mid-function, and what that does to a leader holding a lease.
:::
