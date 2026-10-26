---
title: Faults, Partial Failures and Unreliable Networks
kind: lesson
minutes: 80
chapter: 8
objectives:
- Explain why a single computer is either working or broken, while a distributed system can be partly broken
- Define partial failure and explain why its non-determinism is what makes distributed systems hard
- Contrast how supercomputers and cloud/internet services handle faults
- List the six things that can go wrong with a request over an asynchronous network, and explain why the sender can't tell them apart
- Describe how common network faults are in practice and why they must be handled anyway
reading:
- Chapter 8 opening | 265-266
- Faults and partial failures | 266-267
- Cloud computing and supercomputing | 267-269
- Unreliable networks | 269-271
- Network faults in practice | 271-272
complete:
- You tried all six hidden fates in the network visualization before revealing them
- You can explain why "no response" carries no information about what happened
- You answered the quiz
---

:::problem Anything that can go wrong will go wrong
Chapters 5–7 dealt with replica failover, replication lag and concurrency control, but they were still "too optimistic" (p. 265). Chapter 8 assumes the worst: **anything that can go wrong will go wrong**, with one exception: nodes aren't malicious (non-Byzantine; that comes later).

On one computer, things are tidy. With good software and working hardware, the same operation always gives the same result. When hardware fails, the usual result is a **total** failure: a kernel panic, a blue screen, a machine that won't boot (p. 266). Computers are deliberately designed this way. They'd rather crash than return a wrong answer, so they present an **idealized system model** of mathematical perfection.

Once software runs on several computers connected by a network, that idealization is gone. Coda Hale's list of real incidents in one datacenter includes long network partitions, power distribution unit failures, switch failures, accidental power cycles of whole racks, and a driver crashing a pickup truck into the datacenter's air conditioning (p. 267).
:::

:::intuition Partial failure: some of it is broken, and you can't be sure which part
In a distributed system, some parts can be broken in unpredictable ways while others work fine. This is a **partial failure**. Partial failures are **non-deterministic**: an operation that involves several nodes and the network may sometimes work and sometimes fail unpredictably. You may not even **know whether it succeeded** (p. 267). That non-determinism is what makes distributed systems hard.

**Two philosophies** (pp. 267–268):
- **High-performance computing** (supercomputers for weather forecasting or molecular dynamics) checkpoints computations. If a node fails, the whole cluster stops, the node is repaired, and the job restarts from the last checkpoint. That turns a partial failure into a total one, like a kernel panic. Specialized, reliable hardware with RDMA and special network topologies makes this workable for batch jobs.
- **Internet services** are different:
  - They are **online**, so stopping the cluster for a repair isn't acceptable.
  - They run on **commodity machines**, which are cheaper but fail more often, connected by IP/Ethernet in Clos topologies.
  - In a system with thousands of nodes, **something is always broken**.
  - Tolerating failed nodes enables rolling upgrades and killing slow VMs.
  - Geo-distributed deployments communicate over the slow, unreliable internet.

So we must **build a reliable system from unreliable components**, with fault tolerance built into the software. Even a small system with a few nodes will hit a fault sooner or later. Suspicion, pessimism and paranoia pay off. Deliberately trigger faults in testing (p. 269).

**Is that even possible?** (box on p. 269) Yes, it's an old idea:
- **Error-correcting codes** send data accurately over a channel that flips bits.
- **TCP** gives reliable, ordered, de-duplicated delivery on top of IP, which drops, delays, duplicates and reorders packets.

There's always a limit, though. TCP can hide loss, duplication and reordering, but it **cannot remove delays**. The higher-level system takes care of the tricky low-level faults, so the faults that remain are easier to reason about.
:::

:::visual NetworkTimeoutSim | Six faults, one symptom
@props {"initialTab":"see"}
**Try this:**
1. Leave *Reveal* off. Pick each fate in turn: request lost, request queued, node crashed, node paused, response lost, response delayed. The client's view is identical every time: **no response by the timeout**.
2. Now reveal each one. In which cases did the service actually process the request?
3. Think about what a client should do after a timeout. Retry? What if the operation was "charge the card $50"?
:::

:::details Shared-nothing, asynchronous networks (pp. 269–272)
This book focuses on **shared-nothing** systems. Each machine has its own memory and disk, and the network is the only way machines communicate. The internet and most datacenter networks are **asynchronous packet networks**: a node can send a packet, but the network guarantees neither *when* it will arrive nor *whether* it will (p. 270).

If you send a request and expect a response, any of these can happen (Figure 8-1):
1. The request was **lost** (an unplugged cable).
2. The request is **waiting in a queue** and will be delivered later (an overloaded network or recipient).
3. The remote node **failed** (crashed or powered down).
4. The remote node **temporarily stopped responding** (a long GC pause) but will respond later.
5. The node processed the request, but the **response was lost** (a misconfigured switch).
6. The node processed it, but the **response is delayed** (the network or your own machine is overloaded).

