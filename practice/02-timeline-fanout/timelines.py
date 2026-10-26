"""
Exercise 02 — Describing load: Twitter's home timelines.

Implement fan-out-on-write and a hybrid, then compare them with query-on-read
on a synthetic social graph with a realistic (very skewed) follower distribution.

Run:  python practice/02-timeline-fanout/timelines.py
"""
import heapq
import random
import time
from collections import defaultdict

TIMELINE_LEN = 20


def build_graph(n_users=20_000, avg_followees=40, seed=1):
    """Returns follows[user] = set of followees. Popularity follows a power law (a few celebrities)."""
    rand = random.Random(seed)
    users = list(range(n_users))
    weights = [1 / (rank + 1) ** 1.05 for rank in range(n_users)]  # user 0 is the most popular
    follows = {}
    for u in users:
        k = max(1, int(rand.expovariate(1 / avg_followees)))
        chosen = set(rand.choices(users, weights=weights, k=k))
        chosen.discard(u)
        follows[u] = chosen
    return follows


def followers_index(follows):
    followers = defaultdict(set)
    for u, fs in follows.items():
        for f in fs:
            followers[f].add(u)
    return followers


def build_workload(n_users, n_events=60_000, read_write_ratio=65, seed=2):
    """A mix of ('post', user) and ('read', user). Twitter 2012: 300k reads/s vs 4.6k writes/s ≈ 65:1."""
    rand = random.Random(seed)
    events = []
    for _ in range(n_events):
        if rand.random() < 1 / (read_write_ratio + 1):
            events.append(("post", rand.randrange(n_users)))
        else:
            events.append(("read", rand.randrange(n_users)))
    return events


class Counter:
    def __init__(self):
        self.write_ops = 0   # rows written (tweet table + timeline caches)
        self.read_ops = 0    # lists looked up while serving reads


# ---------------------------------------------------------------------------
# Approach 1 (given): query on read. Posting is cheap; reading merges every followee's tweets.
# ---------------------------------------------------------------------------
class PullTimelines:
    def __init__(self, follows, followers, c: Counter):
        self.follows, self.c = follows, c
        self.tweets_by = defaultdict(list)          # user -> [(seq, tweet_id)]

    def post(self, user, tweet_id, seq):
        self.tweets_by[user].append((seq, tweet_id))
        self.c.write_ops += 1

    def read(self, user):
        lists = []
        for f in self.follows[user]:
            self.c.read_ops += 1
            lists.append(self.tweets_by[f][-TIMELINE_LEN:])
        merged = heapq.nlargest(TIMELINE_LEN, (t for l in lists for t in l))
        return [tid for _, tid in merged]


# ---------------------------------------------------------------------------
# Approach 2 (YOUR TASK): fan-out on write.
# post(): store the tweet AND append it to the home-timeline cache of every follower
#         (count one write op per cache insert, plus one for the tweet itself).
# read(): return the newest TIMELINE_LEN tweet ids from the user's own cache (one read op).
# ---------------------------------------------------------------------------
class PushTimelines:
    def __init__(self, follows, followers, c: Counter):
        self.followers, self.c = followers, c
        self.cache = defaultdict(list)              # user -> [(seq, tweet_id)]

    def post(self, user, tweet_id, seq):
        raise NotImplementedError

    def read(self, user):
        raise NotImplementedError


# ---------------------------------------------------------------------------
# Approach 3 (YOUR TASK): hybrid.
# Users with more than `celebrity_threshold` followers are NOT fanned out; their tweets are
# fetched at read time and merged with the user's cache (like Approach 1, but only for celebrities).
# ---------------------------------------------------------------------------
class HybridTimelines:
    def __init__(self, follows, followers, c: Counter, celebrity_threshold=1000):
        self.follows, self.followers, self.c = follows, followers, c
        self.threshold = celebrity_threshold
        self.cache = defaultdict(list)
        self.tweets_by = defaultdict(list)

    def is_celebrity(self, user):
        return len(self.followers[user]) > self.threshold

    def post(self, user, tweet_id, seq):
        raise NotImplementedError

    def read(self, user):
        raise NotImplementedError


# ---------------------------------------------------------------------------
# Harness — do not change.
# ---------------------------------------------------------------------------
def run(cls, follows, followers, events, **kw):
    c = Counter()
    impl = cls(follows, followers, c, **kw)
    worst_post = 0
    sample_reads = {}
    t0 = time.perf_counter()
    for seq, (kind, user) in enumerate(events):
        if kind == "post":
            before = c.write_ops
            impl.post(user, f"t{seq}", seq)
            worst_post = max(worst_post, c.write_ops - before)
        else:
            result = impl.read(user)
            if user % 97 == 0:
                sample_reads[(seq, user)] = result
    return c, worst_post, time.perf_counter() - t0, sample_reads


if __name__ == "__main__":
    print("Building graph and workload...")
    follows = build_graph()
    followers = followers_index(follows)
    events = build_workload(len(follows))
    counts = sorted((len(v) for v in followers.values()), reverse=True)
    print(f"users={len(follows):,}  most-followed has {counts[0]:,} followers, "
          f"median user has {counts[len(counts)//2]} followers")
    posts = sum(1 for e in events if e[0] == "post")
    print(f"events={len(events):,} ({posts:,} posts, {len(events)-posts:,} timeline reads)\n")

    baseline = None
    for name, cls in [("1 query-on-read", PullTimelines), ("2 fan-out-on-write", PushTimelines), ("3 hybrid", HybridTimelines)]:
        try:
            c, worst, secs, sample = run(cls, follows, followers, events)
        except NotImplementedError:
            print(f"{name:>20}: not implemented yet")
            continue
        ok = "" if baseline is None else ("  results match approach 1" if sample == baseline else "  RESULTS DIFFER from approach 1!")
        baseline = baseline or sample
        print(f"{name:>20}: write ops={c.write_ops:>9,}  read ops={c.read_ops:>9,}  "
              f"worst single post={worst:>6,} writes  time={secs:.2f}s{ok}")
