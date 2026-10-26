"""Lab 34 - two-phase commit with crash recovery (pp. 343-354).

A bank keeps accounts on two "database nodes" (participants). A transfer moves money between nodes in one
distributed transaction. Every participant and the coordinator keep a durable log (a JSON-lines file);
"crashing" a component throws away everything in memory and rebuilds it from its log.

  TODO 1  Participant.prepare   - make the transaction durable, check constraints, vote; a YES is a promise
  TODO 2  Coordinator.commit    - phase 1, the commit point (decision in the coordinator log), phase 2
  TODO 3  Coordinator.recover   - resolve in-doubt transactions from the coordinator log
  TODO 4  Participant.recover   - rebuild state after a crash: prepared transactions stay in doubt AND keep locks

Crash points are injected with `crash_at`, which makes the coordinator raise `Crash` at that moment.
"""
from __future__ import annotations

import json
import os
from dataclasses import dataclass, field


class Crash(Exception):
    """Simulated process crash."""


class Blocked(Exception):
    """A row is locked by another (possibly in-doubt) transaction."""


def append_record(path: str, record: dict) -> None:
    with open(path, "a", encoding="utf-8") as f:
        f.write(json.dumps(record) + "\n")
        f.flush()
        os.fsync(f.fileno())          # durable before we continue (this is much of 2PC's cost, p. 350)


def read_records(path: str) -> list[dict]:
    if not os.path.exists(path):
        return []
    with open(path, encoding="utf-8") as f:
        return [json.loads(line) for line in f if line.strip()]


@dataclass
class Participant:
    name: str
    dir: str
    balances: dict[str, int] = field(default_factory=dict)
    pending: dict[str, dict[str, int]] = field(default_factory=dict)  # txid -> {account: delta}
    state: dict[str, str] = field(default_factory=dict)               # txid -> active|prepared|committed|aborted
    locks: dict[str, str] = field(default_factory=dict)               # account -> txid holding its lock

    @property
    def log(self) -> str:
        return os.path.join(self.dir, f"{self.name}.log")

    def open_accounts(self, accounts: dict[str, int]) -> None:
        self.balances.update(accounts)
        append_record(self.log, {"type": "init", "balances": accounts})

    # ---- phase 0: the transaction's reads and writes (single-node transaction tagged with the global txid)
    def write(self, txid: str, account: str, delta: int) -> None:
        holder = self.locks.get(account)
        if holder is not None and holder != txid:
            raise Blocked(f"{self.name}: {account} is locked by {holder} ({self.state.get(holder)})")
        self.locks[account] = txid
        self.state.setdefault(txid, "active")
        self.pending.setdefault(txid, {})
        self.pending[txid][account] = self.pending[txid].get(account, 0) + delta

    def read(self, account: str, txid: str | None = None) -> int:
        holder = self.locks.get(account)
        if holder is not None and holder != txid:
            raise Blocked(f"{self.name}: {account} is locked by {holder} ({self.state.get(holder)})")
        return self.balances[account] + (self.pending.get(txid, {}).get(account, 0) if txid else 0)

    # ---- phase 1
    def prepare(self, txid: str) -> bool:
        """Vote YES only if this node can definitely commit later, whatever happens (crash, power loss)."""
        # TODO 1 (solution)
        if self.state.get(txid) != "active":
            return False
        changes = self.pending.get(txid, {})
        if any(self.balances[a] + d < 0 for a, d in changes.items()):        # constraint: no negative balances
            self.abort(txid)
            return False
        append_record(self.log, {"type": "prepared", "txid": txid, "changes": changes})
        self.state[txid] = "prepared"
        return True

    # ---- phase 2
    def commit(self, txid: str) -> None:
        if self.state.get(txid) == "committed":
            return                                                            # retries must be harmless
        for a, d in self.pending.get(txid, {}).items():
            self.balances[a] += d
        append_record(self.log, {"type": "commit", "txid": txid})
        self._finish(txid, "committed")

    def abort(self, txid: str) -> None:
        if self.state.get(txid) in ("aborted", None):
            self.state[txid] = "aborted"
            self._release(txid)
            return
        append_record(self.log, {"type": "abort", "txid": txid})
        self._finish(txid, "aborted")

    def _finish(self, txid: str, outcome: str) -> None:
        self.state[txid] = outcome
        self.pending.pop(txid, None)
        self._release(txid)

    def _release(self, txid: str) -> None:
        for a in [a for a, t in self.locks.items() if t == txid]:
            del self.locks[a]

    def in_doubt(self) -> list[str]:
        return [t for t, s in self.state.items() if s == "prepared"]

    # ---- crash and recovery
    def crash(self) -> None:
        self.balances, self.pending, self.state, self.locks = {}, {}, {}, {}

    def recover(self) -> None:
        """Rebuild everything from the participant's own log.
        Transactions that were active (never prepared) are simply gone: they can be aborted.
        Prepared ones are in doubt: keep their changes pending AND re-acquire their locks (p. 353)."""
        # TODO 4 (solution)
        self.crash()
        for r in read_records(self.log):
            if r["type"] == "init":
                self.balances.update(r["balances"])
            elif r["type"] == "prepared":
                self.state[r["txid"]] = "prepared"
                self.pending[r["txid"]] = dict(r["changes"])
                for a in r["changes"]:
                    self.locks[a] = r["txid"]
            elif r["type"] == "commit":
                for a, d in self.pending.get(r["txid"], {}).items():
                    self.balances[a] += d
                self._finish(r["txid"], "committed")
            elif r["type"] == "abort":
                self._finish(r["txid"], "aborted")


