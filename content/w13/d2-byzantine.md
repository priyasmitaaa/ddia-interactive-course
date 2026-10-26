---
title: Byzantine Faults and Weak Forms of Lying
kind: lesson
minutes: 70
chapter: 8
objectives:
- Define Byzantine faults and the Byzantine Generals Problem, and relate it to the Two Generals Problem
- Explain where Byzantine fault tolerance matters (aerospace, mutually untrusting organizations) and why most data systems assume no Byzantine faults
- Explain why BFT algorithms can't protect against software bugs or attackers in typical deployments
- List practical defenses against weak forms of lying (checksums, input sanitization, multiple NTP servers)
reading:
- Byzantine faults; the Byzantine Generals Problem | 295-297
- Weak forms of lying | 297-298
complete:
- You can say for each example whether it calls for Byzantine fault tolerance, a "weak lying" defense, or neither
- You answered the quiz
---

:::problem What if a node lies?
Fencing tokens catch a node that is wrong **inadvertently**, such as one that hasn't noticed its lease expired. A node that **deliberately** wanted to subvert the guarantees could just send a fake token (p. 295).

The book assumes nodes are **unreliable but honest**. They may be slow or never respond (a fault), and their state may be outdated (a GC pause, network delay). But if a node responds, it's telling the "truth": to the best of its knowledge, it plays by the protocol's rules. Problems get much harder if nodes may **lie**, sending arbitrary faulty or corrupted responses, such as claiming to have received a message it never got. That is a **Byzantine fault**, and reaching consensus in that untrusting environment is the **Byzantine Generals Problem** (pp. 295–296).
:::

:::intuition Generals, traitors and supermajorities
**The Two Generals Problem** (box, p. 296): two generals camped at different sites must agree on a battle plan. They can only communicate by messenger, and messengers get delayed or captured, like packets. (This returns in Chapter 9.)

**The Byzantine Generals Problem** generalizes it: *n* generals must agree, but there are **traitors** among them. Most are loyal and send truthful messages. The traitors send fake or untrue messages while trying to stay undiscovered, and nobody knows in advance who they are.

