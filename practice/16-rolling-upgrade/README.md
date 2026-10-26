---
title: Data outlives code — preserving unknown fields
chapter: 4
topic: Forward compatibility through databases, rolling upgrades
minutes: 25
---

## Objective

Reproduce Figure 4-7: during a rolling upgrade, an old version of the code reads a record written
by the new version, decodes it into a model object, edits it, and writes it back — silently
deleting the field it didn't know about. Then fix it.

## Setup

Python 3.10+. Open `practice/16-rolling-upgrade/upgrade.py`. `PersonV1` is a typical model class:
it only has attributes for the fields version 1 knows.

## Predict first

1. After a v2 server sets `photo_url` and a v1 server then changes `favorite_number`, does the record still have a photo?
2. Is this a backward- or a forward-compatibility problem?

## Your task

1. Run the file and confirm the naive v1 code loses `photo_url`.
2. Implement `PersonV1Fixed` (still v1: no knowledge of `photo_url`) that keeps any unknown keys it read and writes them back, and `v1_fixed_set_favorite_number`.

## Run it

```
python practice/16-rolling-upgrade/upgrade.py
```

## Observe

- The naive version loses data without any error, and it would happen only during the upgrade window — the hardest kind of bug to notice.
- The fix is small; the hard part is knowing you need it (p. 126: "not a hard problem, you just need to be aware of it").

## Questions

1. Why is forward compatibility needed for databases at all, if new code is deployed after old code?
2. "Data outlives code": a record written five years ago is still in the database. What does that imply for backward compatibility?
3. Where else in a system could the same loss happen (hint: p. 134, message brokers)?

<details><summary>Discussion</summary>

1. In a rolling upgrade, old and new code run at the same time against the same database, so old code reads values written by new code (p. 125).
2. New code must be able to read every historical format that still exists in storage, unless the data is explicitly migrated (rewritten) — usually expensive, so it's often avoided (p. 126).
3. A consumer that reads a message, transforms it, and republishes it to another topic can drop unknown fields in exactly the same way.
</details>
