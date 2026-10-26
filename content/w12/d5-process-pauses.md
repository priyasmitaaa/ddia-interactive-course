---
title: Process Pauses, Leases and Real-Time Guarantees
kind: lesson
minutes: 90
chapter: 8
objectives:
- Explain the two flaws in the lease-checking request loop on p. 287
- List the causes of process pauses (GC, VM suspension, laptop lids, context switches and steal time, synchronous disk I/O, paging, SIGSTOP)
- Explain why single-machine thread-safety tools don't carry over to distributed systems
- Explain what hard real-time systems require and why most data systems don't use them
- Describe ways to limit the impact of garbage collection pauses
reading:
- Process pauses | 287-289
- Response time guarantees | 289-290
- Limiting the impact of garbage collection | 290-291
complete:
- In the lease simulator, you made client 1 write after its lease expired, once with a pause and once with clock skew only
- You can list at least five causes of process pauses
- You answered the quiz
---

:::problem How does a leader know it is still the leader?
A database with a single leader per partition lets only the leader accept writes. How does a node know it's *still* the leader, that the others haven't declared it dead in the meantime? One option is a **lease**, which is like a lock with a timeout (p. 287). Only one node holds the lease at a time. The holder knows it's leader until the lease expires, and it must renew before then. If it fails, it stops renewing and another node takes over.

The book's request loop:

```java
while (true) {
  request = getIncomingRequest();
  // Ensure that the lease always has at least 10 seconds remaining
  if (lease.expiryTimeMillis - System.currentTimeMillis() < 10000) {
    lease = lease.renew();
  }
  if (lease.isValid()) {
    process(request);
  }
}
```

What's wrong with it?
:::

:::intuition Two flaws: someone else's clock, and the gap between check and act
**Flaw 1: it relies on synchronized clocks.** The expiry was set by a *different machine*, perhaps "now + 30 s" on the lock service, and it's compared with the *local* time-of-day clock. If the clocks are a few seconds apart, the code does strange things (p. 287).

**Flaw 2: even with a monotonic clock, it assumes little time passes between checking and acting.** Normally the 10-second buffer is plenty. But suppose the thread **stops for 15 seconds** around `lease.isValid()`. When it continues, the lease has probably expired and another node is leader. Nothing tells the thread it was paused, so it processes the request anyway and only notices on the next iteration, after it may already have done something unsafe (pp. 287–288).

**Is a 15-second pause realistic? Unfortunately yes** (pp. 288–289):
- **Garbage collection.** Stop-the-world GC pauses have lasted *several minutes*. Even "concurrent" collectors like HotSpot's CMS must stop the world sometimes.
- **VM suspension and live migration.** A VM can be suspended and resumed at any time, for any length of time. In live migration, the pause depends on how fast processes write to memory.
- **Laptops** suspend when the lid closes.
- **Context switches and hypervisor switches.** Under heavy load a thread may wait a while to run again. CPU time spent in other VMs is **steal time**.
- **Synchronous disk I/O**, including unexpected I/O such as the Java classloader lazily loading classes. On network storage like Amazon EBS, the delay is subject to network variability, and I/O pauses and GC pauses can combine.
- **Paging (swapping).** A memory access can trigger a page fault and a disk read. Under memory pressure the system may **thrash**, which is why servers often disable paging and would rather kill a process.
- **SIGSTOP** (Ctrl+Z) stops a process until SIGCONT. An operations engineer might send it by accident.

All of these preempt a thread at **any point** and resume it later **without the thread noticing**. It's like making multi-threaded code thread-safe: you can't assume anything about timing. But a distributed system has **no shared memory**, so mutexes, semaphores, atomic counters, lock-free data structures and blocking queues don't directly carry over. A node must assume it can be paused for a significant time **at any point, even in the middle of a function**. Meanwhile the world moves on and may declare it dead (p. 289).
:::

:::visual LeaseFencingSim | A paused lease holder
@props {"fencing":false}
Client 1 runs the loop above every 4 s with a 30 s lease. At t = 18, `isValid()` returns true and then a GC pause begins. Client 2 grabs the lease as soon as it expires.