(On the name: Byzantium, later Constantinople, now Istanbul, has no special history of devious generals. "Byzantine" means excessively complicated, bureaucratic or devious. Lamport wanted a nationality that wouldn't offend readers, and was advised that "The Albanian Generals Problem" was not a good idea.)

A system is **Byzantine fault tolerant** if it keeps operating correctly even when some nodes malfunction and don't obey the protocol, or attackers interfere with the network (p. 296). Most BFT algorithms need a **supermajority of more than two-thirds** of nodes to be working correctly. With four nodes, at most one may malfunction (p. 297).

<div class="figure">
<svg class="dg" viewBox="0 0 640 150" role="img" aria-label="Crash faults versus Byzantine faults: majority versus two-thirds supermajority">
  <text x="20" y="22" font-weight="700">Crash-tolerant (honest nodes): majority</text>
  <rect class="boxb" x="20" y="34" width="48" height="36" rx="6"/><rect class="boxb" x="76" y="34" width="48" height="36" rx="6"/><rect class="boxd" x="132" y="34" width="48" height="36" rx="6"/>
  <text x="44" y="57" text-anchor="middle">ok</text><text x="100" y="57" text-anchor="middle">ok</text><text x="156" y="57" text-anchor="middle">down</text>
  <text x="20" y="92" class="sub">3 nodes tolerate 1 crash (p. 292)</text>
  <text x="330" y="22" font-weight="700">Byzantine-tolerant: more than 2/3 honest</text>
  <rect class="boxb" x="330" y="34" width="48" height="36" rx="6"/><rect class="boxb" x="386" y="34" width="48" height="36" rx="6"/><rect class="boxb" x="442" y="34" width="48" height="36" rx="6"/><rect class="boxe" x="498" y="34" width="48" height="36" rx="6"/>
  <text x="354" y="57" text-anchor="middle">ok</text><text x="410" y="57" text-anchor="middle">ok</text><text x="466" y="57" text-anchor="middle">ok</text><text x="522" y="57" text-anchor="middle">lies</text>
  <text x="330" y="92" class="sub">4 nodes tolerate 1 liar (p. 297)</text>
  <text x="20" y="130" class="sub">A crashed node is silent; a lying node actively sends misleading messages, so more honest nodes are needed to outvote it.</text>
</svg>
</div>
:::

:::details When BFT matters, and when it doesn't (pp. 296–298)
**Where Byzantine fault tolerance matters** (pp. 296–297):
- **Aerospace.** Radiation can corrupt memory or CPU registers, so a node responds in arbitrarily unpredictable ways. Failure is extremely expensive (an aircraft crash, a rocket colliding with the ISS), so flight control systems must tolerate Byzantine faults.
- **Multiple organizations.** Some participants may try to cheat or defraud others, so it isn't safe to trust another node's messages. Systems like the **Bitcoin blockchain** can be seen as a way for mutually untrusting parties to agree whether a transaction happened without a central authority.

**Why this book assumes no Byzantine faults** (p. 297):
- In your datacenter, all nodes are controlled by your organization, so they can hopefully be trusted, and radiation is low enough that memory corruption isn't a major problem.
- BFT protocols are quite complicated, and fault-tolerant embedded systems rely on hardware support. For most server-side data systems, BFT is impractically expensive.
- **Bugs:** a software bug could be seen as a Byzantine fault, but if every node runs the *same* software, a BFT algorithm can't save you. You'd need four *independent implementations* and hope a bug appears in only one.
- **Attackers:** if an attacker can compromise one node, they can probably compromise all of them, since they run the same software. Traditional mechanisms (**authentication, access control, encryption, firewalls**) remain the main protection.

**Weak forms of lying** (pp. 297–298). Assuming honest nodes doesn't mean being naive. Cheap protections against invalid messages from hardware issues, bugs and misconfiguration aren't full BFT and wouldn't stop a determined adversary, but they're simple, pragmatic steps toward reliability:
- **Corrupted packets.** TCP and UDP checksums usually catch them, but sometimes they evade detection. Add **checksums in the application-level protocol**.
- **Input sanitization.** A public application must check that values are within reasonable ranges and limit string sizes, to prevent denial of service through large memory allocations. Internal services can be less strict, but basic sanity checks (for example in protocol parsing) are a good idea.
- **NTP with multiple servers.** The client contacts all of them, estimates their errors, and checks that a majority agree on a time range. A misconfigured server is detected as an outlier and excluded, which is more robust than trusting one server.
:::

:::extra Beyond the 2016 text
**Not from the book.** Byzantine fault tolerant consensus has since become widespread in blockchain and permissioned-ledger systems (for example PBFT descendants such as Tendermint and HotStuff-style protocols). These still rely on the "more than two-thirds honest" bound. Within a single organization's datacenter, the book's judgment generally still holds: authentication, access control and end-to-end checksums are the practical defenses, not BFT.
:::

:::quiz
### mcq
What makes a fault "Byzantine"?
- [ ] The node crashes and never returns
- [ ] The node responds slowly
- [x] The node sends untrue, arbitrary or corrupted messages, e.g. claiming to have received a message it never got
- [ ] The network drops packets
>>>
The book's default assumption is unreliable but honest nodes. Byzantine nodes may "lie" (p. 295).

### mcq
Why can't a Byzantine fault tolerant algorithm protect you from a bug in your database software?
- [ ] BFT algorithms are too slow
- [x] If every node runs the same software, the bug affects all of them; tolerating it would need several independent implementations with the bug in at most a minority
- [ ] Bugs are always crash faults
- [ ] BFT only works on the internet
>>>
Most BFT algorithms need more than two-thirds of nodes to be correct, so you'd need, e.g., four independent implementations and hope only one has the bug (p. 297).

### mcq
Which situation is the strongest case for Byzantine fault tolerance?
- [ ] A company's internal analytics cluster
- [x] A flight control computer exposed to radiation, or a ledger shared by mutually untrusting organizations
- [ ] A cache in front of a web app
- [ ] A single-leader database in one datacenter
>>>
Aerospace and multi-party systems (e.g. Bitcoin) are the book's examples (pp. 296–297).

### tradeoff
An attacker compromises one node of your five-node database. Would a BFT protocol have helped?
- [ ] Yes, it tolerates any number of compromised nodes
- [x] Probably not: an attacker who can compromise one node can probably compromise all of them, since they run the same software; authentication, access control, encryption and firewalls remain the main protection
- [ ] Yes, because five nodes tolerate two liars
- [ ] No, because BFT needs exactly four nodes
>>>
The book argues that protecting against vulnerabilities via protocol design isn't realistic in most systems (p. 297).

### scenario
Your internal service occasionally stores garbled records. You suspect a flaky NIC or switch corrupting data that TCP's checksum misses. What does the book suggest, and why isn't this "Byzantine fault tolerance"?
>>>
Add checksums in the application-level protocol (and verify them on receipt and on storage), so corrupted messages are detected and rejected or retried (p. 297). TCP and UDP checksums usually catch corruption, but sometimes it evades them. This is a defense against a *weak form of lying*: accidental corruption from hardware or software. It's cheap and pragmatic, but it isn't BFT. A deliberate adversary could compute a valid checksum for a malicious message. Full BFT would need protocols that tolerate nodes actively trying to deceive, with more than two-thirds honest nodes.

### explain
Explain how NTP's use of multiple servers is a defense against a "lying" time source.
>>>
NTP clients can be configured with several server addresses. When synchronizing, the client contacts all of them, estimates each one's error, and checks that a majority agree on some time range. As long as most servers are OK, a misconfigured server reporting the wrong time shows up as an outlier and is excluded (p. 298). So one bad server can't drag the client's clock off. It's the same "truth by majority" idea as quorums, applied pragmatically.
:::

:::connect Where this goes next
Tomorrow: how to state precisely what you're assuming (system models) and what you're guaranteeing (safety and liveness properties). That's the vocabulary every algorithm in Chapter 9 is described in.
:::
