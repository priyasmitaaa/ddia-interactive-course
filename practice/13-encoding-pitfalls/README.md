---
title: Pitfalls of textual encodings — big numbers, binary data, CSV
chapter: 4
topic: JSON number precision, Base64 overhead, CSV ambiguity
minutes: 30
---

## Objective

Reproduce three "subtle problems" of JSON, XML and CSV from the book (pp. 110–111): integers
above 2⁵³ silently change when parsed as floating point (Twitter's tweet-ID problem), binary data
must be Base64-encoded (and grows by a third), and CSV has no reliable way to hold commas,
quotes or newlines unless every reader and writer implements the escaping rules.

## Setup

Python 3.10+. Open `practice/13-encoding-pitfalls/pitfalls.py`. `js_like_loads` imitates a parser
(such as JavaScript's) that turns every JSON number into a 64-bit float.

## Predict first

1. Will a 19-digit tweet ID survive a round trip through a float-based JSON parser?
2. Base64 encodes 3 bytes as 4 characters. Roughly what size ratio do you expect?
3. A naive CSV writer joins fields with commas. How many rows and fields will a proper CSV parser read back for a row containing a comma, quotes and a newline?

## Your task

1. **Part A:** implement `encode_tweet` (id as number and as `id_str`) and `decode_tweet_safely` (prefer `id_str`).
2. **Part B:** implement `base64_json_size`.
3. **Part C:** implement `naive_line` and compare it with Python's `csv.writer`.

## Run it

```
python practice/13-encoding-pitfalls/pitfalls.py
```

## Observe

- The float-based parser reads a *different* ID (off by one) with no error — silent corruption.
- Sending the ID as a decimal string as well (Twitter's workaround) preserves it exactly.
- Base64 makes binary data about 1.33× larger, plus JSON quoting.
- The naive CSV line is parsed as 2 rows; the properly escaped one round-trips.

## Questions

1. Why is the number problem silent rather than an error, and why is that worse?
2. Why doesn't JSON simply support raw bytes?
3. The book says these formats are "good enough" for data interchange between organisations. Why, despite these flaws?
4. Which of these problems would a schema-based binary format like Protocol Buffers avoid?

<details><summary>Discussion</summary>

1. The parser produces a valid number — just the nearest double, not the original integer. Nothing fails, so corrupted IDs flow onwards (e.g. you fetch or delete the wrong tweet).
2. JSON is a Unicode text format; arbitrary bytes aren't valid text, so they must be represented as text (Base64), with the schema or convention telling readers to decode it (p. 110).
3. Getting different organisations to agree on any format is the hard part; once they agree, prettiness and efficiency matter less (p. 111).
4. Protocol Buffers distinguishes int64 from double and has a `bytes` type, and its length-prefixed encoding needs no escaping, so all three go away (pp. 113–117).
</details>
