"""
Exercise 19 — Lab: leader-based replication on a simulated network (book pp. 146-161).

GIVEN: Sim (a discrete-event scheduler) and Network (per-node delays, nodes can be "down").
YOU WRITE: Leader, Follower, Client.read, failover.

Messages are plain tuples:
    ("replicate", lsn, entry)    leader -> follower: the log entry at position lsn (0-based); entry = (key, value)
    ("ack", lsn)                 follower -> leader: I have applied everything up to and including lsn
    ("catchup", from_lsn)        follower -> leader: please resend everything from position from_lsn

Run the tests:  python practice/19-leader-follower/test_replication.py
"""
import heapq
import itertools
import random


class Sim:
    """A tiny discrete-event simulator. Time is in milliseconds.
    schedule(delay, fn, *args) runs fn(*args) at now + delay; run(until) processes events in time order."""

    def __init__(self):
        self.now = 0.0
        self._q = []
        self._seq = itertools.count()

    def schedule(self, delay, fn, *args):
        heapq.heappush(self._q, (self.now + delay, next(self._seq), fn, args))

    def run(self, until=float("inf")):
        while self._q and self._q[0][0] <= until:
            t, _, fn, args = heapq.heappop(self._q)
            self.now = t
            fn(*args)
        self.now = max(self.now, until if until != float("inf") else self.now)


class Network:
    """Delivers messages after delay(src) + delay(dst) (+ up to 2 ms jitter).
    If either node is down when a message is sent OR delivered, the message is silently lost."""

    def __init__(self, sim, seed=0):
        self.sim, self.nodes, self.delay, self.up = sim, {}, {}, {}
        self.rand = random.Random(seed)

    def add(self, name, node, delay_ms=10):
        self.nodes[name], self.delay[name], self.up[name] = node, delay_ms, True

    def send(self, src, dst, msg):
        if not (self.up.get(src) and self.up.get(dst)):
            return
        d = self.delay[src] + self.delay[dst] + self.rand.uniform(0, 2)
        self.sim.schedule(d, self._deliver, src, dst, msg)

    def _deliver(self, src, dst, msg):
        if self.up.get(dst) and self.up.get(src):
            self.nodes[dst].receive(src, msg)


class Leader:
    def __init__(self, name, net, followers, sync_followers=()):
        self.name, self.net = name, net
        self.log: list[tuple] = []            # entries (key, value); position in the list = LSN
        self.data: dict = {}
        self.followers = list(followers)       # follower names
        self.sync = set(sync_followers)        # names of synchronous followers
        self.acked_by: dict[str, int] = {f: -1 for f in self.followers}   # highest LSN each follower acked
        self.waiting: list[tuple[int, object]] = []                        # (lsn, on_ack) awaiting sync acks

    def write(self, key, value, on_ack):
        """TODO 1: append (key, value) to the log, apply it to self.data, send a "replicate" message to
        every follower. If there are no synchronous followers, call on_ack(lsn) immediately (async);
        otherwise remember (lsn, on_ack) in self.waiting. Return the lsn."""
        raise NotImplementedError

    def receive(self, src, msg):
        """TODO 2: on "ack": record it in acked_by, then call on_ack for every waiting write whose lsn has
        been acknowledged by ALL synchronous followers (remove it from waiting).
        TODO 3: on "catchup": resend every log entry from msg[1] to the end."""
        raise NotImplementedError


class Follower:
    def __init__(self, name, net, leader_name):
        self.name, self.net, self.leader = name, net, leader_name
        self.log: list[tuple] = []
        self.data: dict = {}

    @property
    def applied_lsn(self):
        return len(self.log) - 1

    def receive(self, src, msg):
        """TODO 2: on "replicate": if msg's lsn is exactly the next position, append + apply it and send
        ("ack", lsn) to the leader. If it's further ahead, there's a gap (we missed something while
        down): send ("catchup", next_position). If it's older, it's a duplicate: ignore it."""
        raise NotImplementedError

    def reconnect(self):
        """TODO 3: after an outage, ask the leader for everything from our next position."""
        raise NotImplementedError


class Client:
    def __init__(self, leader, followers):
        self.leader, self.followers = leader, followers
        self.last_write_lsn = -1

    def write(self, key, value, on_ack=lambda lsn: None):
        def acked(lsn):
            self.last_write_lsn = max(self.last_write_lsn, lsn)
            on_ack(lsn)
        return self.leader.write(key, value, acked)

    def read(self, key, follower, read_your_writes=False):
        """TODO 4: return (value, served_by). Normally read from the given follower.
        With read_your_writes=True: if that follower hasn't applied our last write yet
        (follower.applied_lsn < self.last_write_lsn), read from the leader instead (book p. 157)."""
        raise NotImplementedError


def failover(followers, acknowledged: list[tuple]):
    """TODO 5: promote the follower with the highest applied_lsn. Return (new_leader, lost) where lost
    lists the acknowledged (key, value) writes that are NOT in the new leader's log."""
    raise NotImplementedError
