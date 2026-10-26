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
        # TODO: sender = sender_epoch or e.epoch; reject sender < self.epoch (StaleEpoch); require
        #       e.seq == last_seq + 1 (else ValueError); adopt the sender's epoch; append to the log; apply to the store.
        raise NotImplementedError


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
        # TODO: NotLeader unless node.up and node.believes_leader; Entry(last_seq + 1, node.epoch, ...);
        #       node.apply(e); if semi_sync, _send to the first reachable follower (none -> RuntimeError).
        raise NotImplementedError

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
        # TODO: majority check; max by last_seq; self.epoch += 1; self.leader = it; for reachable nodes set
        #       .epoch = self.epoch and .believes_leader = (node is the winner). Isolated nodes learn nothing!
        raise NotImplementedError

    def zombie_push(self, name: str, to: str) -> int:
        """The (reconnected but not yet recovered) old leader tries to replicate its log to another node."""
        return self._send(self.nodes[name], self.nodes[to])

    def recover(self, name: str) -> int:
        """Node `name` rejoins (from a crash or a partition). It adopts the current epoch, stops believing it leads
        unless it is the leader, discards log entries that the leader's log doesn't have at the same position
        (writes that were never replicated), rebuilds its store from the surviving log if anything was discarded, and
        catches up. Returns the number of discarded entries."""
        # TODO: longest common prefix with the leader's log (compare seq, epoch, key, value); truncate; if
        #       truncated, rebuild the store from the remaining log; set epoch and believes_leader; catch up via _send.
        raise NotImplementedError
