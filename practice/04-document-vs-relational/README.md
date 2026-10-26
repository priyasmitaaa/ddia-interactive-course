---
title: One résumé, two data models
chapter: 2
topic: Document vs relational, locality, one-to-many vs many-to-many
minutes: 45
---

## Objective

Feel the difference between the document and relational models on the book's own example
(Figure 2-1 and Example 2-1): the document model wins for a self-contained tree, and starts
to hurt as soon as data becomes interconnected (Figure 2-4: recommendations).

## Setup

Python 3.10+ (SQLite is built in). Open `practice/04-document-vs-relational/profiles.py`.
The script builds both models in an in-memory SQLite database: normalized tables
(`users`, `positions`, `education`, `regions`) and a `user_docs` table holding one JSON
document per user. Use the helper `q(sql, *params)` for queries — it counts round trips.

## Predict first

1. How many queries will the relational model need to load Bill's full profile if you don't use a join? With one join?
2. After adding recommendations (which show the *recommender's* name and photo), which model needs more queries to render Bill's profile?
3. If you embedded a *copy* of the recommender's photo in each recommendation, how many documents would you need to rewrite when Grace changes her photo, if she had written 500 recommendations?

## Your task

1. **Task 1:** implement `load_profile_relational` and `load_profile_document`. They must return identical dicts for user 251. (Hint: `json.loads` the document; `dict(row)` turns an SQLite row into a dict.)
2. **Task 2a:** in `setup_recommendations`, create a `recommendations` table and insert two recommendations for Bill (from Grace and Ada). Write `show_recommendations_relational` as **one** SQL query with a join.
3. **Task 2b:** also add the recommendations to Bill's JSON document, storing only the recommender's `user_id`. Implement `show_recommendations_document` by resolving the references in Python.
4. **Task 2c (thinking only):** write down what `change_photo` would need to do in each model, for both the "reference" and the "embedded copy" designs.

## Run it

```
python practice/04-document-vs-relational/profiles.py
```

## Observe

- For the tree-shaped profile, the document needs 1 query; the relational schema needs one per table (or a multi-way join).
- For recommendations, the relational version is still one query (the database does the join). The document version does an **application-side join** — one extra query per recommendation — or else duplicates data.
- The data started document-shaped and *became* interconnected as features were added, exactly as the book warns (p. 32–33).

## Questions

1. Which parts of a LinkedIn profile are one-to-many, and which are many-to-one or many-to-many?
2. What does "the work of making the join is shifted from the database to the application code" mean in practice, and why is it usually slower?
3. Give one reason to prefer the embedded-copy design despite the update cost.
4. Would a graph model help here? When would you switch to one?

<details><summary>Discussion</summary>

1. One-to-many: positions, education, contact info (the tree under the user). Many-to-one: region, industry (many users point at one region). Many-to-many: organizations/schools as entities (many users ↔ many organizations), recommendations (users ↔ users).
2. Your code issues several queries and stitches results together. Each query is a separate round trip, and your code can't use the database's join algorithms or indexes as effectively as the query optimizer can.
3. Reads become a single document fetch with no extra lookups, which matters if profiles are read far more often than photos change. You trade write cost and possible inconsistency for read speed — the same trade as Twitter's fan-out on write.
4. If relationships become the main thing you query ("people who worked with someone who went to my school"), the number of joins becomes variable and a graph model becomes the most natural (pp. 38–39, 48).
</details>
