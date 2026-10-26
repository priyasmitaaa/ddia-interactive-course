---
title: Final Review — Keeping It, and What Next
kind: review
minutes: 60
objectives:
- Do the last scheduled review of the course
- Set up a sustainable long-term review habit
- Choose next steps for further learning
complete:
- You did today's spaced review
- You exported a progress backup (Progress page)
- You wrote your personal "next three things to learn" list
---

:::review Today's spaced review
Scheduled questions from the whole course. The Review page keeps scheduling questions after the course ends. A few minutes a day keeps the book in your long-term memory.
:::

:::task Make it stick, and keep going
1. **Back up your progress**: Progress page → *Download backup*. Keep the file safe. You can import it on any device.
2. **Keep reviewing**: open the Review page a few times a week. Intervals grow (1 → 4 → 10 → 25 → 60 → 150 days), so it takes only minutes. Questions you miss come back sooner.
3. **Choose three next steps.** For example:
   - Read the published edition's final chapter (Week 22 summarized it), and the second edition when it's available.
   - Read one classic paper with the Week 17 method: Raft, Lamport 1978, Dynamo, Spanner, MapReduce, Kafka.
   - Read a few Jepsen analyses of databases you use.
   - Extend MiniKV: real sockets between nodes, Raft for elections and commit, Bloom filters, range partitioning.
   - Rebuild one exercise in another language.
4. **Teach it.** Explain one concept (fencing tokens, write skew, event time) to a colleague. Teaching is the best test of understanding.
:::

:::quiz Last words
### mcq
Which question should you ask first about any data system you're asked to design or use?
- [ ] Which database is most popular?
- [x] Which exact guarantees does each part of the system need, and what happens under each kind of fault?
- [ ] Is it NoSQL?
- [ ] Is it written in Rust?
>>>
The book's lasting lesson: name the guarantee precisely, and reason about failures explicitly.

### mcq
Why keep reviewing after the course ends?
- [ ] The book changes
- [x] Spaced retrieval practice moves knowledge into long-term memory; without it, most detail fades within months
- [ ] To unlock badges
- [ ] Because the exam is repeated
>>>
That's why the course schedules reviews at growing intervals instead of relying on one pass.

### explain
Write the three things you'll learn next and why each one builds on this course.
>>>
A personal answer. Good examples: "Raft in depth, because I implemented elections in Lab 35 and MiniKV but not log commitment"; "stream processing with Flink, because Chapter 11 gave me the concepts of event time, watermarks and exactly-once and I want to apply them"; "the published edition's final chapter, to deepen Week 22's unbundling and correctness ideas". Each step should name a concrete resource and connect to a specific chapter or exercise.
:::