@dataclass
class Coordinator:
    dir: str
    participants: dict[str, Participant]
    crash_at: str | None = None        # 'after_prepare_sent' | 'before_decision' | 'after_decision' | 'after_first_commit'

    @property
    def log(self) -> str:
        return os.path.join(self.dir, "coordinator.log")

    def _maybe_crash(self, point: str) -> None:
        if self.crash_at == point:
            raise Crash(point)

    def commit(self, txid: str, involved: list[str]) -> str:
        """Run 2PC for txid over the named participants. Returns 'committed' or 'aborted'."""
        # TODO 2 (solution)
        append_record(self.log, {"type": "begin", "txid": txid, "participants": involved})
        votes = []
        for i, name in enumerate(involved):
            votes.append(self.participants[name].prepare(txid))
            if i == 0:
                self._maybe_crash("after_prepare_sent")
        self._maybe_crash("before_decision")
        decision = "commit" if all(votes) else "abort"
        append_record(self.log, {"type": decision, "txid": txid})       # the commit point
        self._maybe_crash("after_decision")
        for i, name in enumerate(involved):
            p = self.participants[name]
            p.commit(txid) if decision == "commit" else p.abort(txid)
            if i == 0:
                self._maybe_crash("after_first_commit")
        return "committed" if decision == "commit" else "aborted"

    def recover(self) -> dict[str, str]:
        """After a coordinator crash: read the log and drive every unfinished transaction to its outcome.
        A decision in the log must be enforced; no decision means abort (p. 349). Returns {txid: outcome}."""
        # TODO 3 (solution)
        begun: dict[str, list[str]] = {}
        decided: dict[str, str] = {}
        for r in read_records(self.log):
            if r["type"] == "begin":
                begun[r["txid"]] = r["participants"]
            elif r["type"] in ("commit", "abort"):
                decided[r["txid"]] = r["type"]
        out = {}
        for txid, names in begun.items():
            decision = decided.get(txid, "abort")
            if txid not in decided:
                append_record(self.log, {"type": "abort", "txid": txid})
            for n in names:
                p = self.participants[n]
                p.commit(txid) if decision == "commit" else p.abort(txid)
            out[txid] = "committed" if decision == "commit" else "aborted"
        return out


def heuristic_abort(p: Participant, txid: str) -> None:
    """An operator's 'heuristic decision' (p. 353): unilaterally abort an in-doubt transaction.
    Given here so the tests can show what it does to atomicity."""
    append_record(p.log, {"type": "abort", "txid": txid})
    p._finish(txid, "aborted")


def make_bank(directory: str) -> tuple[Participant, Participant]:
    a = Participant("db1", directory)
    b = Participant("db2", directory)
    a.open_accounts({"alice": 100})
    b.open_accounts({"bob": 100})
    return a, b


def transfer(coord: Coordinator, txid: str, amount: int) -> str:
    """alice (on db1) pays bob (on db2)."""
    db1, db2 = coord.participants["db1"], coord.participants["db2"]
    db1.write(txid, "alice", -amount)
    db2.write(txid, "bob", +amount)
    return coord.commit(txid, ["db1", "db2"])


if __name__ == "__main__":
    import tempfile
    with tempfile.TemporaryDirectory() as d:
        db1, db2 = make_bank(d)
        c = Coordinator(d, {"db1": db1, "db2": db2}, crash_at="after_first_commit")
        try:
            transfer(c, "tx1", 30)
        except Crash as e:
            print(f"coordinator crashed at {e}: db1 = {db1.state['tx1']}, db2 = {db2.state['tx1']} (in doubt: {db2.in_doubt()})")
        try:
            db2.read("bob")
        except Blocked as e:
            print("another transaction tries to read bob:", e)
        c.crash_at = None
        print("coordinator recovers:", c.recover(), "-> balances", db1.balances, db2.balances)
