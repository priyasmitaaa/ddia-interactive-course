---
title: Distributed Transactions in Practice — XA, In-Doubt Locks and Their Limits
kind: lesson
minutes: 85
chapter: 9
objectives:
- Explain the mixed reputation of distributed transactions and where their performance cost comes from
- Distinguish database-internal from heterogeneous distributed transactions
- Explain exactly-once message processing via atomic commit, and its precondition
- Describe XA (an API, not a network protocol) and where its coordinator lives
- Explain why in-doubt transactions holding locks are so harmful, what orphaned transactions and heuristic decisions are, and XA's limitations
reading:
- Distributed transactions in practice | 350-351
- Exactly-once message processing | 351-351
- XA transactions | 352-352
- Holding locks while in doubt; recovering from coordinator failure | 352-353
- Limitations of distributed transactions | 354-354
complete:
- You can explain why an in-doubt transaction can make "large parts of your application" unavailable
- You can list four limitations of XA from memory
- You answered the quiz
---

:::problem Safety guarantee or operational nightmare?
Distributed transactions, especially 2PC, have a **mixed reputation**. They provide an important safety guarantee that would otherwise be hard to achieve. They're also criticized for causing operational problems, killing performance, and promising more than they can deliver. Many cloud services choose not to implement them (p. 350).

The performance cost is real. Distributed transactions in MySQL are reported to be **over 10 times slower** than single-node ones. Much of 2PC's inherent cost comes from the **extra disk forcing (fsync)** needed for crash recovery and the **extra network round trips**. Rather than dismiss them outright, the book examines them for the lessons they teach.
:::

:::intuition Two kinds of distributed transaction
Two quite different things get conflated (pp. 350–351):
- **Database-internal distributed transactions.** A distributed database (with replication and partitioning in its standard configuration) runs transactions among its own nodes. VoltDB, FoundationDB and MySQL Cluster's NDB storage engine do this. All participants run the same software, so the database can use any protocol and apply its own optimizations. These **often work quite well**.
- **Heterogeneous distributed transactions.** The participants are **different technologies**: two databases from different vendors, or even non-databases like **message brokers**. They must commit atomically even though they're entirely different under the hood. That's **a lot more challenging**.

**Exactly-once message processing** (p. 351) is the attractive use. A message from a queue is acknowledged as processed **if and only if** the database transaction that processes it commits. The message acknowledgment and the database writes are committed atomically in one distributed transaction. If either fails, both abort, and the broker can safely redeliver the message later. So, although the processing may take a few retries, the message is **effectively processed exactly once**.

The condition: **all systems affected must support the same atomic commit protocol**. If a side effect is sending an **email** and the email server doesn't do 2PC, a retried message can send the email twice. Only if all side effects roll back on abort can the processing step be retried as if nothing had happened. (More in Chapter 11.)
:::

:::visual TwoPCSim | Locks held while in doubt
Set the crash point to **after deciding, mid phase 2**, and leave the participants **waiting**. At the last step, note "Locks still held". In a real database those are row-level exclusive locks, or shared locks too under 2PL. Every other transaction that touches those rows blocks until the coordinator comes back. Now imagine the coordinator's log is lost.
:::

:::details XA, in-doubt locks and limitations (pp. 352–354)
**XA transactions.** X/Open XA (eXtended Architecture), from **1991**, is the standard for 2PC across heterogeneous technologies. It's supported by many relational databases (PostgreSQL, MySQL, DB2, SQL Server, Oracle) and message brokers (ActiveMQ, HornetQ, MSMQ, IBM MQ). **XA is not a network protocol. It's a C API** for talking to a transaction coordinator. In Java EE it's implemented via the **Java Transaction API (JTA)**, which is supported by JDBC drivers and JMS drivers. The driver calls XA to find out whether an operation belongs to a distributed transaction and exposes callbacks for prepare, commit and abort. The coordinator implements the XA API and is often **a library in the application process**, with its log on the **application server's local disk**. If the application process crashes or its machine dies, the coordinator goes with it. Participants with prepared transactions are stuck in doubt until the server restarts and the library reads its log. The database **can't contact the coordinator directly**. Everything goes through the client library (p. 352).

**Holding locks while in doubt** (pp. 352–353). Why not just ignore an in-doubt transaction and carry on? Because of **locks**. Transactions take row-level exclusive locks on rows they modify (to prevent dirty writes), and under 2PL shared locks on rows they read. They **can't be released until commit or abort**. So with 2PC, locks are held for as long as the transaction is in doubt. If the coordinator takes 20 minutes to restart, the locks are held for 20 minutes. If its log is lost, **forever**, until an administrator resolves it manually. Meanwhile no other transaction can write those rows, and depending on the database maybe not read them, which can make **large parts of your application unavailable**.

