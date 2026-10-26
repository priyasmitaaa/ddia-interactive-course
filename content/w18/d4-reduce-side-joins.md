---
title: Reduce-Side Joins, Grouping and Skew
kind: lesson
minutes: 95
chapter: 10
objectives:
- Explain what a join means in batch processing, and why per-record remote lookups are a bad idea
- Walk through a reduce-side sort-merge join with a secondary sort (Figures 10-2 and 10-3)
- Explain "bringing related data together in the same place" and how it separates communication from logic
- Apply the same pattern to GROUP BY and sessionization
- Explain skew from linchpin objects, and the skew-join and two-stage grouping fixes
reading:
- Reduce-side joins and grouping | 391-392
- Example: analysis of user activity events | 392-393
- Sort-merge joins | 393-394
- Bringing related data together in the same place; GROUP BY | 394-395
- Handling skew | 395-396
complete:
- In the Join visualization, you traced one user through the sort-merge join and fixed the celebrity skew
- You can explain why the reducer never makes a network request
- You answered the quiz
---

:::problem Join a clickstream with a user database, for all users at once
Records often refer to other records: a foreign key, a document reference, a graph edge. A join is needed whenever code must see both sides of the association. Denormalization reduces joins but generally doesn't remove them (Chapter 2). A database with a few records to look up uses **indexes**, but **MapReduce has no indexes** in the usual sense. A job reads **all** of its input files: a full table scan. For a few records, that's outrageously expensive. For **analytics over many records**, scanning everything in parallel can be quite reasonable (p. 391). In batch processing, a join means **resolving all occurrences of an association in a dataset**: processing all users at once, not looking up one user (p. 392). (Footnote v: these are generally **equi-joins**.)

**Figure 10-2**: a log of **user activity events** (clickstream: user 105 clicked…, user 296 viewed…) and a **users database** (user_id, email, date_of_birth). It's a star schema, where events are the fact table and users a dimension. To find which pages are popular with which age groups, the events, which hold only the user ID, must be joined with the profiles.
:::

:::intuition Don't query the database per record. Bring the data together
**The naive way** (pp. 392–393): for each event, query the user database on a remote server. Throughput is limited by round-trip time, a local cache depends heavily on the data distribution, many parallel queries could overwhelm the database, and because the remote data might change mid-job, **the job becomes non-deterministic**.

**The batch way**: put a copy of the users database (for example extracted from a backup by ETL) in the same distributed filesystem, and let MapReduce bring the relevant records together.

**Sort-merge join** (Figure 10-3, pp. 393–394): one set of mappers reads events and emits `(user_id → event)`. Another reads users and emits `(user_id → date_of_birth)`. Partitioning and sorting by key make each user's record and that user's events **adjacent in the reducer's input**. With a **secondary sort**, the reducer always sees the **user record first**, followed by the events in timestamp order. The reduce function is called once per user ID. It keeps the date of birth in a local variable and iterates over the events, emitting `(viewed_url, viewer_age)`. Later jobs can compute age distributions per URL. The reducer holds one user record in memory at a time and **never makes a network request**.

**"Bringing related data together in the same place"** (p. 394). Think of mappers as **sending messages** to reducers. The key is the **destination address**, and everything with the same key is delivered to the same reduce call. That **separates physical network communication from application logic**, unlike typical database use, where fetches happen deep inside application code. Since MapReduce handles all network communication, it also **shields application code from partial failures**: failed tasks are transparently retried.
:::

:::visual JoinViz | Sort-merge join, and a celebrity
@props {"initialTab":"sortmerge"}
**Try this:**
1. **Sort-merge**: reducer 1 gets even user IDs, reducer 2 odd. In each, find a ▶ user record followed by that user's events, and check the output ages.
2. **Skew**: user 105 is a celebrity with many events. One reducer's bar is much longer than the other, and the whole job waits for it.
3. Tick **skew join**: the celebrity's events are spread over both reducers, and its user record is sent to both. The bars even out, and the output is the same.
:::

