"""Lab 30 — leases, process pauses and fencing tokens (pp. 287-295, 299-300).

Real threads, real (short) time. A lock service grants leases with a fencing token that increases on every
grant. A storage service accepts writes. A client thread is paused — the stand-in for a stop-the-world GC
pause — after it has checked that its lease is valid, exactly like the request loop on p. 287.

  TODO 1  LockService.acquire   — grant a lease if free or expired; increasing fencing tokens
  TODO 2  Storage.write         — with fencing on, reject tokens lower than the highest seen
  TODO 3  check_safety          — check the uniqueness and monotonic-sequence properties of p. 299-300
"""
from __future__ import annotations

import threading
import time
from dataclasses import dataclass, field


@dataclass
class Lease:
    holder: str
    token: int
    expires_at: float          # on the LOCK SERVICE's monotonic clock


class LockService:
    """A single-node lease service for one resource. Thread-safe."""

    def __init__(self, lease_seconds: float, first_token: int = 33):
        self.lease_seconds = lease_seconds
        self._next_token = first_token
        self._lease: Lease | None = None
        self._mutex = threading.Lock()

    def acquire(self, client: str) -> Lease | None:
        """Grant the lease to `client` if nobody holds it or the current lease has expired.

        Returns a copy of the new Lease (with a fresh, strictly larger fencing token), or None if another
        client holds a lease that hasn't expired yet. A client that already holds a valid lease gets it
        renewed with the SAME token.
        """
        # TODO 1: under self._mutex, using time.monotonic() as the lock service's clock:
        #  - if a lease exists and hasn't expired: a different client gets None; the same client gets its
        #    expiry extended by lease_seconds, keeping the same token (return a copy)
        #  - otherwise grant a new Lease(client, self._next_token, now + lease_seconds), increment
        #    self._next_token, and return a copy
        raise NotImplementedError


@dataclass
class Storage:
    """A file in a storage service. Records every write it accepts."""

    fencing: bool
    accepted: list[tuple[str, int, str]] = field(default_factory=list)   # (client, token, data)
    rejected: list[tuple[str, int, str]] = field(default_factory=list)
    _max_token: int = -1
    _mutex: threading.Lock = field(default_factory=threading.Lock)

    def write(self, client: str, token: int, data: str) -> bool:
        """Append `data`. With fencing, reject a write whose token is lower than the highest token seen."""
        # TODO 2: under self._mutex — if fencing and token < self._max_token: record in self.rejected and
        #         return False. Otherwise update self._max_token, record in self.accepted, return True.
        raise NotImplementedError

    def corrupted(self) -> bool:
        """The file is corrupt if, after some client's write, an older lease holder's write was applied."""
        seen = -1
        for _, token, _ in self.accepted:
            if token < seen:
                return True
            seen = max(seen, token)
        return False


# --------------------------------------------------------------------------- the scenario of Figure 8-4/8-5

def figure_8_4(fencing: bool, lease_s: float = 0.3, pause_s: float = 0.6) -> Storage:
    """Client 1 gets the lease, checks it is valid, is paused for longer than the lease, then writes.
    Meanwhile client 2 acquires the expired lease and writes. Returns the storage for inspection."""
    locks = LockService(lease_s)
    storage = Storage(fencing=fencing)
    c1_has_lease = threading.Event()
    c2_done = threading.Event()

    def client1():
        lease = locks.acquire("client1")
        assert lease is not None
        c1_has_lease.set()
        if time.monotonic() < lease.expires_at:      # lease.isValid()  — true at this moment...
            time.sleep(pause_s)                      # ...then a stop-the-world GC pause
            storage.write("client1", lease.token, "data from client 1")

    def client2():
        if not c1_has_lease.wait(timeout=5):         # client 1 failed: give up instead of hanging
            return
        deadline = time.monotonic() + 5
        while True:                                  # poll until the lease is free
            lease = locks.acquire("client2")
            if lease:
                break
            if time.monotonic() > deadline:
                return
            time.sleep(0.02)
        storage.write("client2", lease.token, "data from client 2")
        c2_done.set()

    ts = [threading.Thread(target=client1), threading.Thread(target=client2)]
    for t in ts:
        t.start()
    for t in ts:
        t.join()
    return storage


# --------------------------------------------------------------------------- correctness properties

@dataclass
class Request:
    client: str
    start: float      # when the request began (monotonic)
    end: float        # when the response arrived
    token: int


def check_safety(history: list[Request]) -> list[str]:
    """Check the two SAFETY properties of a fencing-token service (p. 299-300). Return a list of violations
    (empty list = both hold).

    Uniqueness:        no two requests for a fencing token return the same value.
    Monotonic sequence: if request x completed before request y began, then token_x < token_y.
    """
    # TODO 3: return human-readable strings; include the word "uniqueness" or "monotonic" in each so the
    #         tests can tell them apart. Requests that overlap in time may receive tokens in either order.
    raise NotImplementedError


def stress_tokens(service_acquire, n_threads: int = 20, per_thread: int = 25) -> list[Request]:
    """Many threads repeatedly take a token (each as a new client, so every call is a fresh grant)."""
    history: list[Request] = []
    hist_mutex = threading.Lock()

    def worker(i: int):
        for j in range(per_thread):
            start = time.monotonic()
            token = service_acquire(f"t{i}-{j}")
            end = time.monotonic()
            with hist_mutex:
                history.append(Request(f"t{i}-{j}", start, end, token))

    ts = [threading.Thread(target=worker, args=(i,)) for i in range(n_threads)]
    for t in ts:
        t.start()
    for t in ts:
        t.join()
    return history


class BrokenTokenService:
    """A tempting but broken design: each of two "lock servers" hands out tokens from its own counter,
    alternating between them — no single source of truth."""

    def __init__(self):
        self.counters = [100, 100]
        self.turn = 0
        self.mutex = threading.Lock()

    def acquire(self, client: str) -> int:
        with self.mutex:
            s = self.turn
            self.turn ^= 1
            self.counters[s] += 1
            return self.counters[s]


if __name__ == "__main__":
    for fencing in (False, True):
        st = figure_8_4(fencing)
        print(f"fencing={fencing}: accepted={[(c, t) for c, t, _ in st.accepted]} "
              f"rejected={[(c, t) for c, t, _ in st.rejected]} corrupted={st.corrupted()}")
