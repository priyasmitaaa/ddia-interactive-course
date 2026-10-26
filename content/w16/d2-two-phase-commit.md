---
title: Two-Phase Commit — Promises, Coordinator Failure and 3PC
kind: lesson
minutes: 95
chapter: 9
objectives:
- Describe 2PC's flow with a coordinator and participants (Figure 9-9)
- Explain the six steps and two points of no return that make 2PC atomic
- Explain the in-doubt state (Figure 9-10) and why participants can't resolve it on their own
- Explain how the coordinator recovers from its log, and why the commit point is a single-node commit
- Explain why three-phase commit isn't used in practice (perfect failure detectors)
reading:
- Introduction to two-phase commit | 346-347
- A system of promises | 347-348
- Coordinator failure | 348-349
- Three-phase commit | 350-350
complete:
- You stepped through all four crash points in the 2PC simulator, with participants waiting and aborting
- You can name 2PC's two points of no return
- You answered the quiz
---

:::problem How does "two phases" fix anything?
**Two-phase commit (2PC)** is an algorithm for atomic commit across multiple nodes: either all commit or all abort. It's a classic in distributed databases, used internally by some databases, and exposed to applications as **XA transactions** (supported by the Java Transaction API) or WS-AtomicTransaction for SOAP web services (p. 346).

