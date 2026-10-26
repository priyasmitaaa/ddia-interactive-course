---
title: Windows and Stream Joins
kind: lesson
minutes: 100
chapter: 11
objectives:
- Define tumbling, hopping, sliding and session windows, and how to implement each
- Explain stream-stream (window) joins with the search/click example, and why state is required
- Explain stream-table joins (enrichment) and how CDC keeps the local table copy fresh
- Explain table-table joins as materialized view maintenance (Twitter timelines), and the product-rule analogy
- Explain the time-dependence of joins and why ordering across streams makes joins non-deterministic
reading:
- Types of window | 456-456
- Stream joins; stream-stream join | 457-457
- Stream-table join | 457-458
- Table-table join | 458-459
- Time-dependence of joins | 459-460
complete:
- You compared all four window types in the visualization
- Exercise 43 (windows and joins) is done
- You answered the quiz
---

:::problem Joins on data that never stops arriving
Batch jobs join datasets by key, and joins are an important part of pipelines. Stream processing generalizes pipelines to incremental processing of unbounded data, so it needs **exactly the same joins**. But new events can appear at any time, which makes stream joins harder. The book distinguishes **stream-stream**, **stream-table** and **table-table** joins (p. 457). First, though, the windows that bound so much of streaming.
:::

:::intuition Four windows, three joins
**Types of window** (p. 456):
- **Tumbling**: fixed length, and every event belongs to **exactly one** window. A 1-minute tumbling window groups 10:03:00–10:03:59, then 10:04:00–10:04:59, and so on. You can implement it by rounding each timestamp down to the minute.
- **Hopping**: fixed length, but windows **overlap** for smoothing. A 5-minute window with a 1-minute hop covers 10:03:00–10:07:59, then 10:04:00–10:08:59, and so on. Implement it by computing 1-minute tumbling windows and aggregating over several adjacent ones.
- **Sliding**: all events that occur **within some interval of each other**. A 5-minute sliding window covers events at 10:03:39 and 10:08:12, because they're less than 5 minutes apart, although tumbling or hopping windows with fixed boundaries would separate them. Implement it with a buffer of events sorted by time, expiring old ones.
- **Session**: **no fixed duration**. It groups a user's events that occur closely together and ends after a period of inactivity, say 30 minutes. Sessionization is common in web analytics (Chapter 10's GROUP BY).

**Stream-stream join (window join)** (p. 457). To compute **click-through rates** for search results, log an event for every search (query plus results) and every click, and bring together searches and clicks with the same **session ID**. The click may never come if the user abandons the search. If it comes, the delay varies from seconds to days, for example a forgotten tab. With network delays, **the click may even arrive before the search**. Choose a window, say join a click with a search if they occur at most an hour apart. Embedding the search details in the click event **isn't equivalent**: it only covers searches that got a click, and click-through rate needs the searches without clicks too. **Implementation**: the processor keeps **state**, for example all events of the last hour **indexed by session ID**. Every search or click is added to its index and **checks the other index** for a matching event.

**Stream-table join (stream enrichment)** (pp. 457–458). This is Figure 10-2 as a stream. Activity events containing a user ID are enriched with profile information. Querying a remote database per event is slow and risks overloading it. Instead, **load a copy of the database into the processor** so lookups are local, as in a hash join (Chapter 10): an in-memory hash table if it's small enough, or an index on local disk. The difference from batch is that a batch job uses a **point-in-time snapshot**, while a long-running processor's table **changes**, so the local copy must be kept up to date. That's solved with **CDC**: the processor subscribes to the profiles database's changelog as well as the activity stream, and updates its copy when a profile changes.

**Table-table join (materialized view maintenance)** (pp. 458–459). Twitter's home-timeline cache (Chapter 1) is a per-user "inbox" written as tweets are sent:
- when user *u* tweets, add the tweet to the timeline of every follower of *u*;
- when a tweet is deleted, remove it from all timelines;
- when *u1* follows *u2*, add *u2*'s recent tweets to *u1*'s timeline;
- when *u1* unfollows *u2*, remove *u2*'s tweets from it.

The processor consumes streams of tweet events (send/delete) and follow events (follow/unfollow), and keeps a database of each user's followers. It's maintaining a **materialized view** of a query joining two tables:

```sql
SELECT follows.follower_id AS timeline_id,
       array_agg(tweets.* ORDER BY tweets.timestamp DESC)
FROM tweets JOIN follows ON follows.followee_id = tweets.sender_id
GROUP BY follows.follower_id
```

The timelines are a cache of this query's result, updated whenever the underlying tables change. (Footnote ii: if a stream is the derivative of a table and a join is a product u·v, the stream of changes to the join follows the **product rule**: (u·v)' = u'v + uv'. When tweets change, join them with the current follows, and when follows change, join them with the current tweets.)
:::

