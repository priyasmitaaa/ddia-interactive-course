---
title: Fault injection — why retries alone are not enough
chapter: 1
topic: Reliability, faults vs failures, deliberate fault injection
minutes: 40
---

## Objective

See with your own eyes how a single kind of fault (a lost network message) turns into a
*failure* (wrong money balances) — and how the "obvious" fix, retrying, creates a new failure.
You will deliberately inject faults, in the spirit of Netflix's Chaos Monkey (book p. 5).

## Setup

Nothing to install. You need Python 3.10+. Open `practice/01-fault-injection/bank.py`.

Read the code first (5 minutes). The important pieces:

- `BankServer.transfer()` moves $1 from alice to bob. If you pass a `request_id`, the server remembers
  it and will not apply the same request twice.
- `FlakyNetwork.transfer()` sits between client and server and injects three faults:
  503 "unavailable" (nothing happened), **request lost** (nothing happened), and **response lost**
  (the transfer *did* happen, but the client never hears about it). The client sees the last two
  as the same `Timeout` exception.

## Predict first

Write down your guesses before running anything:

1. With the naive client, will bob's balance be *higher*, *lower*, or *equal* to the number of payments the client thinks succeeded?
2. If you simply retry every failed call up to 5 times, will bob end up with exactly $2000, less, or more?

## Your task

1. Run the file once to see the naive client's results.
2. Implement `send_with_retries`: try up to 5 times on `Timeout` or `ServiceUnavailable`.
3. Run again. Compare "client thinks succeeded", "server actually applied" and "bob's balance".
4. Implement `send_idempotent`: generate **one** unique id per logical payment (e.g. `uuid.uuid4()`),
   and send the **same** id on every retry.
5. Run again.

## Run it

```
python practice/01-fault-injection/bank.py
```

## Observe

- Naive: the client and the server **disagree**. Some payments the client reported as failed really happened.
- Retries: every payment now "succeeds" from the client's point of view — but bob receives *more*
  than $2000. A timeout does not tell you whether the operation happened; retrying a non-idempotent
  operation can apply it twice.
- Idempotent retries: the numbers finally agree.

## Questions

1. Which of the three injected faults is the dangerous one, and why can the client not distinguish it from a harmless one?
2. The book says it can make sense to *increase* the rate of faults deliberately. What would you have missed in this exercise if the fault rates were 0.001% instead of 5%?
3. Where must the de-duplication state (`processed`) live for idempotency to work if there are many client machines? What happens if the server forgets it after a restart?
4. Is the 503 `ServiceUnavailable` safe to retry without an id? Why is it different from `Timeout`?

<details><summary>Discussion (open after answering)</summary>

1. The lost *response*. The server applied the transfer, but the client sees the same `Timeout` as when the request was lost. From the client's side "nothing happened" and "it happened but I didn't hear back" look identical — a theme that returns in Chapter 8 (you cannot tell why you got no reply).
2. Rare faults hide bugs in error-handling paths. With 5% fault rates the duplicate-payment bug appears within seconds; at 0.001% it might hit production months later. Deliberate fault injection keeps fault-handling code exercised.
3. On the server side (or in shared durable storage), keyed by request id — every client's retries must hit the same de-duplication record. If it is lost on restart, a retry after the restart could be applied twice; production systems store the ids durably, often in the same transaction as the write (Chapter 11, "Idempotence").
4. Yes: the server explicitly said it did nothing, so a retry cannot double-apply. The difference is *knowledge*: a 503 is a definite "no", a timeout is "don't know".
</details>
