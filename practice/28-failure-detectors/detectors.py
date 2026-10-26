"""Exercise 28 — failure detectors: fixed timeouts vs. an adaptive (Phi Accrual) detector.

Everything runs in *simulated* time, so a run takes well under a second and is reproducible.

A node sends a heartbeat every 100 ms. Each heartbeat suffers a network delay that is mostly queueing
(it grows sharply as the network gets busier, p. 274) plus, occasionally, a long pause (GC, VM steal time,
TCP retransmission). At CRASH_AT the node really crashes and stops sending.

The monitor checks every 10 ms whether it suspects the node. We count:
  * false suspicions — episodes where the live node was declared dead;
  * detection time   — how long after the real crash the node was first suspected.

The delay model (exponential queueing with mean load/(1-load)) is a textbook simplification chosen for
this exercise; it is not from the book.
"""
from __future__ import annotations

import math
import random
from collections import deque

HEARTBEAT_MS = 100
CHECK_MS = 10
DURATION_MS = 120_000
CRASH_AT = 100_000


def heartbeat_arrivals(load: float, pause_prob: float, seed: int) -> list[float]:
    """Arrival times (ms) of heartbeats at the monitor.

    Heartbeats travel over one TCP connection, so they arrive in order: a delayed heartbeat holds back
    the ones behind it. A pause (GC on the sender, VM steal time, a retransmission timeout) blocks
    everything for its duration.
    """
    rnd = random.Random(seed)
    q_mean = 2.0 * load / (1.0 - load)          # ms of queueing on average
    arrivals = []
    blocked_until = 0.0
    prev = 0.0
    for sent in range(0, CRASH_AT, HEARTBEAT_MS):
        if rnd.random() < pause_prob:
            blocked_until = sent + rnd.uniform(100, 1500)
        delay = 0.5 + (rnd.expovariate(1.0 / q_mean) if q_mean > 0 else 0.0)
        arrival = max(sent + delay, blocked_until + 0.5, prev)
        arrivals.append(arrival)
        prev = arrival
    return arrivals


class FixedTimeoutDetector:
    """Suspect the node if no heartbeat has arrived for `timeout_ms`."""

    def __init__(self, timeout_ms: float):
        self.timeout_ms = timeout_ms
        self.last = 0.0

    def heartbeat(self, now: float) -> None:
        self.last = now

    def suspect(self, now: float) -> bool:
        # TODO 1: return True if no heartbeat has arrived for more than timeout_ms.
        raise NotImplementedError


class PhiAccrualDetector:
    """Hayashibara et al.'s Phi Accrual failure detector (as used in Akka and Cassandra, p. 276).

    Instead of a yes/no timeout it outputs a suspicion level phi. Keep a sliding window of the intervals
    between heartbeats; model them as a normal distribution with that window's mean and standard deviation;
    phi(now) = -log10(probability that the next heartbeat arrives even later than `now - last`).
    phi = 1 means ~10% chance we're wrong to suspect, phi = 2 means ~1%, phi = 8 means ~0.000001%.
    """

    def __init__(self, threshold: float, window: int = 200, min_std_ms: float = 20.0):
        self.threshold = threshold
        self.intervals: deque[float] = deque(maxlen=window)
        self.min_std_ms = min_std_ms
        self.last: float | None = None

    def heartbeat(self, now: float) -> None:
        if self.last is not None:
            self.intervals.append(now - self.last)
        self.last = now

    def phi(self, now: float) -> float:
        # TODO 2: return phi(now).
        #  - Return 0.0 until at least 5 intervals have been observed.
        #  - mean and (population) standard deviation of self.intervals; std = max(std, self.min_std_ms).
        #  - elapsed = now - self.last
        #  - p_later = 0.5 * math.erfc((elapsed - mean) / (std * math.sqrt(2)))
        #  - return -log10(p_later)   (guard against p_later == 0)
        raise NotImplementedError

    def suspect(self, now: float) -> bool:
        return self.phi(now) > self.threshold


def evaluate(detector, arrivals: list[float]) -> tuple[int, float | None]:
    """Run the monitor loop. Returns (false suspicion episodes, detection time after the crash in ms)."""
    # TODO 3: step `now` from 0 to DURATION_MS in CHECK_MS steps.
    #  - Deliver every heartbeat with arrival time <= now (detector.heartbeat(arrival)); a heartbeat clears suspicion.
    #  - When detector.suspect(now) turns from False to True: before CRASH_AT that is one false-suspicion
    #    episode; at or after CRASH_AT it's the detection — record now - CRASH_AT and stop.
    #  - Return (false_episodes, detection_ms or None).
    raise NotImplementedError


def main() -> None:
    configs = [
        ("fixed 150 ms", lambda: FixedTimeoutDetector(150)),
        ("fixed 500 ms", lambda: FixedTimeoutDetector(500)),
        ("fixed 2000 ms", lambda: FixedTimeoutDetector(2000)),
        ("phi > 3", lambda: PhiAccrualDetector(3)),
        ("phi > 8", lambda: PhiAccrualDetector(8)),
    ]
    for load, pause in [(0.3, 0.0), (0.9, 0.0), (0.5, 0.01)]:
        print(f"\nload {load:.0%}, pause probability {pause:.0%} per heartbeat")
        print(f"  {'detector':<15}{'false suspicions':>18}{'detect crash after':>22}")
        arrivals = heartbeat_arrivals(load, pause, seed=42)
        for name, make in configs:
            fs, det = evaluate(make(), arrivals)
            det_s = f"{det / 1000:.2f} s" if det is not None else "never"
            print(f"  {name:<15}{fs:>18}{det_s:>22}")


if __name__ == "__main__":
    main()