**Recovering from coordinator failure** (p. 353). In theory the coordinator recovers cleanly from its log. In practice **orphaned in-doubt transactions** occur, where the outcome can't be determined because the log was lost or corrupted by a software bug. They sit forever, holding locks. **Rebooting the database doesn't help**, because a correct 2PC must keep in-doubt locks across reboots. The only way out is for an administrator to inspect each participant, see if any has committed or aborted, and apply the same outcome to the others, probably under high stress during a serious production outage. Many XA implementations offer **heuristic decisions**: a participant unilaterally commits or aborts an in-doubt transaction. "Heuristic" is a euphemism for **probably breaking atomicity**, and it's meant only for catastrophes.

**Limitations of distributed transactions** (p. 354). The key realization: **the transaction coordinator is itself a kind of database**, storing transaction outcomes, and needs the same care.
- If it isn't replicated, it's a **single point of failure** for the whole system. Many coordinators aren't highly available by default, or have only rudimentary replication.
- Application servers favored by HTTP's **stateless** model become **stateful**: the coordinator's logs are part of the durable system state, as important as the databases.
- XA must work with many systems, so it's a **lowest common denominator**. It can't detect **deadlocks across systems** (that would need a standard way to exchange lock information) and doesn't work with **SSI** (that would need a cross-system conflict protocol).
- Even for database-internal transactions, which can do better (distributed SSI is possible), 2PC needs **all participants to respond**. If any part of the system is broken, the transaction fails. **Distributed transactions tend to amplify failures**, which runs counter to fault tolerance.

Alternatives that keep several systems consistent without heterogeneous distributed transactions come in Chapter 11 and later.
:::

:::quiz
### mcq
Where does much of 2PC's performance cost come from?
- [ ] Encryption
- [x] Extra disk forcing (fsync) for crash recovery, and extra network round trips
- [ ] Locking at the application server
- [ ] Larger message sizes
>>>
MySQL's distributed transactions are reported to be over 10× slower than single-node ones (p. 350).

### mcq
What is XA?
- [ ] A network protocol for 2PC
- [x] A C API for interfacing with a transaction coordinator, typically used from Java via JTA, with the coordinator often a library in the application process
- [ ] A replication protocol
- [ ] A consensus algorithm
>>>
It isn't a network protocol. The database talks to the coordinator only through its client library (p. 352).

### predict
An XA coordinator's log is lost in a disk failure, and several transactions were prepared on PostgreSQL. What happens to their locks if you reboot PostgreSQL?
- [ ] They're released by the reboot
- [x] They persist: correct 2PC keeps in-doubt locks across reboots; an administrator must decide, or use a heuristic decision that probably breaks atomicity
- [ ] PostgreSQL aborts them automatically
- [ ] PostgreSQL commits them automatically
>>>
These are orphaned in-doubt transactions (p. 353).

### mcq
What's the precondition for exactly-once message processing via distributed transactions?
- [ ] The message broker must be Kafka
- [x] Every system affected by processing the message must take part in the same atomic commit protocol, so all side effects roll back on abort
- [ ] Messages must be small
- [ ] The database must use snapshot isolation
>>>
An email server that doesn't support 2PC can still send the email twice (p. 351).

### tradeoff
Why do database-internal distributed transactions "often work quite well" while heterogeneous XA transactions are troublesome?
- [x] Internal transactions run the same software everywhere and can use specialized protocols and optimizations (even distributed SSI); XA is a lowest common denominator across vendors, can't detect cross-system deadlocks or support SSI, and its coordinator often lives in the app server
- [ ] Internal transactions don't use 2PC
- [ ] XA is newer
- [ ] Heterogeneous transactions are always faster
>>>
Both still suffer from 2PC amplifying failures (pp. 350–351, 354).

### explain
"The transaction coordinator is itself a kind of database." Explain what this means and two operational consequences.
>>>
The coordinator durably stores the authoritative outcome (commit or abort) of every distributed transaction in its log, and participants depend on it to resolve in-doubt transactions. That makes it a database in all but name (p. 354). Consequences: (1) if it isn't replicated and highly available, it's a single point of failure. Its outage leaves participants in doubt, holding locks and blocking other transactions across the application. (2) When it's embedded in application servers, those servers stop being stateless. Their local logs must be backed up and preserved like database files, and a server can't simply be thrown away and replaced, because the logs are needed to recover in-doubt transactions after a crash.
:::

:::connect Where this goes next
2PC's core weakness is that it waits for one coordinator and needs every participant. Tomorrow: fault-tolerant consensus, where a majority suffices, and epoch numbers keep stale leaders from causing damage.
:::
