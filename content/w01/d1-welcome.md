---
title: Welcome — What Is a Data-Intensive Application?
kind: lesson
minutes: 80
chapter: 1
objectives:
- Explain the difference between data-intensive and compute-intensive applications
- Name the standard building blocks (database, cache, search index, stream processing, batch processing) and what each is for
- Describe how one application can combine several of them into a new "data system", and why that makes you a data system designer
- Know how this course works, so tomorrow you can just press Continue
reading:
- Chapter 1 opening and Thinking About Data Systems | 1-4
complete:
- You read pp. 1–4 (and skimmed About this Book)
- You can sketch Figure 1-1 from memory, roughly, and say what each box does
- You answered the questions at the end
---

:::note How this course works
Every day follows the same rhythm: **Learn → Visualize → Practice → Quiz → Complete**. Scroll down the page in order. The bar at the top shows where you are.

- **Read in the book** (the box above) lists the exact pages of your PDF. Click a page link to open the book at that page. A good rhythm: read the first section of the lesson (the problem), then the pages, then the rest of the lesson.
- **Quizzes** are for learning, not grading. Write your answer *before* revealing the model answer: the effort of remembering is what builds memory.
- Every question you answer comes back later in **Review**, timed for when you are about to forget it. Questions you miss come back sooner.
- **Day 6** of each week is a lighter review day. If you miss a day, nothing breaks — "Continue Learning" always opens the first day you haven't finished.

One important fact about your PDF: it is the **Sixth Early Release (July 2016)** of the book. It contains Chapters 1–11. The final printed edition adds a Chapter 12 ("The Future of Data Systems"); Week 22 covers its key ideas from outside sources and is clearly marked as not being from your PDF. Page numbers in this course are the ones printed in *your* PDF.

Before starting, skim the author's preface, [About this Book](pdfp:15) (PDF pages 15–19, numbered xiii–xvii). It explains who the book is for and why it focuses on principles rather than products.
:::

:::problem Why does this book exist?
Imagine you are building a photo-sharing app. At first, one database on one server is fine. Then:

- The home page gets slow, so someone adds a **cache**.
- Users want to search captions, so someone adds a **search index** (like Elasticsearch).
- Uploading a photo should send notifications, but the user shouldn't have to wait, so someone adds a **message queue** and a background worker.
- The business wants weekly reports over all the data, so someone adds a nightly **batch job**.

Now one user action — "change my display name" — must update the database, invalidate the cache, update the search index, and maybe notify followers. If any of those steps is forgotten or fails halfway, users see wrong data. Which part is the "truth"? What happens when a server dies in the middle?

This is the world the book is about. Most applications today are limited not by CPU speed but by **data**: how much of it there is, how complex it is, and how fast it changes. The book calls these **data-intensive** applications, as opposed to **compute-intensive** ones (like video encoding or scientific simulation) where raw CPU power is the bottleneck.
:::

:::intuition Building blocks, and gluing them together
You will rarely write a database from scratch. Instead you assemble standard building blocks, each excellent at one job:

| Building block | Job | Everyday analogy |
|---|---|---|
| Database | Store data so it can be found again later | A filing cabinet |
| Cache | Remember the result of an expensive operation to make reads fast | A sticky note with the answer you looked up yesterday |
| Search index | Find data by keyword or filter | The index at the back of a book |
| Stream processing | Send messages to be handled asynchronously, as they happen | An inbox someone works through |
| Batch processing | Periodically crunch a large pile of accumulated data | Doing the accounts at the end of the month |

The book makes two observations about these tools (p. 2):

1. **The categories are blurring.** Redis is a data store that is also used as a message queue; Kafka is a message queue with database-like durability. So it makes sense to think of them all as *data systems*.
2. **One tool is rarely enough.** Applications combine several, and *your application code* becomes the glue that keeps them consistent — for example, it is your code's job to invalidate the cache when the database changes.

When you put several tools behind one API, you have built a new, special-purpose data system. Clients only see your API; they don't care that there are five components behind it. But **you** now have to guarantee things like "the cache is never stale for long". In the book's words, you are now not only an application developer but also a *data system designer*.
:::

:::visual DataSystemFlow | One user request, five components
This is the book's Figure 1-1 made interactive. The primary database is the **source of truth**; the cache and the search index are copies derived from it. Follow a read and a write through the system.

**Try this:**
1. Click **Read user 42** twice. The first read misses the cache and goes to the database; the second is served from the cache.
2. Click **Change user 42's name**. Watch the write go to the database, the cache entry get invalidated, the search index get updated, and an email task go into the queue.
3. Now **untick** "app invalidates cache on write", change the name again, and read. The cache serves a **stale** value.
:::

