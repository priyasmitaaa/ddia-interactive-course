"""Exercise 33 - a username registry on top of total order broadcast (pp. 338-342).

`Log` plays the role of total order broadcast: every appended message gets the next sequence number, and every
node receives all messages in exactly that order, each node after its own random delay (replication lag).
Each `Node` applies delivered messages to its local state.

  TODO 1  claim_via_log  - the procedure on p. 341: append a claim, wait until it's delivered back to you,
                           and succeed only if the FIRST claim for the name in the log is yours.
  TODO 2  read_synced    - a linearizable read: append a marker, wait for it to be delivered, then read.

`claim_naive` (given) checks the local state and then appends - the way you'd do it against an eventually
consistent replica. Run the script to compare.
"""
from __future__ import annotations

import random
import threading
import time
from dataclasses import dataclass


@dataclass(frozen=True)
class Msg:
    seq: int
    kind: str          # 'claim' | 'marker'
    name: str
    owner: str
    origin: int        # node that appended it


class Log:
    """In-process total order broadcast: a single sequencer plus in-order delivery to every node."""

    def __init__(self):
        self.entries: list[Msg] = []
        self.cond = threading.Condition()

    def append(self, kind: str, name: str, owner: str, origin: int) -> int:
        with self.cond:
            seq = len(self.entries)
            self.entries.append(Msg(seq, kind, name, owner, origin))
            self.cond.notify_all()
            return seq


class Node:
    def __init__(self, node_id: int, log: Log, max_lag_s: float, seed: int):
        self.id = node_id
        self.log = log
        self.rnd = random.Random(seed)
        self.max_lag_s = max_lag_s
        self.applied = 0                       # number of log entries applied locally
        self.owners: dict[str, str] = {}       # name -> owner, as decided by the FIRST claim in the log
        self.cond = threading.Condition()
        self.stopped = False
        threading.Thread(target=self._deliver_loop, daemon=True).start()

    def _deliver_loop(self) -> None:
        while not self.stopped:
            with self.log.cond:
                while self.applied >= len(self.log.entries) and not self.stopped:
                    self.log.cond.wait(0.05)
                if self.stopped:
                    return
                msg = self.log.entries[self.applied]
            time.sleep(self.rnd.uniform(0, self.max_lag_s))        # this node lags behind the log
            with self.cond:
                if msg.kind == "claim" and msg.name not in self.owners:
                    self.owners[msg.name] = msg.owner
                self.applied += 1
                self.cond.notify_all()

    def wait_until_applied(self, seq: int, timeout: float = 5.0) -> None:
        with self.cond:
            if not self.cond.wait_for(lambda: self.applied > seq, timeout):
                raise TimeoutError(f"node {self.id} did not receive log entry {seq}")

    # -------------------------------------------------------------- given: the unsafe way

    def claim_naive(self, name: str, owner: str) -> bool:
        """Check the local (possibly stale) state; if free, append the claim and report success."""
        with self.cond:
            taken = name in self.owners
        if taken:
            return False
        self.log.append("claim", name, owner, self.id)
        return True

    # -------------------------------------------------------------- your work

    def claim_via_log(self, name: str, owner: str) -> bool:
        # TODO 1: append a 'claim' message (self.log.append returns its sequence number), wait until THIS
        #         node has applied it (self.wait_until_applied), then report whether the owner recorded for
        #         `name` (by the first claim in the log) is `owner`.
        raise NotImplementedError

    def read_local(self, name: str) -> str | None:
        with self.cond:
            return self.owners.get(name)

    def read_synced(self, name: str) -> str | None:
        # TODO 2: append a 'marker' message, wait until this node has applied it, then read locally.
        #         The marker's position in the log is the point in time at which the read happens.
        raise NotImplementedError

    def stop(self) -> None:
        self.stopped = True


def contest(method: str, n_names: int = 40, n_nodes: int = 3, lag: float = 0.004, seed: int = 1):
    """For each name, two users on different nodes claim it at the same moment.
    Returns (names where BOTH users were told 'success', names where the nodes' final states disagree
    with the users' answers)."""
    log = Log()
    nodes = [Node(i, log, lag, seed * 100 + i) for i in range(n_nodes)]
    rnd = random.Random(seed)
    double = 0
    wrong = 0
    for k in range(n_names):
        name = f"user{k}"
        a, b = rnd.sample(range(n_nodes), 2)
        results: dict[str, bool] = {}
        barrier = threading.Barrier(2)

        errors: list[BaseException] = []

        def go(node: Node, who: str):
            barrier.wait()
            try:
                results[who] = getattr(node, method)(name, who)
            except BaseException as e:   # surface errors from the threads (e.g. an unfinished TODO)
                errors.append(e)

        ts = [threading.Thread(target=go, args=(nodes[a], "alice")), threading.Thread(target=go, args=(nodes[b], "bob"))]
        for t in ts:
            t.start()
        for t in ts:
            t.join()
        if errors:
            raise errors[0]
        if results["alice"] and results["bob"]:
            double += 1
        # after everything is delivered, who really owns it?
        last = len(log.entries) - 1
        for nd in nodes:
            nd.wait_until_applied(last)
        owner = nodes[0].read_local(name)
        if any(results[w] != (owner == w) for w in ("alice", "bob")):
            wrong += 1
    for nd in nodes:
        nd.stop()
    return double, wrong


def stale_reads(synced: bool, trials: int = 30, lag: float = 0.01, seed: int = 3) -> int:
    """Alice claims a name via node 0 and is told 'success'; immediately afterwards she reads it via node 2.
    Count how often the read does NOT show her as the owner."""
    log = Log()
    nodes = [Node(i, log, lag, seed * 10 + i) for i in range(3)]
    stale = 0
    for k in range(trials):
        name = f"n{k}"
        assert nodes[0].claim_via_log(name, "alice")
        got = nodes[2].read_synced(name) if synced else nodes[2].read_local(name)
        if got != "alice":
            stale += 1
    for nd in nodes:
        nd.stop()
    return stale


if __name__ == "__main__":
    for method in ("claim_naive", "claim_via_log"):
        d, w = contest(method)
        print(f"{method:<14}: {d:>2} of 40 names given to BOTH users; {w:>2} names where a user was told the wrong answer")
    print(f"read right after a successful claim, on another node: local read stale {stale_reads(False)}/30 times, "
          f"synced read stale {stale_reads(True)}/30 times")