**Try this:**
1. The **book scenario**: a 15 s pause. Watch client 1 resume and write after client 2 already holds the lease, with storage trusting both.
2. Set the pause to 5 s. No problem. What's the longest pause that's still safe?
3. Set the pause to 0 and the **clock offset** to −15 s (client 1's clock is behind). No pause at all, yet client 1 writes after expiry, because it compares the lock service's expiry with its own wrong clock. That's flaw 1.
4. Leave the fencing switch alone for now. That's next week's fix.
:::

:::details Real-time systems, and taming GC (pp. 289–291)
**Response time guarantees.** The reasons for pauses *can* be eliminated if you try hard enough. Systems that control aircraft, rockets, robots and cars must respond to sensors within a specified **deadline**. Missing it may mean failure of the whole system. These are **hard real-time** systems (you don't want an airbag delayed by an inconvenient GC pause). This requires support at every level:
- a real-time OS that schedules processes with guaranteed CPU time in specified intervals;
- library functions that document their worst-case execution times;
- restricted or no dynamic memory allocation (real-time GCs exist, but the application mustn't give them too much work);
- an enormous amount of testing and measurement.

It severely restricts languages, libraries and tools and is very expensive, so it's mostly used in safety-critical embedded devices. And **real-time is not high performance**: real-time systems may have *lower* throughput, because timely responses come first (compare the latency/utilization trade-off from Day 2). For most server-side data processing, real-time guarantees are "simply not economical or appropriate", so these systems must live with pauses and clock instability (p. 290).

Footnote vii: in embedded systems, *real-time* means carefully designed and tested to meet timing guarantees in all circumstances. On the web, "real-time" is used loosely for servers pushing data and for stream processing without hard deadlines (Chapter 11).

**Limiting the impact of garbage collection** (pp. 290–291). You don't need real-time scheduling to reduce the damage:
- **Treat GC pauses like brief planned outages.** If the runtime warns that a node will soon need a GC, the application stops sending it new requests, lets it finish outstanding ones, and collects while no requests are in progress. This hides pauses from clients and reduces high-percentile response times, and it's used in some latency-sensitive financial trading systems.
- **Use GC only for short-lived objects** (fast to collect) and **restart processes periodically**, before long-lived objects pile up enough to need a full GC. Restart one node at a time, shifting traffic away first, like a rolling upgrade (Chapter 4).

These measures can't fully prevent GC pauses, but they usefully reduce their impact.
:::

:::quiz
### mcq
In the request loop on p. 287, what is the problem even if `System.currentTimeMillis()` is replaced with a monotonic clock?
- [ ] Monotonic clocks can jump backwards
- [x] The thread can be paused for a long time between checking `lease.isValid()` and `process(request)`, so the lease may have expired before the request is processed
- [ ] The lease can never be renewed
- [ ] Monotonic clocks have poor resolution
>>>
A pause after the check means the action happens outside the lease. The thread doesn't notice until its next loop iteration (pp. 287–288).

### mcq
Which of these is NOT a cause of process pauses mentioned in the book?
- [ ] Stop-the-world garbage collection
- [ ] A VM being suspended for live migration
- [ ] Page faults when memory is swapped to disk
- [x] The CPU's clock speed being too low
>>>
The listed causes include GC, VM suspension, laptop lids, context switches and steal time, synchronous disk I/O (even lazy class loading), paging and thrashing, and SIGSTOP (pp. 288–289).

### predict
In the simulator, client 1's clock is 15 s behind real time and there are no pauses. What happens?
- [ ] Nothing bad: without pauses, leases are safe
- [x] Client 1 believes its lease still has time left after it has expired, keeps processing requests, and writes after client 2 has taken over
- [ ] Client 1 renews too early
- [ ] Client 2 can never get the lease
>>>
That's flaw 1: the expiry comes from the lock service's clock but is compared with client 1's local clock (p. 287).

### tradeoff
Why don't most data systems use hard real-time operating systems to eliminate pauses?
- [x] Real-time guarantees need support at every layer, restrict languages and tools, and require enormous testing; they're very expensive and can lower throughput, which isn't economical for most server-side systems
- [ ] Real-time systems can't run databases
- [ ] Real-time systems are slower to boot
- [ ] Real-time systems don't support networking
>>>
Developing real-time systems is mostly reserved for safety-critical embedded devices (pp. 289–290).

### mcq
What is the "planned outage" approach to garbage collection?
- [ ] Running GC only at night
- [ ] Disabling GC entirely
- [x] The runtime warns that a node needs a GC; the application stops sending it requests, lets in-flight ones finish, then collects while idle, so clients don't see the pause
- [ ] Restarting the whole cluster at once
>>>
This hides GC pauses from clients and reduces high-percentile latency. Some trading systems do it (pp. 290–291).

### explain
Why can't we just use a mutex, as in multi-threaded code, to stop two nodes acting as leader at the same time?
>>>
Mutexes, semaphores and atomic counters rely on shared memory: every thread sees the same lock variable, updated atomically by the hardware. A distributed system has no shared memory, only messages over an unreliable network with unbounded delays (p. 289). The closest equivalent, a lease from a lock service, is itself a message-based protocol. A node can be paused at any point, the lease can expire during the pause, and the node won't notice. So "I hold the lock" is only a belief, which may be out of date by the time the node acts on it. A distributed design must make sure such stale beliefs can't do damage, and that's the subject of next week: fencing tokens.
:::

:::connect Where this goes next
Tomorrow's review consolidates networks, clocks and pauses. Next week: if a node can't trust its own judgment, who decides what's true? The answer is the majority, plus a simple trick that makes stale lease holders harmless.
:::
