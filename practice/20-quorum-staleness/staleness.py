"""
Exercise 20 — How stale are quorum reads? Quantifying "eventual" (book pp. 173-177).

A Monte-Carlo model of one write followed by one read in a Dynamo-style store:
- the write is sent to all n replicas; each receives it after a random network delay;
- the client counts the write as successful when the w-th acknowledgement returns ("commit");
- `read_after_ms` after the commit, a read is sent to all replicas; it uses the first r replies;
- the read is STALE if none of those r replicas had received the write when the read request arrived.

Run:  python practice/20-quorum-staleness/staleness.py
"""
import random

MEAN_DELAY_MS = 10.0     # mean one-way network delay (exponentially distributed)
TRIALS = 20_000


def trial(n, w, r, read_after_ms, rand, mean_delay=MEAN_DELAY_MS, p_down=0.0):
    """TODO: simulate ONE write followed by ONE read and return (write_ok, stale).
        write_ok: False if fewer than w replicas acknowledged (then stale is None)
        stale:    True/False as defined above (None if fewer than r replicas could reply)
    Steps:
      1. For each replica: with probability p_down it is down for this trial (never receives the write,
         never replies). Otherwise it receives the write at arrive_i = rand.expovariate(1/mean_delay),
         and its ack returns at arrive_i + another expovariate delay.
      2. commit = time of the w-th earliest ack (if fewer than w acks: return (False, None)).
      3. The read starts at commit + read_after_ms. For each up replica, the request arrives at
         start + expovariate delay; the replica has the new value iff arrive_i <= that time; its reply
         comes back after another expovariate delay.
      4. Take the r earliest replies; stale = none of them had the new value."""
    raise NotImplementedError


def stale_rate(n, w, r, read_after_ms=0.0, p_down=0.0, seed=1):
    rand = random.Random(seed)
    stale = done = failed = 0
    for _ in range(TRIALS):
        ok, s = trial(n, w, r, read_after_ms, rand, p_down=p_down)
        if not ok:
            failed += 1
        elif s is not None:
            done += 1
            stale += s
    return (stale / done if done else float("nan")), failed / TRIALS


if __name__ == "__main__":
    try:
        print(f"P(stale read immediately after commit), mean delay {MEAN_DELAY_MS} ms, {TRIALS:,} trials\n")
        print("  n  w  r   w+r>n   P(stale)")
        for n, w, r in [(3, 1, 1), (3, 2, 1), (3, 1, 2), (3, 2, 2), (3, 3, 1), (5, 1, 1), (5, 2, 2), (5, 3, 3)]:
            p, _ = stale_rate(n, w, r)
            print(f"  {n}  {w}  {r}   {'yes' if w + r > n else 'no ':>5}   {p:7.2%}")
        print("\nn=3, w=1, r=1: staleness vs. time between the write's commit and the read")
        for t in (0, 5, 10, 20, 40, 80):
            p, _ = stale_rate(3, 1, 1, read_after_ms=t)
            print(f"  read {t:>3} ms after commit: P(stale) = {p:6.2%}")
        print("\nAvailability with 1-in-5 replicas down per trial (n=3):")
        for w, r in [(3, 1), (2, 2), (1, 1)]:
            p, failed = stale_rate(3, w, r, p_down=0.2)
            print(f"  w={w} r={r}: writes failing = {failed:6.2%}   P(stale | success) = {p:6.2%}")
    except NotImplementedError:
        print("trial() not implemented yet")
