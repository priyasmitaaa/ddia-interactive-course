---
title: Truth Is Defined by the Majority — Leaders, Locks and Fencing Tokens
kind: lesson
minutes: 90
chapter: 8
objectives:
- Explain why a node cannot trust its own judgment of whether it is alive or the leader
- Explain why decisions, including declaring a node dead, are made by a majority quorum, and why a majority is safe
- Describe the data-corruption bug in Figure 8-4 and why a client checking its own lease isn't enough
- Explain how fencing tokens (Figure 8-5) prevent it, and why the resource itself must check them
reading:
- Knowledge, truth and lies | 291-292
- The truth is defined by the majority | 292-293
- The leader and the lock | 293-294
- Fencing tokens | 294-295
complete:
- In the lease simulator, you saw storage reject token 33 with fencing on, and found a case where a late write is still accepted (and why that's fine)
- You can explain why the resource, not the client, must check the token
- You answered the quiz
---

:::problem A node can't know anything for sure
So far: no shared memory, only messages over an unreliable network with variable delays, plus partial failures, unreliable clocks and pauses. The consequences are "profoundly disorienting" (p. 291). A node can only *guess* about the world from the messages it receives, or doesn't receive. It can learn another node's state only by exchanging messages, and if the other node doesn't respond, problems in the network can't be told apart from problems at the node.

That sounds philosophical: what do we know to be true, and how sure can we be when perception is unreliable? Fortunately, we don't need to work out the meaning of life. We can **state our assumptions** as a **system model** and design systems that work within it, and algorithms can be **proved** correct within a model. Reliable behavior is achievable even when the underlying model guarantees very little. It just isn't easy (pp. 291–292).
:::

:::intuition Three nightmares, one moral
**Three scenarios** (p. 292):
1. **Asymmetric fault.** A node receives everything, but its outgoing messages are dropped. It's working perfectly, yet others hear nothing, time out and declare it dead. It's "dragged to the graveyard, kicking and screaming 'I'm not dead!'", but nobody hears.
2. **It notices.** The semi-disconnected node sees its messages aren't acknowledged and realizes the network is faulty. It's still declared dead, and it can't do anything about it.
3. **GC pause.** All threads stop for a minute. Others declare the node dead and "load it onto the hearse". Then GC finishes and the node carries on cheerfully, without realizing a minute passed or that it was declared dead.

**The moral: a node cannot necessarily trust its own judgment of a situation.** A system also can't rely exclusively on one node, which might fail at any time and leave the system stuck. So many distributed algorithms rely on a **quorum**: a decision by a **majority** of nodes, such as 2 of 3 or 3 of 5 (as in Chapter 5's quorums). That includes declaring nodes dead. If a majority says a node is dead, it **is** dead, even if it feels very much alive. The node must abide by the decision and **step down**.

**Why a majority?** It tolerates failures (3 nodes tolerate 1, 5 tolerate 2), and it is **safe**: there can only be **one majority** at a time, so two majorities can't make conflicting decisions. More on this in Chapter 9's consensus algorithms (pp. 292–293).

**The leader and the lock** (p. 293). Systems often need **exactly one** of something:
- one leader per partition, to avoid split brain;
- one holder of a lock on a resource, to avoid corrupting concurrent writes;
- one user with a given username.

A node may *believe* it is "the chosen one" (leader, lock holder, winner of the username) while the majority has already declared it dead and chosen someone else. If it keeps acting in its self-appointed role and other nodes believe its messages, the system as a whole can do something wrong.
:::

:::visual LeaseFencingSim | Fencing tokens
@props {"fencing":true}
**Try this:**
1. **Book scenario** (15 s pause) with **Storage trusts clients**: client 1's late write with token 33 lands after client 2's token-34 write, and the file is corrupted (Figure 8-4).
2. Switch to **Storage checks fencing tokens**: the token-33 write is rejected (Figure 8-5).
3. Set the pause to **13 s**. Client 1's write now arrives at t = 31, *after* its lease expired but *before* client 2's first write. With fencing it's **accepted**. Is that a problem? (Hint: what order does storage see the tokens in?)
4. Set the pause to 0 and the clock offset to −15 s. Does fencing also protect against the clock-skew flaw?
:::

:::details Figure 8-4, fencing tokens and ZooKeeper (pp. 293–295)
**The bug** (Figure 8-4). This isn't theoretical: HBase used to have it. You want a file in a storage service to be written by only one client at a time, so clients must get a **lease** from a lock service first:
1. Client 1 gets the lease.
2. A **stop-the-world GC pause** begins, and the lease expires during it.
3. Client 2 gets the lease and writes to the file.
4. Client 1 wakes up, *believes* it still has a valid lease, and writes too.