:::visual StreamTimeViz | Window types
@props {"initialTab":"windows"}
**Try this:** the same 12 events under each window type. **Tumbling**: every event exactly once. **Hopping**: every event twice, since windows overlap. **Sliding**: one window ending at each event. **Session**: four bursts of activity, split by gaps longer than 5.
:::

:::details Time-dependence of joins (pp. 459–460)
All three joins have something in common: the processor **keeps state built from one join input** (searches and clicks, user profiles, follower lists) and **queries it with messages from the other input**. So **the order of the events that maintain the state matters**. Following then unfollowing is different from unfollowing then following. In a partitioned log, order is preserved **within a partition**, but there's typically **no ordering guarantee across different streams or partitions**.

So if events on different streams happen around the same time, in which order are they processed? In the stream-table join, if a user updates their profile, which activity events join with the **old** profile (processed before the update) and which with the **new** one? Put differently: **if state changes over time and you join with some state, what point in time do you use for the join?**

If the ordering of events across streams is undetermined, **the join becomes non-deterministic**. You can't rerun the same job on the same input and necessarily get the same result, because the input streams may interleave differently. A processor can **log the interleaving** of messages, but that alone isn't enough when recovering from faults, which is the next lesson. (One common remedy, used in Exercise 43, is to version the table and join each event with the version **valid at the event's timestamp**. Warehouses call this a slowly changing dimension. That idea isn't spelled out in this edition's text.)
:::

:::practice 43-windows-joins | Event time, windows and joins
Watermarked tumbling windows with dropped stragglers or corrections, sessionization, a search-click join that works in either arrival order, and an as-of stream-table join, all checked against batch answers.
:::

:::quiz
### mcq
Which window type assigns every event to exactly one window?
- [x] Tumbling
- [ ] Hopping
- [ ] Sliding
- [ ] All of them
>>>
Hopping windows overlap, sliding windows are defined relative to events, and sessions vary in length (p. 456).

### mcq
Why does a search-click stream join need to keep state for *both* streams?
- [ ] To compute averages
- [x] Because a click can arrive before its search (network delays), so whichever event arrives first must be remembered until its partner arrives or the window expires
- [ ] Because Kafka requires it
- [ ] It only needs to keep searches
>>>
Each event is added to its own index and checks the other (p. 457).

### predict
A stream-table join enriches orders with the customer's country. A customer moves from DE to FR at 10:00, and an order placed at 09:58 is processed at 10:02, after the profile update was applied. Which country does a naive join attach?
- [ ] DE, because the order was placed before the move
- [x] FR, because a naive join uses whatever version of the table is loaded when the order is processed, so the result depends on processing order
- [ ] Both
- [ ] Neither
>>>
"If state changes over time, and you join with some state, what point in time do you use for the join?" (p. 459).

### mcq
How does a stream-table join keep its local copy of the table current?
- [ ] By querying the database for every event
- [x] By subscribing to the table's change stream (CDC) and applying changes to the local copy
- [ ] By reloading a snapshot nightly
- [ ] It doesn't need to
>>>
The processor subscribes to the database's changelog and keeps its local copy current, instead of using a stale point-in-time snapshot (p. 458).

### tradeoff
Why is "embed the search details in the click event" not a substitute for a stream-stream join?
- [x] It only captures searches that received a click; computing click-through rates needs searches without clicks too
- [ ] It makes events too large
- [ ] Click events can't carry data
- [ ] It's slower
>>>
Joining needs both streams, because searches that got no click are exactly what the click-through rate must count (p. 457).

### explain
Explain why maintaining Twitter home timelines is a "table-table join", and what the stream processor must store.
>>>
A timeline is the result of joining tweets with follows: for each follower, all tweets by the people they follow, ordered by time. That's the SQL query on p. 459, with the timelines being a materialized cache of its result. Both inputs are streams of changes to tables: tweets (send/delete) and follows (follow/unfollow). So the processor applies each change to the join result. A new tweet is joined with the current follows (add it to every follower's timeline), and a new follow is joined with the current tweets (add the followee's recent tweets to the follower's timeline). That's the product-rule footnote: (u·v)' = u'v + uv'. To do this it must store the current follower set for each user, and the relevant recent tweets per user for follow events (pp. 458–459). The order of events matters (follow then unfollow is different from the reverse), which leads to the time-dependence problem.
:::

:::connect Where this goes next
Tomorrow: fault tolerance. How a job that never ends can still give results "as if every event were processed exactly once": microbatches, checkpoints, atomic commit and idempotence.
:::
