"""Exercise 29 — clocks: what your machine offers, and how last-write-wins loses data with skewed clocks.

Part A looks at the real clocks of your computer (read-only; nothing is changed).
Part B is a simulation: three replicas with slightly skewed time-of-day clocks resolve conflicts with
last-write-wins (LWW), as Cassandra and Riak do (p. 284). Clients increment a counter one after another —
every increment is causally after the previous one — yet some increments vanish.
"""
from __future__ import annotations

import random
import time
from dataclasses import dataclass

# ---------------------------------------------------------------- Part A: your machine's clocks


def part_a() -> None:
    print("Part A - clocks on this machine")
    for name in ("time", "monotonic", "perf_counter"):
        info = time.get_clock_info(name)
        print(f"  {name:<13} adjustable={str(info.adjustable):<5} monotonic={str(info.monotonic):<5} "
              f"resolution={info.resolution:.2e}s  ({info.implementation})")
    wall0, mono0 = time.time(), time.monotonic()
    time.sleep(0.2)
    print(f"  measured 0.2 s sleep: time.time() says {time.time() - wall0:.4f}s, "
          f"time.monotonic() says {time.monotonic() - mono0:.4f}s")
    print("  time.time() is the time-of-day clock (may be stepped by NTP); use time.monotonic() for durations.\n")


# ---------------------------------------------------------------- Part B: LWW with skewed clocks


@dataclass(frozen=True)
class Version:
    value: int
    ts: tuple            # comparable timestamp: (time_or_counter, node_id)


def lww_merge(current: Version | None, incoming: Version) -> Version:
    """Last write wins: keep whichever version has the greater timestamp."""
    # TODO 1: return `incoming` if there is no current version or incoming.ts > current.ts; else `current`.
    raise NotImplementedError


class PhysicalClockReplica:
    """Timestamps come from this node's time-of-day clock: real time + a fixed offset, at a given resolution."""

    def __init__(self, node_id: int, offset_ms: float, resolution_ms: float):
        self.node_id, self.offset_ms, self.resolution_ms = node_id, offset_ms, resolution_ms
        self.data: Version | None = None

    def timestamp_for_write(self, real_ms: float) -> tuple:
        # TODO 2: local time = real_ms + self.offset_ms; if self.resolution_ms, round DOWN to a multiple of it
        #         (a clock that only moves in steps). Return (local_time, self.node_id) — node id breaks ties.
        raise NotImplementedError

    def observe(self, v: Version) -> None:
        """Called whenever this replica receives a version (its own write or a replicated one)."""


class LamportReplica(PhysicalClockReplica):
    """Timestamps from a logical counter (p. 284; Lamport timestamps are covered properly in Chapter 9)."""

    def __init__(self, node_id: int, offset_ms: float = 0, resolution_ms: float = 0):
        super().__init__(node_id, offset_ms, resolution_ms)
        self.counter = 0

    def timestamp_for_write(self, real_ms: float) -> tuple:
        # TODO 3a: increment self.counter and return (self.counter, self.node_id).
        raise NotImplementedError

    def observe(self, v: Version) -> None:
        # TODO 3b: on seeing any version, move the counter forward to at least v.ts[0].
        raise NotImplementedError


def run(replica_cls, skew_ms: float, gap_ms: float, n: int = 1000, resolution_ms: float = 0, seed: int = 1) -> int:
    """n sequential increments, each gap_ms after the previous one (which has fully replicated).

    Each increment goes to a random replica, reads the current value there, and writes value + 1 with
    that replica's timestamp. The write is then replicated to every replica (including itself) with
    lww_merge. Returns the number of increments lost.
    """
    rnd = random.Random(seed)
    offsets = [rnd.uniform(-skew_ms / 2, skew_ms / 2) for _ in range(3)]
    reps = [replica_cls(i, offsets[i], resolution_ms) for i in range(3)]
    real = 0.0
    for _ in range(n):
        real += gap_ms
        r = rnd.choice(reps)
        current = r.data.value if r.data else 0
        v = Version(current + 1, r.timestamp_for_write(real))
        for rep in reps:
            rep.observe(v)
            rep.data = lww_merge(rep.data, v)
    final = reps[0].data.value
    assert all(rep.data == reps[0].data for rep in reps), "replicas should have converged"
    return n - final


def part_b() -> None:
    print("Part B - 1000 sequential increments, one every 2 ms, LWW on 3 replicas")
    print(f"  {'clock skew':<12}{'physical (exact)':>18}{'physical (10 ms steps)':>24}{'Lamport':>10}")
    for skew in (0, 1, 2, 5, 20, 100):
        phys = run(PhysicalClockReplica, skew, gap_ms=2)
        coarse = run(PhysicalClockReplica, skew, gap_ms=2, resolution_ms=10)
        lam = run(LamportReplica, skew, gap_ms=2)
        print(f"  {str(skew) + ' ms':<12}{phys:>18}{coarse:>24}{lam:>10}")
    print("  (numbers are increments lost - silently, with no error reported to any client)")


if __name__ == "__main__":
    part_a()
    part_b()
