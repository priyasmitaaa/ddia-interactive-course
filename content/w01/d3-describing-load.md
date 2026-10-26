---
title: Scalability — Describing Load (the Twitter Example)
kind: lesson
minutes: 90
chapter: 1
objectives:
- Explain why "X is scalable" is a meaningless statement, and what the real question is
- Define load parameters and choose sensible ones for a system
- Compare Twitter's two timeline approaches (query on read vs fan-out on write) and the hybrid
- Explain why the follower distribution, not the tweet rate, is Twitter's key load parameter
reading:
- Scalability and Describing load | 8-11
complete:
- You can draw Twitter's two approaches and say where the work happens in each
- You implemented fan-out on write and the hybrid in the exercise
- You answered the quiz
---

:::problem "Will it scale?" is the wrong question
A system that works today may not work next year. Perhaps it grows from 10,000 concurrent users to 100,000, or from 1 million to 10 million. Perhaps it stores ten times more data.

People often say things like "MongoDB scales" or "SQL doesn't scale". The book calls this meaningless (p. 9). Scalability isn't a label you can stick on a system. The useful question is: **if the system grows in a particular way, what are our options for coping?** And to ask that, you must first describe the current load *precisely*.
:::

:::intuition Load parameters
**Load parameters** are a few numbers that summarise how hard your system is being worked. Which numbers depend on your architecture (p. 9):

- requests per second to a web server,
- the ratio of reads to writes in a database,
- the number of simultaneously active users in a chat room,
- the hit rate on a cache,
- …or whatever your bottleneck actually is.

Sometimes the average case matters; sometimes the bottleneck is dominated by a few extreme cases. Twitter is a beautiful example of the second kind.

**Fan-out** is a term borrowed from electronics: the number of requests to other services (or writes to other places) needed to serve one incoming request.
:::

:::details Twitter's home timeline (Nov 2012 data)
Two main operations (p. 9):

- **Post tweet**: 4.6k requests/sec on average, over 12k/sec at peak.
- **Home timeline** (see tweets from people you follow): 300k requests/sec.

12k writes per second is easy. The challenge is fan-out: each user follows many people, and is followed by many people. Two approaches:

**Approach 1 — query on read.** Posting inserts the tweet into one global table. Reading a home timeline looks up everyone the user follows, fetches their recent tweets, and merges them by time. In SQL:

```sql
SELECT tweets.*, users.* FROM tweets
  JOIN users   ON tweets.sender_id    = users.id
  JOIN follows ON follows.followee_id = users.id
  WHERE follows.follower_id = current_user
```

**Approach 2 — fan-out on write.** Keep a cache (a "mailbox") of each user's home timeline. When someone posts, look up all their followers and insert the tweet into each follower's cache. Reading a timeline is then cheap: the answer was computed ahead of time.

Twitter's first version used approach 1, but struggled with the load of timeline queries, so it switched to approach 2. That works better because tweets are posted almost **two orders of magnitude** less often than timelines are read — so it's better to do more work at write time and less at read time.

The cost moves to writes: a tweet goes to about **75 followers on average**, so 4.6k tweets/sec become **345k writes/sec** to timeline caches. But the average hides the real problem — some users have **over 30 million followers**, so one tweet can require 30 million writes, and Twitter tries to deliver within 5 seconds.

Hence the **hybrid** (p. 11): most users' tweets are fanned out on write, but celebrities with huge follower counts are exempt. Their tweets are fetched at read time and merged in, as in approach 1.

So Twitter's key load parameter is **the distribution of followers per user** (perhaps weighted by how often each user tweets), because it determines the fan-out load.
:::

:::visual FanoutSim | Move the work from reads to writes and back
Five ordinary users and one ★ celebrity who everyone follows.

**Try this:**
1. In **Query on read**, post a few tweets, then read a timeline: note how many followees get looked up.
2. Switch to **Fan-out on write**, post the same tweets: watch them land in followers' mailboxes. Reads are now one lookup. Now post as ★: one tweet = 31 million writes.
3. Switch to **Hybrid** and post as ★ again: no fan-out; the ★ tweet is merged in at read time.
4. In the calculator below, compare total work per second for both approaches with Twitter's real numbers, then change the read/write ratio and see when approach 1 would be the better choice.
:::

