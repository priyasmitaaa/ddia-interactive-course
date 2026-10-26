---
title: Doing the Right Thing — Data, People and Responsibility
kind: supplement
minutes: 60
objectives:
- Explain how predictive analytics and automated decisions can harm people, including feedback loops and bias
- Explain privacy and tracking, consent, and data as a liability as well as an asset
- Connect these responsibilities to technical choices from the course (retention, deletion, derived data, auditing)
complete:
- You wrote a short data-ethics review of a system you know
- You answered the quiz
---

:::note Supplementary material
The published edition ends with a discussion of ethics. It isn't in your PDF. What follows is our own summary of commonly discussed themes, without page references. Use it as a starting point for your own reflection, not as legal advice.
:::

:::problem Every dataset is about someone
Most of this course is about machines: disks, networks, clocks, consensus. But much of the data in these systems describes **people**: what they clicked, bought, searched for, where they went, who they know. The systems you've learned to build decide who gets a loan, which job ads someone sees, which posts they read, and whether a card transaction is blocked. Engineers who build them share responsibility for their effects.
:::

:::intuition Three areas of concern
- **Predictive analytics and automated decisions.** Models trained on historical data can **encode existing biases** and apply them at scale. An algorithm can't be held accountable the way a person can, and people affected by an automated decision often can't see or contest the reasons. **Feedback loops** amplify harm: someone denied credit because of a model's prediction may end up in exactly the situation the model predicted.
- **Privacy and tracking.** Many business models depend on collecting behavioral data. Users often can't meaningfully consent, because they don't know what's collected, how it's combined, or what is derived from it. Derived data (Part III) is powerful here: combining datasets can reveal far more than any single one, including information people never chose to share.
- **Data as a liability.** Data you store can **leak**, be subpoenaed, be misused by a future owner of the company, or be repurposed in ways nobody intended. Collecting "everything, forever" is a technical convenience (Chapter 11's immutable logs) and also a long-term risk.
:::

:::extra Technical choices that matter
These tie back to the course:
- **Retention and deletion.** Decide retention periods per dataset. Design for deletion from the start: keep personal data separable from event logs, plan how excision works in derived views and backups, and remember that deletion is "making it harder to retrieve", not magic (Chapter 11).
- **Purpose limitation in derived data.** Every new view or model derived from personal data is a new use. Document *why* each derived dataset exists, who consumes it, and when it can be deleted. Lineage, meaning knowing what's derived from what, is exactly the clarity Part III argues for.
- **Minimization.** Collect and keep less. Aggregate early, for example store counts rather than raw events where that's enough, and use approximate or privacy-preserving techniques when exact individual records aren't needed.
- **Auditability.** Immutable logs and deterministic derivations make it possible to answer "why did the system decide this?" and to reproduce a decision later. That's useful for debugging and essential for accountability.
- **Security fundamentals.** Authentication, access control, encryption and least privilege remain the main protections (Chapter 8's discussion of Byzantine faults versus attackers).
:::

:::details A one-page ethics review template
For a system you work on, write one line each:
1. What personal data does it collect, and what is derived from it?
2. Who could be harmed if the data leaked, or if a decision based on it were wrong? How would they find out, and could they contest it?
3. Which derived datasets or models exist, and what is each one's purpose?
4. How long is each kept? What happens on account deletion, including in logs, caches, indexes, warehouses and backups?
5. Which decisions are automated, and where is a human in the loop?
6. What would you be uncomfortable explaining to the people the data describes?
:::

:::quiz
### mcq
Why can automated decisions based on historical data be harmful even if the model is accurate on average?
- [ ] Models are always inaccurate
- [x] They can encode and scale existing biases, they're hard for affected people to understand or contest, and they can create feedback loops that reinforce their own predictions
- [ ] Because machines can't store data
- [ ] Because of clock skew
>>>
Accuracy on average says nothing about fairness to individuals, or about accountability.

### mcq
Why is derived data a particular privacy concern?
- [ ] It's always encrypted
- [x] Combining and transforming datasets can reveal information that no single source showed and that people never chose to share, and every derived dataset is a new use of the data
- [ ] It's never stored
- [ ] It can't be deleted at all
>>>
That's the flip side of Part III's power. Lineage and purpose documentation help.

### tradeoff
Keeping all raw events forever (Chapter 11) vs a 90-day retention policy for personal events: what's the trade-off?
- [x] Full history enables reprocessing and new views, but increases liability (leaks, misuse, legal deletion obligations); retention limits reduce risk but limit what can be recomputed later
- [ ] There's no trade-off
- [ ] Retention policies make systems faster but less correct
- [ ] Full history is always illegal
>>>
Aggregating or anonymizing early can keep much of the analytic value with far less risk.

### explain
Choose one technical technique from the course and explain how it can help a system behave more responsibly toward the people its data describes.
>>>
For example, immutable event logs with deterministic derivation (Chapters 10–11). Because every derived output can be recomputed from logged inputs with known code, you can audit why a given decision was made: replay the inputs and the version of the model or logic used. You can also correct mistakes systematically by fixing the logic and recomputing affected outputs, instead of patching individual records. Pair that with explicit retention and excision procedures for personal data in the log and in every derived view, which lineage makes possible, so the auditability doesn't turn into keeping everything forever. Other good answers: data minimization through early aggregation, access control and encryption, or keeping a human in the loop for high-impact automated decisions.
:::

:::connect Where this goes next
Tomorrow: the final exam, cumulative over Chapters 1–11. Then two weeks of capstone: build MiniKV, a small replicated, partitioned key-value store, from your own exercises.
:::
