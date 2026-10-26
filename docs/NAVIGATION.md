# Navigating the platform

The app has four areas, always in the top bar: **Learn**, **Review**, **Practice** and **Progress**. There are no
accounts, streaks or points. Everything you do is saved automatically in your browser.

```
┌──────────────────────────────────────────────────────────────────────────┐
│ DDIA Course          Learn   Review •   Practice   Progress              │   • = revision due today
└──────────────────────────────────────────────────────────────────────────┘
```

---

## A typical day (about 1–2 hours)

1. Open the course. **Learn** shows *Today's lesson*. Click **Continue Learning →**.
2. If the Learn page shows **Revision: N min**, do that first (5–15 minutes). It's the highest-value time you'll spend.
3. Work through the lesson top to bottom (the stage bar tracks where you are):
   **Learn → Visualize → Practice → Quiz → Complete**.
4. Read the pages listed under **Read in the book**. Click a page range to open your PDF at that page (local install).
5. Answer every quiz question. They become your future review.
6. Check the **"Ready to finish today?"** criteria and click **Complete lesson & continue →**.

Day 6 of each week is lighter: a spaced review, a recall task, and a checkpoint quiz. Use any spare time to catch up
on exercises.

---

## Learn: the course map and today's lesson

**Top card: today's lesson.** The first unfinished day, with its estimated time, chapter, type (Lab, Review,
Checkpoint, Project, Beyond the PDF) and what you'll learn. **Continue Learning** always goes to the first unfinished
day, so you never have to remember where you were.

**The whole course** is listed below, grouped by part. Each week shows its summary and *done/total*. Click a week to
expand its six days, and click any day to open it. You may skip around. "Continue" still returns you to the first
unfinished day.

### Inside a lesson

| Section (label in the app) | What it's for |
|---|---|
| **The problem** | The real-world problem this topic solves. Read this first. |
| **Intuition** | The core idea, in plain language. |
| **How it really works** | The technical detail, with page references. |
| **See it** | An interactive visualization. Follow its *Try this* steps, since they're designed to reveal the mechanism. |
| **Hands-on** | A coding exercise: opens its page in Practice. |
| **Task** | A short recall or design task to do on paper. |
| **Check your understanding** | The quiz (see below). |
| **Connect the dots** | How today links to earlier and later chapters. |
| **Beyond the book** | Supplementary material that is not in your PDF, always clearly marked. |
| **Note** | Practical guidance (time budget, warnings). |

Also on every lesson:
- **By the end of today you will be able to…** lists the learning objectives.
- **Read in the book** lists sections with printed page ranges, and each link opens the PDF at that page.
- Links inside the text such as "p. 248" are page links too, and links to other lessons and exercises jump there directly.
- **Footer**: previous day · course map · next day.

### Quiz questions

- **Multiple choice / predict / trade-off**: pick an answer. You'll see immediately whether it was right, with an
  explanation. Your **first** answer is what counts for review. *Try again (for practice)* doesn't change it.
- **Explain / scenario / design** (free text): **write your answer first**, even roughly. Then click *Compare with model
  answer*, and grade yourself honestly with **I had the key points** or **I missed something**. That decides when it comes back.
  Drafts are saved as you type.

Wrong answers always become review cards. Up to three correct answers per lesson also do, so you revisit what you
know, not just what you missed.

---

## Review: keep it in your head

- **Today's revision**: questions scheduled for today, at most 10 per session. Questions you last got wrong come first.
  Start with **Start revision**. When a session ends you can do another round if more are due.
- **Struggling topics**: lessons with questions you keep missing. **Practise these** runs just those questions.
- **Mixed quiz**: a random mix from everything you've answered so far. Good before a checkpoint.

**How scheduling works**: a correct answer moves a question to a longer interval (1 → 4 → 10 → 25 → 60 → 150 days),
and after the last one it "graduates". A wrong answer sends it back to tomorrow. A little every day beats a lot once a week.

---

## Practice: hands-on exercises

All 45 exercises and labs, grouped by chapter. Each page shows:
- the **folder** to work in (e.g. `practice/26-mvcc-ssi/`) and how long it takes;
- **Objective**, **Setup**, **Predict first** (write your predictions before running anything), **Your task**,
  **Run it** (the exact command), **Observe** (what to look for), and **Questions** with a hidden **Discussion**;
- **Mark exercise as done** to track it in Progress.

Exercises run on your computer with Python (see [SETUP](SETUP.md)). Reference solutions are in
`practice/_solutions/`. Look only after a genuine attempt.

---

## Progress: where you are

- **Lessons completed**, **chapters completed**, **exercises done**, and **first-try quiz accuracy**.
- **Current position**: a link to your next lesson.
- **Chapters**: completion per chapter.
- **Topics needing revision**: lessons whose questions you've missed, with a shortcut to practise them in Review.
- **Backup**: **Download backup** saves a `.json` file of all your progress. **Restore from backup…** loads one, which is how
  you move between devices or browsers. **Reset…** erases everything; it asks first.

---

## Tips

- Do the **Predict first** steps in visualizations and exercises. Being surprised is when you learn most.
- Use the **Day 6** recall tasks without notes, then check. Retrieval beats re-reading.
- Stuck on a lesson? Re-read its *Intuition*, run the visualization again, then read the pages once more.
- The hosted site and the local install keep **separate** progress. Use backups to move between them.