The writes clash and **corrupt the file**. It's exactly the process-pause problem from last week.

**Fencing** (Figure 8-5). We must make sure a node under a false belief of being the chosen one can't disrupt the rest of the system:
- Every time the lock server grants a lock or lease, it returns a **fencing token**: a number that **increases every time a lock is granted**.
- Every write to the storage service must **include the client's current token**.

In the figure, client 1 gets token **33** and pauses, and its lease expires. Client 2 gets **34** and writes with 34. Client 1 wakes and writes with 33, and storage **rejects** it because it has already processed a write with a higher token (pp. 294–295).

**With ZooKeeper** as the lock service, use the transaction ID **zxid** or the node version **cversion** as the fencing token. Both are guaranteed to be monotonically increasing (p. 295).

**The resource must check.** Fencing requires the resource itself to take an active role: check tokens and reject any write where the token has gone backwards. Relying on clients to check their own lock status isn't enough. A paused client can't know it was paused. For resources that don't support fencing tokens you might work around it, for example by putting the token in the filename, but **some** check is needed to avoid processing requests outside the lock's protection. Server-side checking is arguably good anyway: a service shouldn't assume clients are always well behaved, since clients are often run by people with very different priorities, so services should protect themselves from accidentally abusive clients (p. 295).
:::

:::quiz
### mcq
A node is receiving all messages, but its outgoing messages are dropped. What happens, according to the book?
- [ ] It's considered alive because it receives messages
- [x] Other nodes time out and declare it dead, even though it's working; it can't do anything about it
- [ ] It automatically becomes leader
- [ ] The network repairs the fault
>>>
This asymmetric fault is the first of the book's three nightmare scenarios (p. 292).

### mcq
Why is it safe to let a majority of nodes make decisions like "node X is dead"?
- [ ] Because a majority is always right
- [x] Because there can be only one majority at a time, so two groups can't make conflicting decisions; and it still works when a minority of nodes have failed
- [ ] Because majorities are faster to reach
- [ ] Because the minority nodes are always faulty
>>>
With a fixed number of nodes, any two majorities overlap, so there can't be two conflicting majorities (pp. 292–293).

### predict
In Figure 8-5, client 1 (token 33) writes after client 2 (token 34) has written. What does storage do?
- [ ] Accepts both writes
- [x] Rejects client 1's write, because it has already processed a write with a higher token
- [ ] Rejects client 2's write
- [ ] Asks the lock service who's right
>>>
Storage only needs to remember the highest token it has seen (pp. 294–295).

### mcq
Why isn't it enough for each client to check that its lease is still valid before writing?
- [ ] Because clients don't know the lease duration
- [ ] Because checking is too slow
- [x] Because a client can be paused right after checking and write after the lease expired, without ever knowing; only the resource can reliably reject writes outside the lock's protection
- [ ] Because the lock service doesn't report expiry
>>>
The check and the use are separated by an unbounded possible pause, so the resource itself must check tokens (pp. 293, 295).

### tradeoff
You use an object store that can't check fencing tokens. What can you do?
- [x] Encode the token in the object name (or use a conditional write on a version/token field) so a stale writer can't silently overwrite newer data; some check is necessary
- [ ] Nothing; fencing is impossible
- [ ] Use longer leases, which solves the problem
- [ ] Rely on clients to check their leases more often
>>>
The book suggests including the token in the filename for file storage (p. 295). Longer leases only make the problem rarer.

### explain
In the simulator with a 13 s pause, client 1's write arrives after its lease has expired but before client 2's first write, and storage with fencing accepts it. Is that a correctness violation? Explain.
>>>
Not for what fencing promises. Storage sees writes in increasing token order: 33 first, then 34. Client 2's writes come after client 1's and supersede them, exactly as if client 1 had written slightly earlier while it still held the lease. Fencing doesn't guarantee that a stale holder never writes. It guarantees that once the resource has processed a write from a newer holder (a higher token), no older holder's write is accepted. That prevents the interleaving that corrupted the file in Figure 8-4. If the application needs "no write at all after expiry", the resource would have to know the lease expiry itself, which brings clocks back in.
:::

:::connect Where this goes next
Fencing tokens assume a node that is wrong *by accident*. A node that wanted to cheat could simply send a fake token. Tomorrow: Byzantine faults, nodes that lie, and why most data systems assume they don't exist.
:::