:::details The three concerns of this book
Designing a data system raises hard questions (p. 3): How do you keep data correct and complete when something breaks inside? How do you keep performance good when parts of the system are degraded? How do you handle more load? What does a good API look like?

Many factors shape the answers — the team's skills, legacy systems, deadlines, risk tolerance, regulation. The book focuses on three concerns that matter in almost every system (p. 4):

- **Reliability** — the system keeps working *correctly* (right answers, acceptable speed) even when things go wrong: hardware faults, software bugs, human mistakes.
- **Scalability** — as data volume, traffic, or complexity grow, there are reasonable ways to deal with that growth.
- **Maintainability** — many different people will work on the system over the years (keeping it running and adapting it), and they should all be able to do so productively.

These words are often thrown around as buzzwords. The rest of Chapter 1 gives each one a precise meaning, and the rest of the book is about techniques that achieve them.

### A small prerequisite: why "where the data lives" matters

Many trade-offs in this book come down to the speed of different kinds of storage. Rough orders of magnitude (approximate, and improving over time) are worth memorising:

| Operation | Rough time |
|---|---|
| Read from main memory (RAM) | ~100 nanoseconds |
| Random read from an SSD | ~100 microseconds (about 1,000× slower than RAM) |
| Seek on a spinning hard disk | ~10 milliseconds (about 100× slower than an SSD) |
| Network round trip inside a datacenter | ~0.5 milliseconds |
| Network round trip across continents | ~150 milliseconds |

Two consequences to keep in mind all course long: memory is fast but small, and its contents are lost on power failure; disks are durable but much slower — especially for *random* access. And as soon as data lives on another machine, every access pays a network round trip, and that network can fail.
:::

:::quiz
### mcq
Which of these is the best example of a **data-intensive** application, in the book's sense?
- [ ] A program that computes 10 billion digits of π
- [x] A social network serving profiles, feeds and search to millions of users
- [ ] A video game rendering 3D graphics at 120 frames per second
- [ ] A program that trains one small machine-learning model on a laptop
>>>
The book calls an application data-intensive when the main challenge is the **amount, complexity, or rate of change of data** rather than CPU cycles. A social network is the classic example. Computing π or rendering graphics are compute-intensive: processor speed is the bottleneck.

### mcq
In the interactive diagram, which component is the **source of truth** that the others are derived from?
- [ ] The in-memory cache
- [ ] The full-text index
- [x] The primary database
- [ ] The message queue
>>>
Writes go to the primary database first; the cache and search index are *copies* derived from it, and can be rebuilt from it. This distinction — systems of record vs derived data — becomes the central theme of Part III (Chapters 10–11).

### predict
Your application uses a cache in front of the database. A developer adds a new "edit profile" endpoint that writes to the database but forgets to touch the cache. What will users most likely see?
- [ ] An error, because the cache detects that the database changed
- [x] Their old profile data for a while after saving, until the cached entry expires or is evicted
- [ ] Their new data immediately, because the database is always checked first
- [ ] Nothing changes, because the write is rejected
>>>
A cache does not magically know the database changed. Keeping derived data in sync is **the application's responsibility** in this architecture (p. 3). Users see stale data until something invalidates or overwrites the cache entry. You reproduced exactly this in the visualization.

### explain
In your own words: why does the book say that when you combine several tools behind one API, you become a **data system designer**?
>>>
Because the combined system offers guarantees of its own that no single tool provides — for example, "after you update your name, searches and cached pages show the new name". Clients only see your API, so *you* are responsible for those guarantees: deciding which component is the source of truth, how changes propagate to caches and indexes, and what happens when a component fails halfway. That is the job of designing a data system, not just using one.

### short
Name the three concerns the book focuses on, with a one-line definition of each.
>>>
**Reliability**: the system keeps working correctly (right function, acceptable performance) even when faults occur — hardware, software, or human. **Scalability**: as load grows (data, traffic, complexity) there are reasonable ways to cope with it. **Maintainability**: the many people who work on the system over time can do so productively — keep it running and adapt it to new needs.
:::

:::connect Where this goes next
Today's diagram is a map of the whole book. Chapters 2–4 look inside a *single* database (data models, storage engines, encoding). Part II (Chapters 5–9) asks what changes when data is spread over *many machines*. Part III (Chapters 10–11) returns to this exact picture — a source of truth plus derived caches and indexes — and shows principled ways to keep them in sync, instead of hoping the application code remembers.

Tomorrow: what "reliable" really means, and why a fault is not the same as a failure.
:::
