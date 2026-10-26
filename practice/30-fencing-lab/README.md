---
title: Lab — leases, GC pauses and fencing tokens
chapter: 8
topic: Distributed locks, process pauses, fencing tokens, safety properties
minutes: 100
---

## Objective

Build the pieces of Figures 8-4 and 8-5 with real threads and real (short) time: a lease-based
lock service that hands out **fencing tokens**, and a storage service that can check them. Then
reproduce the HBase-style corruption bug (a client paused past its lease expiry keeps writing) and
fix it with fencing. Finally, write a checker for the **safety properties** of a fencing-token
service from pp. 299–300 — uniqueness and monotonic sequence — and use it to catch a broken design.

## Setup

Python 3.10+, standard library only. Files: `practice/30-fencing-lab/fencing.py` (TODOs 1–3) and
`test_fencing.py` (T1–T4). The whole suite takes a few seconds; leases are 0.1–0.3 s and the
"GC pause" is a 0.6 s `time.sleep`.

## Predict first

1. Without fencing, in which order will storage receive the two writes, and will it accept both?
2. Fencing rejects token 33 after it has seen 34. What would happen if client 1's late write
   arrived *before* client 2's first write?
3. Two lock servers each with their own counter, alternating — which property breaks first?

## Your task

1. **TODO 1** `LockService.acquire` → T1. Use the lock service's own `time.monotonic()` — the
   expiry belongs to the lock service's clock.
2. **TODO 2** `Storage.write` → T2 and T3. The scenario in `figure_8_4` is given; read it — the
   pause sits exactly between "check the lease" and "use the lease", as on p. 287.
3. **TODO 3** `check_safety` → T4. "x completed before y began" means `x.end < y.start`;
   requests that overlap in time may get tokens in either order.

## Run it

```
python practice/30-fencing-lab/test_fencing.py
python practice/30-fencing-lab/fencing.py
```

## Observe

- `fencing=False`: both writes are accepted, client 2's then client 1's — the stale lease holder
  overwrote the new one's data, and neither client received an error.
- `fencing=True`: client 1's write with token 33 is rejected. Note *who* did the checking: the
  storage service, not the client. A client can't reliably check its own lease, because it can be
  paused right after checking (p. 295).
- The concurrent stress test produces 500 tokens with no violations, because one lock service
  with one counter under one mutex is the single source of truth. The two-counter design
  hands out duplicates almost immediately.

## Questions

1. Client 1 used `time.monotonic()` to check its lease, so clock skew isn't the problem here. What is?
2. If a malicious client sends a made-up high token, what happens? Which assumption of the book
   rules this out?
3. Your storage is a plain file system that can't check tokens. What workaround does the book suggest?
4. Classify each as safety or liveness: (a) no two clients get the same token; (b) a client that
   requests a token and doesn't crash eventually gets one; (c) the file is never corrupted;
   (d) an expired lease is eventually granted to a waiting client.
5. Our lock service is a single node. What happens to your guarantees when it crashes, and what
   would Chapter 9 use instead?

<details><summary>Discussion</summary>

1. A process pause between the check and the use. The thread has no way to notice it was paused;
   by the time the write is sent, the lease has expired and someone else holds it (pp. 287–289).
2. Storage accepts it and then rejects every honest client with a lower token. Fencing protects
   against nodes that are *inadvertently* wrong, not deliberately lying. The book assumes nodes are
   unreliable but honest, i.e. no Byzantine faults (p. 295).
3. Include the fencing token in the filename, or use some other check, so that writes outside the
   lock's protection aren't processed (p. 295).
4. (a) safety, (c) safety: you can point to the moment it was violated, and it can't be undone.
   (b) and (d) are liveness properties: "eventually" (p. 300).
5. If the single lock service crashes it can't grant or renew leases, which is a liveness failure.
   If it restarts and forgets its counter, it can reuse tokens, which violates safety. You'd need to
   persist the counter (crash-recovery model, stable storage, p. 299) or replicate the service. Making
   a replicated service agree on one leader and one increasing token is exactly consensus: ZooKeeper's
   zxid or cversion can serve as the fencing token (p. 295, Chapter 9).
</details>
