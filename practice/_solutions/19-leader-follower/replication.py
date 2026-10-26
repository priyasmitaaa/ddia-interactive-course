"""
Reference solution for exercise 19: leader-based replication on a simulated network.

Pieces given in the starter (unchanged here): Sim (discrete-event scheduler), Network (delays,
node up/down), message tuples. Implemented here: Leader, Follower, Client.read logic, failover.
"""
import heapq
import itertools
import random


class Sim:
    """A tiny discrete-event simulator: schedule(callback, at=time). Time is in milliseconds."""

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
    """Delivers messages between named nodes after a per-link delay. Messages to/from a down node are dropped."""

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


# Messages are plain tuples:
#   ("replicate", lsn, entry)       leader -> follower: log entry at position lsn (0-based)
#   ("ack", lsn)                    follower -> leader: I have applied everything up to and including lsn
#   ("catchup", from_lsn)           follower -> leader: please resend everything from from_lsn


class Leader:
    def __init__(self, name, net, followers, sync_followers=()):
        self.name, self.net = name, net
        self.log: list[tuple] = []            # entries: (key, value)
        self.data: dict = {}
        self.followers = list(followers)
        self.sync = set(sync_followers)
        self.acked_by: dict[str, int] = {f: -1 for f in self.followers}
        self.waiting: list[tuple[int, object]] = []    # (lsn, callback) for writes awaiting sync acks

    def write(self, key, value, on_ack):
        lsn = len(self.log)
        self.log.append((key, value))
        self.data[key] = value
        for f in self.followers:
            self.net.send(self.name, f, ("replicate", lsn, (key, value)))
        if not self.sync:
            on_ack(lsn)
        else:
            self.waiting.append((lsn, on_ack))
        return lsn

    def receive(self, src, msg):
        if msg[0] == "ack":
            self.acked_by[src] = max(self.acked_by[src], msg[1])
            still = []
            for lsn, cb in self.waiting:
                if all(self.acked_by[f] >= lsn for f in self.sync):
                    cb(lsn)
                else:
                    still.append((lsn, cb))
            self.waiting = still
        elif msg[0] == "catchup":
            for lsn in range(msg[1], len(self.log)):
                self.net.send(self.name, src, ("replicate", lsn, self.log[lsn]))


class Follower:
    def __init__(self, name, net, leader_name):
        self.name, self.net, self.leader = name, net, leader_name
        self.log: list[tuple] = []
        self.data: dict = {}

    @property
    def applied_lsn(self):
        return len(self.log) - 1

    def receive(self, src, msg):
        if msg[0] == "replicate":
            lsn, (k, v) = msg[1], msg[2]
            if lsn == len(self.log):          # apply strictly in log order
                self.log.append((k, v))
                self.data[k] = v
                self.net.send(self.name, self.leader, ("ack", lsn))
            elif lsn > len(self.log):         # a gap: we missed something; ask for it
                self.net.send(self.name, self.leader, ("catchup", len(self.log)))
            # lsn < len(log): duplicate, ignore

    def reconnect(self):
        self.net.send(self.name, self.leader, ("catchup", len(self.log)))


class Client:
    """Reads from a follower, but can enforce read-your-writes using the LSN of its last write."""

    def __init__(self, leader, followers):
        self.leader, self.followers = leader, followers
        self.last_write_lsn = -1

    def write(self, key, value, on_ack=lambda lsn: None):
        def acked(lsn):
            self.last_write_lsn = max(self.last_write_lsn, lsn)
            on_ack(lsn)
        return self.leader.write(key, value, acked)

    def read(self, key, follower, read_your_writes=False):
        """Returns (value, served_by)."""
        if read_your_writes and follower.applied_lsn < self.last_write_lsn:
            return self.leader.data.get(key), "leader"
        return follower.data.get(key), follower.name


def failover(followers, acknowledged: list[tuple]):
    """Promote the follower with the most data. Return (new_leader_follower, lost) where lost is the
    list of acknowledged (key, value) writes missing from the new leader's log."""
    best = max(followers, key=lambda f: f.applied_lsn)
    have = set(best.log)
    lost = [w for w in acknowledged if w not in have]
    return best, lost