The sender can't even tell whether the packet was delivered. The only way to find out is a response, which can itself be lost or delayed. **If you don't get a response, it is impossible to tell why.** The usual answer is a **timeout**: give up waiting after a while. Even then you don't know whether the node got the request, and a queued request may still be delivered after you've given up (p. 271).

**Network faults in practice** (pp. 271–272):
- One medium-sized datacenter saw about **12 network faults a month**. Half disconnected a single machine and half a whole rack.
- Adding redundant network gear helps less than you'd hope, because it doesn't guard against **human error** such as misconfigured switches, a major cause of outages.
- Public clouds like EC2 are notorious for frequent transient glitches.
- A switch software upgrade once triggered a topology reconfiguration that delayed packets for **more than a minute**.
- One network interface dropped all *inbound* packets while sending outbound ones fine. A link can work in one direction and not the other.

The book says **network fault** rather than "network partition" or netsplit, to avoid confusion with the partitions (shards) of Chapter 6.

Even if faults are rare in your environment, they *can* happen, so your software must handle them. If error handling for network faults isn't defined and tested, arbitrarily bad things can happen. The cluster can deadlock permanently even after the network recovers, or it can even delete all your data (p. 272). **Handling** a fault doesn't have to mean **tolerating** it. Showing users an error while the network is broken can be a valid choice. What matters is knowing how your software reacts, making sure it recovers, and testing it deliberately (chaos monkey, Chapter 1).
:::

:::quiz
### mcq
Why do computers deliberately crash completely when an internal fault occurs, instead of continuing?
- [ ] Because crashing is cheaper than error handling
- [x] Because a wrong result is much harder and more confusing to deal with than a crash, so computers present an idealized always-correct model
- [ ] Because operating systems can't detect hardware faults
- [ ] Because supercomputers require it
>>>
The design goal of always-correct computation goes back to the first digital computers. A single computer is therefore usually either fully working or entirely broken, with nothing in between (p. 266).

### mcq
What makes partial failures so hard to deal with?
- [ ] They only happen in supercomputers
- [ ] They always crash the whole system
- [x] They are non-deterministic: an operation involving several nodes may sometimes work and sometimes fail, and you may not even know whether it succeeded
- [ ] They can be prevented with better hardware
>>>
A distributed system can be partly broken in unpredictable ways, and you can't always tell the outcome of an operation. That non-determinism is the core difficulty (p. 267).

### predict
A client sends "transfer $100" to a payment service and gets no response within the timeout. What can the client conclude?
- [ ] The transfer did not happen
- [ ] The transfer happened
- [ ] The service crashed
- [x] Nothing about whether it happened: the request might have been lost, queued, processed with a lost response, or the service might be down or paused
>>>
All six cases in Figure 8-1 look identical to the sender. The transfer might have been processed, so a blind retry could apply it twice. That's why idempotent operations or request IDs matter (pp. 270–271).

### mcq
How does a typical supercomputer handle the failure of one node?
- [ ] It routes around the failure transparently
- [x] It stops the whole cluster workload, repairs the node, and restarts the computation from the last checkpoint: partial failure is escalated to total failure
- [ ] It ignores the node's results
- [ ] It uses a quorum vote
>>>
That's acceptable for offline jobs like weather simulations, but not for online internet services that must always be available (pp. 267–268).

### tradeoff
"Our datacenter network has redundant switches, so we don't need to handle network faults." What's wrong with this argument?
- [x] Redundancy doesn't prevent human error such as misconfigured switches, a major cause of outages; and if faults can occur at all, the software must define and test how it reacts
- [ ] Nothing, as long as the switches are from different vendors
- [ ] Redundant switches make faults more common
- [ ] Network faults only happen on the public internet
>>>
Studies found redundancy reduced faults less than hoped because of human error. Untested fault handling can lead to deadlocked clusters or even deleted data (pp. 271–272).

### explain
Explain how TCP shows that you can build a more reliable system from less reliable parts, and what TCP cannot hide.
>>>
IP is unreliable: it may drop, delay, duplicate or reorder packets. TCP adds retransmission of missing packets, removal of duplicates and reassembly in the sending order, so the application sees a reliable, ordered byte stream. That is a more reliable layer built on an unreliable one. But there's a limit: TCP cannot remove delays. Lost packets still have to be retransmitted, which takes time, and queueing is still queueing. So the higher layer is more reliable, but not perfect. It takes care of the tricky low-level faults, which makes the remaining ones easier to reason about (p. 269).
:::

:::connect Where this goes next
A timeout is the only general tool for detecting faults. Tomorrow: how long should a timeout be? Why are network delays so variable in the first place? And why can't we simply build networks like the telephone system, with guaranteed delays?
:::
