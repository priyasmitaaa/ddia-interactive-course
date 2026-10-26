---
title: Linearizability vs Serializability, and When You Need It
kind: lesson
minutes: 85
chapter: 9
objectives:
- Distinguish linearizability (a recency guarantee on single objects) from serializability (an isolation property of transactions)
- Define strict serializability and say which serializability implementations are linearizable
- Explain why locks and leader election must be linearizable, and the role of ZooKeeper and etcd
- Explain why uniqueness constraints need linearizability, and when compensating actions are acceptable instead
- Recognize cross-channel timing dependencies such as Figure 9-5
reading:
- Linearizability vs serializability | 319-320
- Relying on linearizability; locking and leader election | 320-321
- Constraints and uniqueness guarantees | 321-322
- Cross-channel timing dependencies | 322-323
complete:
- You can explain why SSI is serializable but not linearizable
- You identified the two channels in Figure 9-5 and one alternative to linearizable storage
- You answered the quiz
---

:::problem Two words that both sound like "in some order"
**Linearizability** and **serializability** both seem to mean "can be arranged in a sequential order", but they're quite different guarantees (box, pp. 319–320). Confusing them leads to wrong assumptions about what a database protects you from. And once they're clear, there's a practical question: when does an application actually *need* linearizability, rather than just finding it nice to have?
:::

:::intuition Two different guarantees, and three places linearizability is essential
**Serializability** is an **isolation property of transactions**, which may read and write *multiple* objects. Transactions behave as if they had executed in *some* serial order, and that order may differ from the order in which they actually ran.

**Linearizability** is a **recency guarantee on reads and writes of a register** (a single object). It doesn't group operations into transactions, so it **doesn't prevent write skew** unless you add measures such as materializing conflicts.

A database can provide both: **strict serializability**, or strong one-copy serializability (strong-1SR). Serializability via **2PL** or **actual serial execution** is typically linearizable. **SSI is not linearizable**: by design it reads from a consistent snapshot, and the whole point of a snapshot is that it excludes writes more recent than the snapshot (p. 320).

**When linearizability is required** (pp. 320–323). Sports scores that are a few seconds stale do no real harm. These cases are different:

1. **Locking and leader election.** Single-leader replication must make sure there's really only one leader. A common method is a lock that every node tries to acquire at startup, and the winner leads. However it's implemented, the lock **must be linearizable**, or nodes won't agree who holds it. **ZooKeeper** and **etcd** are often used for this. They implement linearizable operations fault-tolerantly using consensus. Subtleties remain (fencing, Chapter 8), and libraries like **Apache Curator** provide higher-level recipes. Finer-grained: **Oracle RAC** takes a linearizable lock per disk page, and because those locks are on the transaction's critical path, deployments use a dedicated cluster interconnect network. (Footnote iii: ZooKeeper and etcd *writes* are linearizable, but reads may be stale by default. etcd offers a *quorum read*, and ZooKeeper needs `sync()` before the read.)
2. **Constraints and uniqueness guarantees.** Unique usernames or emails, one file per path, a balance that never goes negative, not selling more stock than you have, not double-booking a seat. Enforcing these *as data is written* requires a single up-to-date value that all nodes agree on, so you need linearizability. Registering a username is really acquiring a "lock" on it.
3. **Cross-channel timing dependencies.** Bob only noticed the stale result because of an **extra channel**: Alice's voice. Computer systems have such channels too (Figure 9-5).
:::

:::visual LinearizabilityViz | Figure 9-4: compare-and-set and the shaded read
@props {"initial":"fig94"}
**Try this:** with B's final read at 2, the checker finds no valid order and highlights the problem read. Set it to 4 and read the order the checker found. Notice that D's write is placed before A's, though A's request was sent later. Then set C's middle read to 1. Why does that break it?
:::

:::details Uniqueness without linearizability, and Figure 9-5 (pp. 321–323)
**Can you get away without it?** Sometimes. A uniqueness constraint can be relaxed if the business can live with *fixing mistakes afterwards*:
- Two people register the same username or book the same seat: email one of them an apology and ask them to choose again. That's a **compensating transaction**.
- Customers order more than you have in stock: order more stock, apologize for the delay, offer a discount. You need that process anyway for when a forklift truck runs over items in the warehouse, so a linearizable stock constraint may be unnecessary.
- Someone withdraws more than their balance: charge an overdraft fee ("and laugh all the way to the bank"). A daily withdrawal limit bounds the bank's risk.

