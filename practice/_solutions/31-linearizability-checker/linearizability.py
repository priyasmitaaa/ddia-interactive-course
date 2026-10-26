"""Lab 31 - a linearizability checker, and a replicated store to test with it (pp. 314-325).

Part 1: implement a checker for histories of a single register (read / write / cas).
Part 2: record real histories from a toy replicated key-value store with real threads, and let your checker
        find out whether reading from followers is linearizable (it isn't) and reading from the leader is.

The checker searches for an order of operations that (a) respects real time: if op a finished before op b
started, a comes first, and (b) is a legal sequence for a register. This brute-force idea goes back to
Wing & Gong (1993); tools like Knossos and Porcupine use smarter versions of it. The book mentions that such
checking is "possible (though computationally expensive)" (p. 319).
"""
from __future__ import annotations

import random
import threading
import time
from dataclasses import dataclass


@dataclass(frozen=True)
class Op:
    client: str
    kind: str                 # 'write' | 'read' | 'cas'
    start: float
    end: float
    value: int | None = None  # write: value written; read: value returned
    old: int | None = None    # cas: expected value
    new: int | None = None    # cas: new value
    ok: bool = True           # cas: did it succeed?


def step(op: Op, state: int) -> int | None:
    """Apply op to register value `state`. Return the new state, or None if op's recorded result is impossible."""
    # TODO 1 (solution)
    if op.kind == "write":
        return op.value
    if op.kind == "read":
        return state if op.value == state else None
    if op.kind == "cas":
        if op.ok and state == op.old:
            return op.new
        if not op.ok and state != op.old:
            return state
        return None
    raise ValueError(op.kind)


def linearize(history: list[Op], initial: int = 0) -> list[Op] | None:
    """Return a valid linearization (list of ops in order) or None if the history is not linearizable."""
    # TODO 2 (solution)
    n = len(history)
    done = [False] * n
    order: list[int] = []
    dead: set[tuple[int, int]] = set()      # (bitmask of done ops, state) known to fail

    def mask() -> int:
        return sum(1 << i for i in range(n) if done[i])

    def search(state: int) -> bool:
        if len(order) == n:
            return True
        key = (mask(), state)
        if key in dead:
            return False
        min_end = min(history[i].end for i in range(n) if not done[i])
        for i in range(n):
            if done[i] or history[i].start > min_end:
                continue                     # some other pending op finished before this one started
            nxt = step(history[i], state)
            if nxt is None:
                continue
            done[i] = True
            order.append(i)
            if search(nxt):
                return True
            done[i] = False
            order.pop()
        dead.add(key)
        return False

    return [history[i] for i in order] if search(initial) else None


# ---------------------------------------------------------------- histories from the book

def figure_9_4(b_last: int) -> list[Op]:
    """Figure 9-4 with times chosen to match its ordering; b_last is the value of B's final (shaded) read."""
    return [
        Op("B", "read", 3, 30, value=1),
        Op("D", "write", 6, 14, value=0),
        Op("A", "write", 10, 42, value=1),
        Op("C", "read", 20, 33, value=1),
        Op("B", "cas", 35, 50, old=1, new=2, ok=True),
        Op("C", "read", 52, 62, value=2),
        Op("D", "cas", 55, 68, old=0, new=3, ok=False),
        Op("C", "cas", 65, 95, old=2, new=4, ok=True),
        Op("A", "read", 70, 85, value=4),
        Op("B", "read", 87, 99, value=b_last),
    ]


# ---------------------------------------------------------------- Part 2: a toy replicated store

class ReplicatedRegister:
    """One leader and two followers. Writes go to the leader and are applied to followers asynchronously,
    after a random replication delay (single-leader, asynchronous replication, Chapter 5)."""

    def __init__(self, lag_s: float = 0.02):
        self.values = [0, 0, 0]          # leader, follower 1, follower 2
        self.versions = [0, 0, 0]
        self.lock = threading.Lock()
        self.lag_s = lag_s

    def write(self, value: int) -> None:
        with self.lock:
            self.values[0] = value
            self.versions[0] += 1
            version = self.versions[0]
        for f in (1, 2):
            threading.Timer(random.uniform(0, self.lag_s), self._apply, args=(f, value, version)).start()

    def _apply(self, f: int, value: int, version: int) -> None:
        with self.lock:
            if version > self.versions[f]:
                self.values[f], self.versions[f] = value, version

    def read(self, from_followers: bool) -> int:
        replica = random.choice([1, 2]) if from_followers else 0
        with self.lock:
            return self.values[replica]


def record_history(from_followers: bool, n_writes: int = 20, readers: int = 3, seed: int = 7) -> list[Op]:
    """One writer writes 1, 2, 3, ... while readers poll. Records each op's real start and end time."""
    random.seed(seed)
    store = ReplicatedRegister()
    history: list[Op] = []
    hlock = threading.Lock()
    stop = threading.Event()

    def writer():
        for v in range(1, n_writes + 1):
            t0 = time.monotonic()
            store.write(v)
            t1 = time.monotonic()
            with hlock:
                history.append(Op("writer", "write", t0, t1, value=v))
            time.sleep(0.005)
        stop.set()

    def reader(name: str):
        while not stop.is_set():
            t0 = time.monotonic()
            v = store.read(from_followers)
            t1 = time.monotonic()
            with hlock:
                history.append(Op(name, "read", t0, t1, value=v))
            time.sleep(0.002)

    ts = [threading.Thread(target=writer)] + [threading.Thread(target=reader, args=(f"r{i}",)) for i in range(readers)]
    for t in ts:
        t.start()
    for t in ts:
        t.join()
    time.sleep(0.05)   # let replication timers finish
    return history


def window(history: list[Op], size: int = 12) -> list[list[Op]]:
    """Checking a long history is exponential in the worst case, so check overlapping time windows of it.
    Each window holds a run of `size` consecutive operations plus every operation that overlaps them in time,
    so no write that could affect a read in the window is left out. (This can miss violations that span
    windows, but never reports a false one.)"""
    h = sorted(history, key=lambda o: o.start)
    out = []
    for i in range(0, max(1, len(h) - size + 1), size // 2):
        core = h[i:i + size]
        t0, t1 = core[0].start, max(o.end for o in core)
        out.append([o for o in h if o.start <= t1 and o.end >= t0])
    return out


def check_recorded(from_followers: bool) -> tuple[int, int]:
    """Returns (windows checked, windows that are not linearizable)."""
    h = record_history(from_followers)
    bad = 0
    ws = window(h)
    for w in ws:
        # the register's value at the window's start is whatever the last write before it wrote (or a read saw);
        # try every value written so far as the initial state.
        t0 = min(o.start for o in w)
        candidates = {0} | {o.value for o in h if o.kind == "write" and o.end < t0}
        if not any(linearize(w, init) is not None for init in candidates):
            bad += 1
    return len(ws), bad


if __name__ == "__main__":
    print("Figure 9-4 with B's last read = 2:", "linearizable" if linearize(figure_9_4(2)) else "NOT linearizable")
    lin = linearize(figure_9_4(4))
    print("Figure 9-4 with B's last read = 4:", "linearizable:" if lin else "NOT linearizable",
          " -> ".join(f"{o.client}.{o.kind}" for o in lin or []))
    for ff in (False, True):
        total, bad = check_recorded(from_followers=ff)
        print(f"reads from {'followers' if ff else 'the leader'}: {bad} of {total} windows not linearizable")
