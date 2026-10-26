---
title: Review — Catch Up and Prepare for Part II
kind: review
minutes: 60
objectives:
- Clear the spaced-review queue
- Finish any open Project 1 milestones
- Preview the questions Part II answers
reading:
- Part II introduction (first page) | 141-142
complete:
- You did today's spaced review
- Project 1 tests M0–M3 pass (M4 optional)
- You read the first page of Part II and wrote down one question you hope it answers
---

:::review Today's spaced review
Questions from all of Part I. If many are due, do one round of 10 and come back to the rest tomorrow.
:::

:::task Catch-up checklist
1. Any unfinished Project 1 milestones? M0–M3 matter most; M4 is a stretch.
2. Any Part I exam questions you got wrong? Re-open their lessons (the Review page lists "struggling topics").
3. Read the first page of Part II (p. 141): *"For a successful technology, reality must take precedence over public relations, for nature cannot be fooled."* Write down: what reasons does it give for spreading a database across multiple machines? (You'll check your answer on Monday.)
:::

:::quiz Warm-up for Part II
### explain
Your Project 1 store runs on one machine. List three different things that would make you want to run it on several machines instead, and for each say what new problem it creates.
>>>
(1) **Scalability**: more data or load than one machine can handle → you must split data across machines and route requests (Chapter 6). (2) **Fault tolerance / high availability**: the service should survive a machine dying → keep copies on several machines, which must be kept in sync (Chapter 5). (3) **Latency**: users around the world → copies near users in several datacenters, with replication across slow, unreliable long-distance links. All of them introduce networks that can delay or lose messages, clocks that disagree, and partial failures (Chapter 8).

### mcq
Which Part I structure will reappear as the core mechanism for copying data between machines in Chapter 5?
- [ ] The data cube
- [x] The log (an append-only sequence of changes)
- [ ] The Bloom filter
- [ ] The star schema
>>>
Replication works by shipping a log of changes from one node to others — statement-based, WAL shipping, or logical logs.

### predict
You copy your store's segment files to a second machine every night as a backup. A disk dies at 6 pm. What is lost, and why is that not "replication" in the sense of Chapter 5?
- [ ] Nothing is lost
- [x] Everything written since last night's copy; replication keeps a copy up to date continuously as writes happen, not once a day
- [ ] Only the hint files
- [ ] Only deleted keys
>>>
A nightly backup bounds loss to a day. Replication continuously ships changes (synchronously or asynchronously) so a replica is seconds or less behind.
:::