Other constraints, such as foreign keys or attribute constraints, can be implemented **without** linearizability (p. 321).

**Figure 9-5: two channels.** Users upload photos. The web server (1) receives the image, (2) stores the full-size image in file storage, and (3) sends a message to a queue. The queue (4) delivers it to the image resizer, which (5) fetches the full-size image and (6) stores the thumbnail. The queue carries only a small instruction, because most message brokers are designed for small messages and a photo may be several megabytes.

If the file storage is linearizable, this works. If it's not, the **message queue may be faster than the storage's internal replication**. The resizer then fetches an old version of the image, or nothing. If it resizes an old version, the full-size image and the thumbnail become **permanently inconsistent**.

The problem exists because there are two communication channels between the web server and the resizer: the storage and the queue. Without the recency guarantee, races between them are possible. Linearizability isn't the only fix, but it's the simplest to understand. If you control the extra channel, as you do the queue (unlike Alice's voice), you can use read-your-writes-style techniques, for example passing a version identifier in the message, at the cost of extra complexity (pp. 322–323).
:::

:::quiz
### mcq
Which statement is correct?
- [ ] Linearizability prevents write skew
- [x] Serializability is about transactions over multiple objects behaving as if executed in some serial order; linearizability is a recency guarantee on single-object reads and writes
- [ ] They are synonyms
- [ ] Serializability guarantees that reads return the most recent write
>>>
That's the box on pp. 319–320. Combining both gives strict serializability.

### mcq
Why is serializable snapshot isolation (SSI) not linearizable?
- [ ] Because it uses locks
- [ ] Because it aborts transactions
- [x] Because reads come from a consistent snapshot, which by design excludes writes more recent than the snapshot
- [ ] Because it's only used in PostgreSQL
>>>
A read-only transaction in SSI may deliberately see an older state than a write that has already completed (p. 320).

### mcq
Why must a lock used for leader election be linearizable?
- [ ] For performance
- [x] Because all nodes must agree which node owns the lock; otherwise two nodes could both believe they're leader
- [ ] Because ZooKeeper requires it
- [ ] Because leaders write to the lock frequently
>>>
A lock that different nodes see differently is useless (p. 320).

### predict
In Figure 9-5, file storage is an eventually consistent object store with asynchronous replication. What can go wrong?
- [ ] The message is delivered twice
- [x] The resizer receives the message before the new image has replicated, so it resizes an old image or finds nothing, leaving the thumbnail permanently inconsistent with the full-size image
- [ ] The upload fails
- [ ] Nothing, since the queue guarantees ordering
>>>
The queue and the storage are two channels, and without linearizable storage the queue can win the race (p. 322).

### tradeoff
An online shop wants to guarantee it never sells more units than are in stock. What does the book suggest considering before requiring linearizability?
- [x] Whether an apology/compensation workflow (order more stock, apologize, offer a discount) is acceptable, since the business already needs one for real-world losses like damaged stock
- [ ] Always use linearizability for money
- [ ] Use LWW for stock counts
- [ ] Use eventual consistency and ignore oversells
>>>
Compensating transactions can replace a strict constraint when mistakes are rare and fixable (p. 321).

### scenario
A video platform stores uploaded files in a replicated blob store, then publishes a "transcode this file" event to Kafka. Transcoders occasionally fail with "file not found". Explain the cause and give two fixes.
>>>
It's a cross-channel race (Figure 9-5): the event travels through Kafka faster than the blob store replicates the new file to the replica the transcoder reads from (p. 322). Fixes: (1) make the blob read linearizable or read-your-writes, for example by reading from the primary or using a strongly consistent read option. (2) Since we control the extra channel, put a version or etag (or the upload's write position) in the event and have the transcoder wait or retry until the store has at least that version. (3) Make the transcoder treat "not found" as retryable with backoff. That works but only masks the race, and it can still process a stale version if a file is overwritten.
:::

:::connect Where this goes next
Tomorrow: how to *build* a linearizable system. Which of Chapter 5's replication methods can be linearizable, and why strict Dynamo-style quorums are not enough on their own.
:::