:::practice 02-timeline-fanout | Measure it on a 20,000-user graph
You'll implement fan-out on write and the hybrid, and measure write ops, read ops and the worst single post on a graph with a realistic, very skewed follower distribution.
:::

:::quiz
### mcq
Why does the book say "X is scalable" is not a meaningful statement?
- [ ] Because no system can scale forever
- [x] Because scalability depends on *how* load grows and what options you have for coping with that particular growth
- [ ] Because scalability can only be measured on a distributed system
- [ ] Because only databases can be scalable, not applications
>>>
Scalability is about the question "if load grows in this particular way, how do we cope?" A system may handle 10× more reads easily but collapse under 10× more writes, or larger data per request. A one-word label hides all of that.

### mcq
Twitter switched from approach 1 (query on read) to approach 2 (fan-out on write) mainly because:
- [ ] Approach 2 uses less total storage
- [x] Timeline reads are far more frequent than tweet posts, so precomputing timelines at write time saves total work
- [ ] Approach 1 could not return tweets in time order
- [ ] Celebrities complained about slow posting
>>>
300k reads/sec vs 4.6k writes/sec — almost 100× more reads. Doing extra work on each write (inserting into followers' caches) so that each read is cheap is a good trade when reads dominate. It does use *more* storage (each tweet is copied into many caches).

### predict
Under pure fan-out on write, a user with 30 million followers posts one tweet. Using Twitter's numbers, how many cache writes does that single tweet cause, compared with the average tweet?
- [ ] About the same as an average tweet (~75 writes)
- [ ] About 4,600 writes
- [x] About 30 million writes — roughly 400,000 times the average tweet
- [ ] Zero, because celebrities' tweets are never cached
>>>
Under pure approach 2, every follower's cache gets the tweet. 30,000,000 / 75 ≈ 400,000× the average. That skew is why the *distribution* of followers is the key load parameter, and why Twitter moved to a hybrid that exempts celebrities from fan-out.

### tradeoff
You run a messaging app where each "channel" has on average 8 members, messages are posted 50k/sec and channels are opened 60k/sec. Which approach fits better, and why?
- [x] Either is plausible; reads and writes are similar in rate and fan-out is small, so you'd need to measure — there's no 100× asymmetry like Twitter's
- [ ] Always fan-out on write, because that is what Twitter does
- [ ] Always query on read, because it uses less storage
- [ ] Neither; this workload cannot be scaled
>>>
Twitter's choice followed from *its* load parameters: reads ≫ writes, and a skewed follower distribution. Here reads and writes are similar and the fan-out is tiny (8), so the trade-off is close and depends on other factors (latency targets, storage cost, max channel size). The lesson is to reason from your own load parameters, not to copy someone else's architecture.

### explain
Explain, as if to a friend, what Twitter's hybrid approach does and why it is better than either pure approach.
>>>
For most users, when they tweet, the tweet is pushed into the timeline cache of each follower, so reading a timeline is a cheap lookup. But for a few celebrities with millions of followers, pushing would mean millions of writes per tweet, which is too slow and expensive. So celebrity tweets are stored once and, when you open your timeline, the system fetches the latest tweets of the celebrities you follow and merges them with your precomputed cache. You get cheap reads for the common case without the extreme write spikes.

### short
Name three possible load parameters for an online shop's backend and say what each would tell you.
>>>
Examples: **requests per second** to the product page (overall traffic); **read/write ratio** of the inventory database (how much caching helps vs how much write contention there is); **peak concurrent checkouts** (contention on stock levels); **cache hit rate** (how much load reaches the database); **items per order** or **products per category page** (fan-out per request). Any sensible parameter that describes how hard a part of the system is worked, and could grow, is a good answer.
:::

:::connect Where this goes next
Fan-out on write is your first example of **precomputing derived data** — the timeline cache is a materialized view of the tweets table. That idea comes back in Chapter 3 (materialized views and data cubes), Chapter 10 (batch jobs that build derived datasets), and Chapter 11 (stream processors that keep caches up to date). The book even asks later (p. 20) how you'd "refactor" Twitter from approach 1 to 2 without downtime — Chapter 11's answer will be "derive the new view from a log of events". Tomorrow: once you know the load, how do you describe *performance*?
:::
