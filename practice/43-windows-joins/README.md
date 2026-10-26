---
title: Event time, windows and stream joins
chapter: 11
topic: Event time vs arrival order, watermarks, stragglers, session windows, stream-stream and stream-table joins
minutes: 55
---

## Objective

Process an **out-of-order** event stream the way a stream processor must, and check every result
against the batch answer computed from complete, sorted data. Count per-minute windows by **event
time**, emitting each window when a **watermark** says it's complete. Then deal with **stragglers**
by dropping and counting them or by publishing **corrections** (p. 455). Build **session windows** (p. 456), a
**stream-stream join** of searches and clicks within one hour that works whichever event arrives first
(p. 457), and a **stream-table join** against a changing table, made deterministic by joining with the
version valid at the event's time (p. 459).

## Setup

Python 3.10+, standard library only. Files: `practice/43-windows-joins/streamops.py` (TODOs 1–4) and
`test_streamops.py`. The data: 3,000 page views over about 50 minutes with up to 5 s of delay, and 1% of them
delayed by 2–15 minutes, like phones that were offline. The **Event time** visualization this week shows the
same ideas on a chart.

## Predict first

1. With a 5-second lateness allowance, roughly how many events will be dropped? With 30 seconds? With 1,000?
2. Can a click be processed before its search? What must the join do then?
3. A user's country changes at 10:00. An event from 09:59 arrives at 10:05. Which country should it be joined with?

## Your task

1. **TODO 1** `tumbling_counts` → T1.
2. **TODO 2** `sessionize` → T2.
3. **TODO 3** `search_click_join` → T3.
4. **TODO 4** `enrich_as_of` → T4.

## Run it

```
python practice/43-windows-joins/test_streamops.py
python practice/43-windows-joins/streamops.py
```

## Observe

- A short lateness allowance gives fast results but drops the offline-phone events, and about half of the
  minute windows end up wrong. With 30 seconds it's no better here, because the stragglers are minutes late. With 1,000 seconds it's exact,
  but you wait over 16 minutes for each window. **You can never be sure a window is complete** (p. 454). You
  choose between latency and completeness, or you publish corrections.
- Corrections make the final counts exact, at the cost of consumers handling updated values.
- The join must keep **both** sides in state. Some clicks really do arrive before their search because of network delays (p. 457).
- Joining by arrival order gives about one event in five a different country than the as-of join. Run it with a different
  interleaving and the arrival-order answer changes, while the as-of answer doesn't. "If state changes over time, and you join with
  some state, what point in time do you use for the join?" (p. 459).

## Questions

1. Why does using processing time for windows create artifacts (Figure 11-7), and why does event time make
   reprocessing deterministic (p. 453)?
2. A mobile app buffers events while offline. Which timestamps should it record, and why (p. 455)?
3. Why isn't "put the search details into the click event" a substitute for the stream-stream join (p. 457)?
4. Your as-of join needs every historical version of each profile. How would you bound that state?

<details><summary>Discussion</summary>

1. If the processor pauses or restarts, its backlog is processed in a burst, so processing-time windows show a dip
   and then a spike that never happened. Event-time windows depend only on the data, so rerunning the same input gives
   the same result, as in batch jobs (pp. 453–454).
2. Three timestamps: when the event occurred and when it was sent, both by the device clock, and when the server
   received it, by the server clock. The difference between "sent" and "received" estimates the device clock's offset,
   which corrects the occurrence time, assuming network delay is small and the offset didn't change in between (p. 455).
3. Clicks only tell you about searches that got a click. Click-through rate needs the searches *without* clicks too, so
   you need both streams (p. 457).
4. Keep versions only as far back as the maximum lateness you accept (older events are dropped anyway), or
   materialize the dimension into a store keyed by (user, valid_from) and expire old versions. This is the "slowly changing
   dimension" idea from data warehouses (outside the book's text).
</details>