(Box: **don't confuse 2PC and 2PL.** Two-phase commit gives atomic commit in a distributed database, and two-phase locking gives serializable isolation. Treat them as entirely separate concepts.)

A prepare request can be lost just as easily as a commit request. So why does splitting the commit into two phases make atomicity possible when a one-phase commit across nodes doesn't (p. 347)?
:::

:::intuition A system of promises
2PC adds a **coordinator** (transaction manager), often a library inside the application process (for example in a Java EE container), or a separate service such as Narayana, JOTM, BTM or MSDTC. The database nodes are **participants**. Figure 9-9: the application reads and writes on several participants as normal. When it's ready to commit, the coordinator runs **phase 1**, sending **prepare** to every participant to ask whether it can commit. If **all** say yes, **phase 2** sends **commit**. If **any** says no, it sends **abort** to all (pp. 346–347).

It's like a western wedding ceremony. The minister asks each partner "do you?", and only after both say "I do" pronounces them married. That's the commit, and the happy fact is broadcast to all attendees.

**The detailed steps** (pp. 347–348):
1. The application gets a **globally unique transaction ID** from the coordinator.
2. It starts a single-node transaction on each participant, tagged with that ID. If anything goes wrong at this stage (a crash, a timeout), the coordinator or any participant can abort.
3. Ready to commit, the coordinator sends **prepare** (tagged with the ID) to all. If any request fails or times out, it sends **abort** to all.
4. A participant receiving prepare makes sure it can **definitely commit in all circumstances**. It writes all transaction data to disk (a crash, power failure or full disk are not acceptable excuses later) and checks constraints and conflicts. Replying **"yes" is a promise** to commit if asked. **It gives up the right to abort, without actually committing.**
5. With all responses in, the coordinator decides: commit only if all voted yes. It **writes the decision to its transaction log on disk**. This is the **commit point**.
6. It sends the decision to all participants. If a request fails or times out, **it retries forever**. If a participant crashed meanwhile, it commits on recovery, because it voted yes and can't refuse.

**Two points of no return**: a participant's **yes** (it will definitely be able to commit, though the coordinator may still abort), and the **coordinator's decision** (final once written). Single-node commit lumps both into one event: writing the commit record. In wedding terms, if you faint after saying "I do" and miss the pronouncement, you're still married. When you come to, ask the minister about your global transaction ID, or wait for the minister's next retry.
:::

:::visual TwoPCSim | Crashing the coordinator
**Try this:**
1. **Never crash**, with DB 2 voting yes and then no. Step through both runs.
2. **Crash after deciding, mid phase 2** (Figure 9-10). DB 2 committed. DB 1 is **in doubt**: it holds its locks and can't do anything. Tick **coordinator recovers** and step to the end.
3. Same crash, but in-doubt participants **abort on timeout**. Atomicity breaks: one committed, one aborted.
4. **Crash after votes, before deciding.** What does recovery decide, and why?
:::

:::details Coordinator failure and three-phase commit (pp. 348–350)
**Participant or network failures** are handled. A failed or timed-out prepare leads to abort, and a failed commit or abort is retried indefinitely. **Coordinator failure** is the hard part.
- If the coordinator fails **before sending prepare**, a participant can safely abort.
- Once a participant has **voted yes**, it can't abort unilaterally. It must wait for the coordinator. If the coordinator crashes or the network fails, the participant can only wait. Its transaction is **in doubt**, or uncertain.

Figure 9-10: the coordinator decided to commit, and database 2 got the commit request, but the coordinator crashed before telling database 1. **A timeout doesn't help.** If database 1 aborts, it's inconsistent with database 2, which committed. Committing unilaterally is also unsafe, because another participant might have voted no. Participants *could* in principle ask each other how they voted, but that isn't part of 2PC.

**The only way 2PC can complete is by waiting for the coordinator to recover.** That's why the coordinator writes its decision to its log **before** sending it. On recovery, it reads the log to determine the status of in-doubt transactions, and those without a commit record are aborted. **The commit point of 2PC reduces to a regular single-node atomic commit on the coordinator** (p. 349).

**Three-phase commit** (p. 350). 2PC is a **blocking** atomic commit protocol: it can get stuck waiting for the coordinator. A **non-blocking** protocol is possible in theory, and **3PC** has been proposed. But standard 3PC **assumes bounded network delay and bounded response times**. With unbounded delays and pauses (Chapter 8) **it can't guarantee atomicity**. In general, non-blocking atomic commit needs a **perfect failure detector**, a reliable way to tell whether a node has crashed. A timeout isn't one, since a request can time out because of a network problem with no node crashed. So **2PC is still used**, despite its known blocking problem.
:::

:::quiz
### mcq
What does a participant promise when it votes "yes" to prepare?
- [ ] That it has committed the transaction
- [x] That it can definitely commit later in all circumstances: it has written the data durably and checked constraints, giving up the right to abort
- [ ] That it will abort if the coordinator is slow
- [ ] That no other transaction will read its data
>>>
It doesn't commit yet, but it can no longer refuse (p. 348).

### mcq
What is 2PC's commit point?
- [ ] When the last participant votes yes
- [x] When the coordinator writes its commit/abort decision to its log on disk
- [ ] When the first participant commits
- [ ] When the application calls commit
>>>
From then on, the decision must be enforced no matter how many retries it takes (p. 348).

### predict
The coordinator crashes after writing "commit" but before notifying DB 1, which voted yes. DB 1's timeout expires. What should DB 1 do?
- [ ] Abort, since it hasn't heard anything
- [ ] Commit, since it voted yes
- [x] Keep waiting (in doubt, holding its locks) until the coordinator recovers or tells it the outcome
- [ ] Ask the application
>>>
Aborting could contradict DB 2's commit, and committing could contradict an abort. Only the coordinator knows (p. 349).

### mcq
Why isn't three-phase commit used in practice?
- [ ] It's slower than 2PC
- [x] It assumes bounded network delay and response times; with unbounded delays and pauses it can't guarantee atomicity, because non-blocking atomic commit needs a perfect failure detector
- [ ] It has too many phases to implement
- [ ] It needs three coordinators
>>>
Timeouts aren't reliable failure detectors (p. 350).

### tradeoff
How is 2PC different from one-phase "send commit to everyone"?
- [x] 2PC first collects durable promises (yes votes) and makes a single, logged decision, so no node commits unless all can; one-phase lets each node decide independently, so outcomes can diverge
- [ ] 2PC uses fewer messages
- [ ] 2PC doesn't need a coordinator
- [ ] One-phase commit is atomic if the network is reliable
>>>
The promises and the single decision point make 2PC atomic (pp. 347–348).

### explain
Explain why, at bottom, the commit point of 2PC "reduces down to a regular single-node atomic commit on the coordinator".
>>>
After collecting votes, the coordinator decides and writes that decision to its own durable log before telling anyone. Whether the distributed transaction committed is then determined by one fact: is there a commit record for this transaction ID in the coordinator's log on disk? That's exactly how a single-node database decides commit, by whether the commit record reached the disk. If the coordinator crashes before the write, recovery finds no record and aborts. If it crashes after, recovery finds the record and keeps sending commit. Participants' yes votes only guarantee that they will be *able* to follow whatever that one disk write says (p. 349). It's also why the coordinator is a single point of failure.
:::

:::connect Where this goes next
Tomorrow: distributed transactions in practice. Database-internal vs heterogeneous transactions, exactly-once message processing, XA, and why in-doubt transactions holding locks can take down large parts of an application.
:::
