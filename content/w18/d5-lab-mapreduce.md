---
title: Lab — Build a Tiny MapReduce Engine
kind: lab
minutes: 110
chapter: 10
objectives:
- Implement map tasks that partition by a stable hash and write sorted partition files
- Implement reduce tasks that merge sorted inputs and group by key
- Implement task attempts that commit only on success
- Use the engine for chained jobs and a reduce-side join with a secondary sort
reading:
- Re-read distributed execution of MapReduce | 388-390
- Re-read sort-merge joins | 393-394
complete:
- All tests T1–T5 pass
- You can explain why stable_hash exists
- You answered the quiz
---

:::note Today is a building day
Four functions, about 60 lines. File layout, the job driver and the chained "top URLs" job are given. Budget about 100 minutes. If a test fails, compare with the MapReduce and Join visualizations, which compute the same things in the browser.
:::

:::intuition The files your engine writes
<div class="figure">
<svg class="dg" viewBox="0 0 660 170" role="img" aria-label="Map tasks write per-reducer sorted files; reduce tasks merge them and commit output">
  <rect class="boxa" x="10" y="20" width="120" height="40" rx="6"/><text x="70" y="45" text-anchor="middle">split 0 → map-0</text>
  <rect class="boxa" x="10" y="100" width="120" height="40" rx="6"/><text x="70" y="125" text-anchor="middle">split 1 → map-1</text>
  <g class="sub">
  <rect class="box" x="180" y="10" width="110" height="24" rx="4"/><text x="235" y="27" text-anchor="middle">m0-r0.jsonl</text>
  <rect class="box" x="180" y="44" width="110" height="24" rx="4"/><text x="235" y="61" text-anchor="middle">m0-r1.jsonl</text>
  <rect class="box" x="180" y="92" width="110" height="24" rx="4"/><text x="235" y="109" text-anchor="middle">m1-r0.jsonl</text>
  <rect class="box" x="180" y="126" width="110" height="24" rx="4"/><text x="235" y="143" text-anchor="middle">m1-r1.jsonl</text>
  </g>
  <rect class="boxb" x="360" y="20" width="140" height="40" rx="6"/><text x="430" y="45" text-anchor="middle">reduce-0 (merge)</text>
  <rect class="boxb" x="360" y="100" width="140" height="40" rx="6"/><text x="430" y="125" text-anchor="middle">reduce-1 (merge)</text>
  <rect class="boxe" x="540" y="20" width="110" height="40" rx="6"/><text x="595" y="45" text-anchor="middle">part-0.jsonl</text>
  <rect class="boxe" x="540" y="100" width="110" height="40" rx="6"/><text x="595" y="125" text-anchor="middle">part-1.jsonl</text>
  <path class="ln" d="M130 40 L180 22 M130 40 L180 56 M130 120 L180 104 M130 120 L180 138 M290 22 L360 40 M290 104 L360 40 M290 56 L360 120 M290 138 L360 120 M500 40 L540 40 M500 120 L540 120"/>
</svg>
</div>

Every file is first written as `….attempt1` (then `attempt2` if that failed), and renamed to its real name only when the whole task attempt succeeded. That's the commit.
:::

:::practice 37-mapreduce | Build it
TODOs 1–4. Read `Job.run` first, so you know how your functions are called.
:::

:::quiz
### mcq
Why must partitioning use `stable_hash` instead of Python's `hash()`?
- [ ] For speed
- [x] Python randomizes string hashing per process, so different tasks (processes) could send the same key to different reducers, splitting a group
- [ ] Because hash() returns negative numbers
- [ ] Because JSON keys are lists
>>>
All mappers must agree on where each key goes. In a real cluster they run in different processes on different machines.

### predict
A reduce task crashes after writing half its output, and the retry succeeds. What does `part-r.jsonl` contain?
- [ ] Both attempts' output (duplicates)
- [ ] Only the first half
- [x] Exactly the output of the successful attempt; the failed attempt's file was deleted and never renamed into place
- [ ] Nothing
>>>
That's the all-or-nothing output contract that makes retries safe (pp. 400, 418).

### mcq
Why does the reduce side merge the mapper files rather than load and sort everything?
- [ ] Merging is the only operation Python supports
- [x] Each file is already sorted, so a streaming k-way merge produces sorted input in one sequential pass with memory proportional to the number of files, not the data
- [ ] Sorting would lose values
- [ ] Merging removes duplicates
>>>
The shuffle's sorted runs make reducers cheap (p. 390).

### explain
How does your join make sure each reduce call sees the user record before the events, without the reducer ever buffering events?
>>>
The mapper emits composite keys: `[user_id, 0]` for the user record and `[user_id, 1, ts]` for each event. Records are partitioned and grouped by `user_id` only (`group_key = k[0]`), so all records for a user reach one reduce call. They're sorted by the full composite key, so within the group `[id, 0]` sorts before every `[id, 1, ts]`, and events come in timestamp order. The reducer reads the first value (the date of birth), then streams the remaining values, emitting `[url, age]` for each. That's the secondary sort from p. 394. If the first value isn't a user record, the user doesn't exist and the group is skipped (inner join).
:::
