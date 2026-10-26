"""MiniKV milestones 3 and 4 - leader-based replication, failover, epochs and fencing (Chapters 5, 8 and 9).

A ReplicaSet holds one partition's data on several Nodes. One node is the leader for the current EPOCH. The leader
assigns every write a sequence number, appends it to its replication log and applies it to its store. Followers PULL
entries after their last sequence number and apply them in order (asynchronous replication, Chapter 5).

Network model (simulated): a node can be DOWN (crashed) or ISOLATED (alive but cut off by a network partition).
An isolated leader keeps BELIEVING it is the leader - it doesn't know it has been cut off (Chapter 8).

M3: write (async or semi-synchronous), replicate, reads from any node (followers may be stale).
M4: failover. elect() picks the most up-to-date reachable node as leader with epoch + 1 (a stand-in for a
    consensus-based election, which needs a majority, Chapter 9). Every log entry carries its epoch, and nodes reject
    entries from an epoch older than their own (fencing). A deposed "zombie" leader may still acknowledge writes
    while isolated; those writes are rejected by others and discarded when it rejoins (Chapter 5's lost writes).
"""
from __future__ import annotations

import os
from dataclasses import dataclass, field

from storage import LSMStore


class NotLeader(Exception):
    pass


class StaleEpoch(Exception):
    """Fencing: a log entry from an older epoch was rejected."""


@dataclass
class Entry:
    seq: int
    epoch: int
    key: str
    value: str | None


@dataclass
class Node:
    name: str
    store: LSMStore
    log: list[Entry] = field(default_factory=list)
    epoch: int = 1
    believes_leader: bool = False
    up: bool = True
    isolated: bool = False

    @property
    def last_seq(self) -> int:
        return self.log[-1].seq if self.log else 0

    @property
    def reachable(self) -> bool:
        return self.up and not self.isolated

    def apply(self, e: Entry, sender_epoch: int | None = None) -> None:
        """Append and apply one entry sent by a leader whose current epoch is sender_epoch (default: e.epoch).
        Fencing checks the SENDER's epoch: a new leader may legitimately ship entries written in an older epoch to a
        lagging follower, but a deposed leader (older sender epoch) must be rejected."""
        sender = e.epoch if sender_epoch is None else sender_epoch
        if sender < self.epoch:
            raise StaleEpoch(f"{self.name}: sender epoch {sender} < current epoch {self.epoch}")
        if e.seq != self.last_seq + 1:
            raise ValueError(f"{self.name}: gap - expected seq {self.last_seq + 1}, got {e.seq}")
        self.epoch = sender
        self.log.append(e)
        if e.value is None:
            self.store.delete(e.key)
        else:
            self.store.put(e.key, e.value)


class ReplicaSet:
    def __init__(self, directory: str, names=("n1", "n2", "n3"), memtable_limit: int = 32):
        self.nodes = {n: Node(n, LSMStore(os.path.join(directory, n), memtable_limit)) for n in names}
        self.leader = names[0]
        self.nodes[self.leader].believes_leader = True
        self.epoch = 1

    def followers(self) -> list[str]:
        return [n for n in self.nodes if n != self.leader]

    def close(self) -> None:
        for n in self.nodes.values():
            n.store.close()

    # ------------------------------------------------------------------ M3: replication
    def write(self, key: str, value: str | None, via: str | None = None, semi_sync: bool = False) -> int:
        """A client writes through node `via` (default: the current leader). The node accepts the write if it is up and
        BELIEVES it is the leader - even a zombie leader does, which is exactly the danger. The write is appended to its
        log with the node's epoch and applied locally, then acknowledged. With semi_sync, it must first reach at least one
        reachable follower (else RuntimeError). Returns the sequence number."""
        node = self.nodes[via or self.leader]
        if not node.up or not node.believes_leader:
            raise NotLeader(f"{node.name} does not accept writes")
        e = Entry(node.last_seq + 1, node.epoch, key, value)
        node.apply(e)
        if semi_sync:
            for f in (n for n in self.nodes.values() if n is not node and n.reachable and not node.isolated):
                self._send(node, f)
                break
            else:
                raise RuntimeError("semi-sync write: no reachable follower acknowledged it")
        return e.seq

    def _send(self, leader: Node, follower: Node) -> int:
        """Ship every entry the follower is missing; the follower's apply() enforces fencing."""
        todo = [e for e in leader.log if e.seq > follower.last_seq]
        for e in todo:
            follower.apply(e, sender_epoch=leader.epoch)
        return len(todo)

    def replicate(self) -> int:
        """Asynchronous catch-up: every reachable follower pulls what it's missing from the (reachable) leader."""
        leader = self.nodes[self.leader]
        if not leader.reachable:
            return 0
        return sum(self._send(leader, self.nodes[f]) for f in self.followers() if self.nodes[f].reachable)

    def read(self, key: str, node: str | None = None) -> str | None:
        return self.nodes[node or self.leader].store.get(key)

    # ------------------------------------------------------------------ M4: failover
    def fail(self, name: str) -> None:
        self.nodes[name].up = False

    def isolate(self, name: str) -> None:
        self.nodes[name].isolated = True

    def elect(self) -> str:
        """Election among REACHABLE nodes. Requires a strict majority of all nodes to be reachable (RuntimeError
        otherwise). Picks the reachable node with the highest last_seq, increments the epoch, makes it the only
        reachable node that believes it leads, and gives every reachable node the new epoch. Returns the new leader."""
        reachable = [n for n in self.nodes.values() if n.reachable]
        if len(reachable) * 2 <= len(self.nodes):
            raise RuntimeError("no majority reachable: cannot elect safely")
        best = max(reachable, key=lambda n: n.last_seq)
        self.epoch += 1
        self.leader = best.name
        for n in reachable:
            n.epoch = self.epoch
            n.believes_leader = n is best
        return best.name

    def zombie_push(self, name: str, to: str) -> int:
        """The (reconnected but not yet recovered) old leader tries to replicate its log to another node."""
        return self._send(self.nodes[name], self.nodes[to])

    def recover(self, name: str) -> int:
        """Node `name` rejoins (from a crash or a partition). It adopts the current epoch, stops believing it leads
        unless it is the leader, discards log entries that the leader's log doesn't have at the same position
        (writes that were never replicated), rebuilds its store from the surviving log if anything was discarded, and
        catches up. Returns the number of discarded entries."""
        node = self.nodes[name]
        node.up, node.isolated = True, False
        leader = self.nodes[self.leader]
        common = 0
        for mine, theirs in zip(node.log, leader.log):
            if (mine.seq, mine.epoch, mine.key, mine.value) != (theirs.seq, theirs.epoch, theirs.key, theirs.value):
                break
            common += 1
        discarded = len(node.log) - common
        if discarded:
            node.log = node.log[:common]
            for k, _ in node.store.scan():
                node.store.delete(k)
            for e in node.log:
                if e.value is None:
                    node.store.delete(e.key)
                else:
                    node.store.put(e.key, e.value)
        node.epoch = self.epoch
        node.believes_leader = name == self.leader
        if name != self.leader:
            self._send(leader, node)
        return discarded
