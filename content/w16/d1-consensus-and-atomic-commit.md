---
title: Consensus, the FLP Result and Atomic Commit
kind: lesson
minutes: 80
chapter: 9
objectives:
- Explain why consensus is subtle and give its two main uses (leader election, atomic commit)
- Explain what the FLP impossibility result says and why consensus is still solvable in practice
- Explain how single-node atomic commit works (data, then the commit record) and what decides it
- Explain why sending "commit" independently to several nodes violates atomicity, and why commits must be irrevocable
reading:
- Distributed transactions and consensus | 343-344
- The impossibility of consensus (FLP) | 344-344
- Atomic commit and two-phase commit; single-node to distributed | 344-346
complete:
- You can list three ways independent per-node commits can diverge
- You can explain FLP's restrictive assumptions in one sentence
- You answered the quiz
---

:::problem Agreeing is harder than it looks
Informally, consensus means getting **several nodes to agree on something**. That sounds easy, and "many broken systems have been built in the mistaken belief that this problem is easy" (p. 343). The topic comes this late in the book because appreciating its subtleties needs everything so far: replication, transactions, system models, linearizability and total order broadcast. Even researchers understood it only gradually, over decades.

Where agreement matters:
- **Leader election.** All nodes must agree which node is the leader. Network faults can make leadership contested. Without consensus, a bad failover produces **split brain**: two leaders accept writes, their data diverges, and the result is inconsistency and data loss.
- **Atomic commit.** A transaction spanning several nodes or partitions may fail on some and succeed on others. To keep ACID atomicity, all nodes must agree on the outcome: all commit or all abort. (Footnote xii: atomic commit is formalized slightly differently from consensus. It may commit only if *all* participants vote yes, while consensus may decide any proposed value. But the two are reducible to each other, and non-blocking atomic commit is *harder* than consensus.)

This section starts with **two-phase commit (2PC)**, the most common atomic-commit algorithm, "a kind of consensus algorithm, but not a very good one". From there it works toward better ones: Zab in ZooKeeper and Raft in etcd (pp. 343–344).
:::

:::intuition FLP, and why we can still agree
**The FLP result** (box, p. 344), named after Fischer, Lynch and Paterson, proves that **no algorithm reliably achieves consensus if there is a risk that a node may crash**. Nodes can always crash, so is consensus impossible?

FLP is proved in a **very restrictive model**: a deterministic algorithm that **can't use clocks or timeouts**, which is the asynchronous model of Chapter 8. If the algorithm may use **timeouts**, or any other way of suspecting nodes as crashed, even if the suspicion is sometimes wrong, consensus becomes solvable. Even allowing **random numbers** is enough. So FLP is of great theoretical importance, but distributed systems can usually achieve consensus in practice.

**Single-node atomic commit** (p. 345). The storage engine makes the transaction's writes durable, typically in a write-ahead log, and then **appends a commit record** to the log on disk. After a crash, recovery checks the log: commit record on disk means committed, and no commit record means the writes are rolled back. So commit depends on the **order of durable writes**: first the data, then the commit record. **The deciding moment is when the disk finishes writing the commit record.** Before it, the transaction can still abort (because of a crash). After it, it's committed even if the database crashes. A single device, one disk controller on one node, makes the commit atomic.
:::

:::details Why multi-node commit is different (pp. 345–346)
**When multiple nodes are involved**, for example a multi-object transaction in a partitioned database or a term-partitioned secondary index with the index entry on a different node from the primary data, you can't just send a commit request to every node and let each commit independently. It could easily succeed on some and fail on others:
- some nodes detect a **constraint violation or conflict** and must abort, while others commit;
- some commit requests are **lost in the network** and time out into an abort, while others get through;
- some nodes **crash before the commit record is written** and roll back on recovery, while others succeed.

Most "NoSQL" distributed datastores don't support such distributed transactions, but various clustered relational systems do.

If some nodes commit and others abort, the nodes become inconsistent, like Figure 7-3. And **once committed on one node, a transaction can't be retracted** if it later turns out it aborted elsewhere. Committed data becomes visible to other transactions, and clients may already rely on it. So **commits must be irrevocable**. You can't change your mind and retroactively abort, which is the basis of read committed isolation. A **compensating transaction** can undo the *effects* of a committed one later, but to the database it's a separate transaction, and any cross-transaction correctness is the application's problem (p. 346).

So a node may commit only when it's **certain all other nodes will commit too**. That's what 2PC is for.
:::

:::quiz
### mcq
What does the FLP result prove?
- [ ] Consensus is impossible in all real systems
- [x] No deterministic algorithm can reliably reach consensus if a node may crash, in an asynchronous model without clocks or timeouts
- [ ] Consensus needs a majority of nodes
- [ ] Two-phase commit is optimal
>>>
With timeouts (even unreliable ones) or randomness, consensus is solvable (p. 344).

### mcq
On a single node, what is the deciding moment for whether a transaction committed?
- [ ] When the client sends COMMIT
- [ ] When the data pages are written
- [x] When the disk finishes writing the commit record to the log
- [ ] When the response reaches the client
>>>
First the data, then the commit record. Before it the transaction may abort, and after it it's committed (p. 345).

### predict
A coordinator sends COMMIT independently to three partitions. One partition detects a constraint violation. What happens without an atomic commit protocol?
- [ ] All three abort automatically
- [x] Two partitions commit and one aborts, leaving the data inconsistent, and the committed parts can't be retracted
- [ ] The coordinator retries until all succeed
- [ ] All three commit anyway
>>>
Independent commits diverge, and commits must be irrevocable (pp. 345–346).

### mcq
Why must a committed transaction be irrevocable?
- [ ] Because logs are append-only
- [x] Because once committed its data is visible to other transactions and clients may rely on it, so retracting it would break them; undoing effects requires a separate compensating transaction
- [ ] Because disks can't delete data
- [ ] Because of two-phase locking
>>>
This is the basis of read committed isolation (p. 346).

### tradeoff
A NoSQL store doesn't support multi-partition transactions. What do you gain, and what do you give up?
- [x] Simplicity and performance (no coordination, no blocking), but no atomicity across partitions: a write touching two partitions, such as data plus a term-partitioned index entry, can be half-applied
- [ ] You gain atomicity and lose nothing
- [ ] You gain linearizability
- [ ] Nothing changes
>>>
Most NoSQL stores make this trade (p. 345). Chapter 11 and later discuss alternatives.

### explain
Explain why "consensus is impossible" (FLP) and "ZooKeeper reaches consensus every day" are both true.
>>>
FLP holds in a specific system model: fully asynchronous, deterministic, with no clocks or timeouts, so no way to suspect a crashed node. In that model, a crashed node and a very slow one are indistinguishable, and the algorithm can't safely decide. Real systems step outside the model. They use timeouts to suspect failures (accepting that suspicions are sometimes wrong), which makes the model partially synchronous, and that is enough to solve consensus. Randomized algorithms are another escape. Practical algorithms like Raft or Zab always keep safety, and they make progress whenever the network is behaved enough for timeouts to work (pp. 344, 356).
:::

:::connect Where this goes next
Tomorrow: two-phase commit in detail. Why splitting commit into prepare and commit makes atomicity possible, and what happens when the coordinator dies at the worst possible moment.
:::
