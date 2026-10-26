---
title: Detecting Faults, Timeouts and Unbounded Delays
kind: lesson
minutes: 95
chapter: 8
objectives:
- List the ways a system can get explicit feedback that a node is down, and why you can't rely on them
- Explain the trade-off between short and long timeouts, including the cascading-failure risk
- Explain why 2d + r would be a good timeout, and why real networks have no such bounds
- Name the sources of queueing that make network delays variable
- Contrast circuit-switched (synchronous) and packet-switched (asynchronous) networks, and explain why datacenters choose the latter
reading:
- Detecting faults | 272-273
- Timeouts and unbounded delays | 273-274
- Network congestion and queueing; TCP vs UDP | 274-276
- Synchronous vs asynchronous networks | 276-277
- Latency and resource utilization | 277-278
complete:
- You found a load level at which a timeout that was safe becomes dangerous, in the timeout visualization
- Exercise 28 (failure detectors) is done
- You answered the quiz
---

:::problem How long should you wait?
Load balancers need to stop sending requests to dead nodes. Single-leader databases need to promote a follower when the leader dies (Chapter 5). Both must **detect faulty nodes automatically**, and as you saw yesterday, the network makes it hard to tell whether a node is working. Usually the only sure method is a **timeout**. "There is unfortunately no simple answer" to how long it should be (p. 273).
:::

:::intuition Short timeouts lie; long timeouts wait
**Sometimes you get explicit feedback** (pp. 272–273):
- The machine is reachable but nothing listens on the port (the process crashed). The OS refuses the TCP connection with a RST or FIN. But if the node crashed *while handling your request*, you don't know how much it processed.
- The process crashed but the OS is alive. A script can tell other nodes so they take over without waiting for a timeout, as HBase does.
- You can query your datacenter's switches to detect link failures at the hardware level. That's impossible over the internet, in shared datacenters, or when the network problem prevents you reaching the management interface.
- A router may reply with ICMP *Destination Unreachable*, but routers don't have magic failure detection either.

Rapid feedback helps, but **you can't count on it**. Even a TCP acknowledgment only means the packet was delivered, not that the application handled it. If you need to know a request succeeded, you need a **positive response from the application** (p. 273). In general, you retry a few times, wait for a timeout, and then declare the node dead.

**The trade-off** (p. 273):
- A **long** timeout means a long wait before a node is declared dead. Meanwhile users wait or see errors.
- A **short** timeout detects faults faster but may declare a node dead that only had a temporary slowdown (a load spike).

**Prematurely declaring a node dead is harmful.** Its responsibilities move to other nodes, adding load on them and on the network. If the system is already struggling with high load, this makes it worse and can cause a **cascading failure**. In the extreme, all nodes declare each other dead and everything stops.

**An ideal that doesn't exist.** If the network delivered every packet within time **d** or lost it, and a working node always handled a request within time **r**, then every successful request would get a response within **2d + r**. That would be a perfect timeout. Real systems have neither guarantee: asynchronous networks have **unbounded delays**, and servers can't promise a maximum handling time. It's not enough for the system to be fast *most of the time*. With a low timeout, one transient spike in round-trip times throws it off balance (pp. 273–274).
:::

:::visual NetworkTimeoutSim | Choosing a timeout
@props {"initialTab":"timeout"}
**Try this:**
1. At 50% load with no pauses, find the smallest fixed timeout with zero false suspicions. Note the detection time.
2. Raise the load to 90% and keep the same timeout. How many false suspicions now?
3. Add a 2% pause chance. How long must the timeout be now, and how long does detecting the real crash take?
4. Switch on **adaptive timeout** and repeat steps 1–3. The adaptive line follows the observed round-trip distribution, much as Phi Accrual detectors and TCP retransmission timeouts do (p. 276).
:::

:::details Why delays vary, and why networks are built that way (pp. 274–278)
**Network congestion and queueing.** Variable packet delay is mostly **queueing**, the network equivalent of traffic jams (p. 274):
- Several nodes send to the same destination, so the **switch queues** packets for that link (Figure 8-2). If the queue fills up, packets are **dropped** and must be resent, even though the network is working fine.
- At the destination, if all CPU cores are busy, the **OS queues** the request until the application is ready.
- In **virtualized** environments, a VM is paused for tens of milliseconds while another VM uses the core, and the hypervisor buffers incoming data.
- **TCP flow control** (congestion avoidance) limits the sending rate, which queues data at the sender before it even enters the network.
- **TCP retransmission**: a packet not acknowledged within a timeout is retransmitted. The application doesn't see the loss, but it does see the delay.

**TCP vs UDP** (p. 275). Latency-sensitive applications like video calls and VoIP use **UDP**. It doesn't do flow control or retransmission, so it avoids some of the variability, though not switch queues and scheduling delays. UDP suits cases where **delayed data is worthless**: there's no point retransmitting a voice packet after its playback time has passed. The application fills the gap with silence.

Queueing delay is especially variable **near maximum capacity**. A system with spare capacity drains its queues, while a highly utilized one builds long queues quickly. In public clouds and multi-tenant datacenters, links, switches, NICs and CPUs are shared, and a **noisy neighbor** running a batch job can saturate a link. The book's advice: **choose timeouts experimentally**. Measure the round-trip distribution over a long period and many machines, then pick the trade-off for your application. Better still, adjust timeouts **automatically** from observed response times and jitter, for example with a **Phi Accrual failure detector** (Akka, Cassandra) (p. 276).