:::details GROUP BY, sessionization and skew (pp. 394–396)
**GROUP BY.** The same pattern implements grouping (SQL's GROUP BY) and aggregation within groups: COUNT(*), SUM(field), top-k by a ranking function. Configure the mappers to emit the grouping key, and partitioning plus sorting bring each group together in one reducer. In MapReduce, grouping and joining look very similar.

**Sessionization** collects all the activity events for one user session to find the sequence of actions the user took, for example for **A/B testing** (did users shown the new design buy more?) or to judge whether a marketing activity is worthwhile. With many web servers, a user's events are scattered across log files. Group by session cookie or user ID to bring them together, while different users' events go to different partitions.

**Handling skew** (pp. 395–396). "Bringing all records with the same key to the same place" breaks down when one key has a huge amount of data. Most users have a few hundred connections, but **celebrities** may have millions of followers. Such disproportionately active records are **linchpin objects**. Collecting everything about a celebrity in one reducer causes **skew**: one reducer has far more work than the others (Chapter 6's hot spots). A job completes only when all its tasks complete, so **downstream jobs wait for the slowest reducer**.

Fixes:
- **Skew join** (Pig, Hive) or **sharded join** (Crunch): for the skewed input, send records for a linchpin key to a **random** reducer. For the *other* join input, send the records for that key to **all** reducers. Each reducer then gets some of the skewed records plus the record they join with. The cost is replicating the other side.
- **Grouping by a skewed key: two stages.** Stage 1 sends records to random reducers, each of which aggregates its subset into a compact per-key value. Stage 2 combines those partial aggregates into one value per key.
:::

:::quiz
### mcq
Why is querying a remote user database for each activity event a bad idea in a batch job?
- [ ] The database has no indexes
- [x] Throughput is limited by network round trips, parallel queries can overwhelm the database, and the job becomes non-deterministic because the remote data may change
- [ ] It requires a secondary sort
- [ ] It's impossible in MapReduce
>>>
Make the computation local instead: copy the users table into HDFS and join there (pp. 392–393).

### mcq
What does a secondary sort achieve in the sort-merge join?
- [ ] It sorts the output by age
- [x] Within each user's group, the user's own record comes first, followed by the events in timestamp order, so the reducer can remember the date of birth and stream the events
- [ ] It removes duplicate events
- [ ] It distributes skewed keys
>>>
The reducer then needs only one user record in memory at a time (pp. 393–394).

### predict
A user record has no matching events, and an event refers to a user ID missing from the users table. In a straightforward sort-merge inner join, what appears in the output?
- [ ] Both, with nulls
- [x] Neither: the reduce call for each key finds no partner, so nothing is emitted
- [ ] Only the event
- [ ] The job fails
>>>
Each reduce call sees all records for its key. With one side missing, an inner join emits nothing (an outer join would emit with nulls).

### mcq
In what sense do mappers "send messages" to reducers?
- [ ] They open network sockets directly
- [x] The key acts like a destination address: all pairs with the same key are delivered to the same reduce call, and the framework handles the actual network communication
- [ ] They write to a message queue
- [ ] They call the reducer function directly
>>>
This separates communication from application logic, and shields it from partial failures (p. 394).

### tradeoff
What does a skew join cost in exchange for balancing a celebrity's load?
- [x] The other join input's records for the linchpin key must be replicated to all reducers
- [ ] The output becomes incorrect
- [ ] It needs a second cluster
- [ ] Events lose their order
>>>
The burden of the linchpin is shared, at the cost of replication (p. 396).

### scenario
A nightly job computes, per hashtag, the number of posts and the top 10 posters. One hashtag (#worldcup) has 1,000× more posts than any other, and the job's runtime has doubled. Explain and fix.
>>>
It's skew on a linchpin key (pp. 395–396). Grouping by hashtag sends every #worldcup post to one reducer, which takes far longer than the others, and the job (and everything downstream) waits for it. Fix with two-stage grouping. Stage 1 sends records to random reducers, or appends a random suffix to the hot key, and each computes partial results per hashtag: a count, and the top 10 posters with their counts within that subset. Stage 2 groups by hashtag again and combines the partials: sum the counts, and merge the partial top-10 lists (summing counts for the same poster) into the final top 10. Both aggregates combine correctly from partial results, so the load is spread out.
:::

:::connect Where this goes next
Tomorrow's lab: build a small MapReduce engine with sorted partition files, a merge-based reduce side and retryable tasks, then implement this lesson's sort-merge join with a secondary sort on it.
:::