**Synchronous vs asynchronous networks** (pp. 276–277). The fixed-line telephone network is very reliable. A call sets up a **circuit**: a fixed, guaranteed amount of bandwidth along the whole route for the whole call. An ISDN network runs at 4,000 frames per second, and each call gets 16 bits per frame in each direction, so each side may send exactly 16 bits every 250 µs. Space is reserved at every hop, so there's **no queueing** and the maximum end-to-end latency is fixed. That's a **bounded delay**, and such a network is **synchronous**.

So why don't datacenters do this? A circuit reserves bandwidth that nobody else can use. A TCP connection opportunistically uses whatever is available and uses nothing when idle. Ethernet and IP are **packet-switched**, which means queueing and unbounded delays. They're **optimized for bursty traffic**. A call needs a constant bit rate, but a web page, an email or a file transfer just wants to finish as fast as possible. With circuits you'd have to guess a bandwidth: guess too low and the transfer is needlessly slow, guess too high and the circuit can't be set up. TCP adapts the rate to the available capacity. Hybrids exist: ATM, and InfiniBand with link-layer flow control (which can still suffer link congestion). With QoS and admission control you can emulate circuits or get statistically bounded delay, but none of that is enabled in multi-tenant datacenters, public clouds or the internet today. So there's **no "correct" timeout value**. It must be determined experimentally (pp. 277–278).

**Latency and resource utilization** (box, p. 278). Variable delay is a consequence of **dynamic resource partitioning**. A telephone wire with 10,000 call slots divides its capacity *statically*: your call gets its slot even if the other 9,999 are empty. The internet shares bandwidth *dynamically*. Senders jostle to get packets onto the wire, which causes queueing but maximizes utilization, and each byte gets cheaper. CPUs work the same way: threads wait in the run queue, which is still better utilization than static allocation (and it's a big reason for using VMs). Latency guarantees are possible with static partitioning, but they cost reduced utilization. **Variable delays are not a law of nature, but the result of a cost/benefit trade-off.**
:::

:::practice 28-failure-detectors | Fixed timeouts vs Phi Accrual
Build both detectors and measure false suspicions against detection time at different loads.
:::

:::quiz
### mcq
Your process receives a TCP acknowledgment for a request it sent to another service. What does that tell you?
- [ ] The remote application processed the request
- [ ] The request was durably stored
- [x] Only that the packet reached the remote machine's network stack; the application may have crashed before handling it
- [ ] The remote node is healthy
>>>
To know a request succeeded you need a positive response from the application itself (p. 273).

### tradeoff
Why can a too-short timeout make an overloaded system worse?
- [x] Healthy but slow nodes get declared dead, their work moves to other nodes, which adds load to those nodes and the network and can cascade until nodes declare each other dead
- [ ] Short timeouts use more memory
- [ ] Short timeouts disable TCP retransmission
- [ ] Short timeouts slow down detection of real failures
>>>
Premature declarations transfer responsibilities and add load exactly when the system is already struggling (p. 273).

### mcq
If the network guaranteed delivery within d or loss, and nodes always handled requests within r, what timeout would be safe?
- [ ] d
- [ ] d + r
- [x] 2d + r
- [ ] 2r + d
>>>
Request travel (d), handling (r) and response travel (d). Real asynchronous networks and servers provide no such bounds (p. 273).

### mcq
Which of these is NOT given in the book as a source of variable network delay?
- [ ] Switch queues when several senders target the same link
- [ ] VMs being paused while another VM uses the CPU core
- [ ] TCP flow control and retransmission
- [x] The speed of light varying with network load
>>>
Variable delays are mostly due to queueing: in switches, at the OS, in the hypervisor, and through TCP's flow control and retransmissions (pp. 274–275).

### tradeoff
Why do datacenters use packet switching instead of circuits that would give bounded delays?
- [ ] Circuits are impossible to build
- [x] Packet switching suits bursty traffic and maximizes utilization; circuits waste reserved bandwidth and force you to guess a rate, so bounded delay would be more expensive
- [ ] Packet switching has lower average latency in every case
- [ ] Circuits can't carry TCP
>>>
Variable delays are the result of a cost/benefit trade-off, not a law of nature (pp. 277–278).

### explain
Your team wants to set the cluster's failure-detection timeout. Describe a sound way to choose it, based on the book.
>>>
There's no universally correct value, because the network has unbounded delays. So choose experimentally: measure the distribution of round-trip times over an extended period and across many machines, including busy periods, to see the variability (jitter). Then decide the trade-off for your application: how long can you tolerate a dead node going unnoticed (unavailability) versus how often you can tolerate falsely declaring a live node dead (needless failovers and extra load, with a risk of cascades)? Better still, don't use a constant. Measure response times continuously and adapt the timeout to the observed distribution, as a Phi Accrual failure detector does in Akka and Cassandra, or as TCP's retransmission timeouts do (pp. 273, 276).

### scenario
A video-calling app built on TCP has awkward freezes on bad Wi-Fi, after which the audio "catches up". Explain why, and what the book suggests.
>>>
TCP retransmits lost packets and delivers data in order. When a packet is lost, everything behind it waits for the retransmission (a timeout plus another round trip), and then the late audio is played back, so the stream freezes and catches up. For real-time audio and video, delayed data is worthless: by the time it arrives, it's too late to play. UDP doesn't retransmit or do flow control, so it avoids those sources of delay variability. The application just fills a missing packet's slot with silence or concealment and moves on (p. 275). It's a trade-off between reliability and variability of delay.
:::

:::connect Where this goes next
Timeouts measure **durations**. Tomorrow: the clocks that measure them, and the other kind of clock that tells the time of day. They behave very differently, and confusing them causes real bugs.
:::
