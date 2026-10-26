"""Reference solution for exercise 02. Run: python practice/_solutions/02-timeline-fanout/solution.py"""
import heapq
import importlib.util
import pathlib

spec = importlib.util.spec_from_file_location(
    "timelines", pathlib.Path(__file__).resolve().parents[2] / "02-timeline-fanout" / "timelines.py")
tl = importlib.util.module_from_spec(spec)
spec.loader.exec_module(tl)


class PushTimelines(tl.PushTimelines):
    def post(self, user, tweet_id, seq):
        self.c.write_ops += 1                      # the tweet itself
        for f in self.followers[user]:
            self.cache[f].append((seq, tweet_id))
            self.c.write_ops += 1

    def read(self, user):
        self.c.read_ops += 1
        return [tid for _, tid in reversed(self.cache[user][-tl.TIMELINE_LEN:])]


class HybridTimelines(tl.HybridTimelines):
    def post(self, user, tweet_id, seq):
        self.tweets_by[user].append((seq, tweet_id))
        self.c.write_ops += 1
        if self.is_celebrity(user):
            return
        for f in self.followers[user]:
            self.cache[f].append((seq, tweet_id))
            self.c.write_ops += 1

    def read(self, user):
        self.c.read_ops += 1
        lists = [self.cache[user][-tl.TIMELINE_LEN:]]
        for f in self.follows[user]:
            if self.is_celebrity(f):
                self.c.read_ops += 1
                lists.append(self.tweets_by[f][-tl.TIMELINE_LEN:])
        return [tid for _, tid in heapq.nlargest(tl.TIMELINE_LEN, (t for l in lists for t in l))]


if __name__ == "__main__":
    follows = tl.build_graph()
    followers = tl.followers_index(follows)
    events = tl.build_workload(len(follows))
    base = None
    for name, cls in [("pull", tl.PullTimelines), ("push", PushTimelines), ("hybrid", HybridTimelines)]:
        c, worst, secs, sample = tl.run(cls, follows, followers, events)
        same = base is None or sample == base
        base = base or sample
        print(f"{name:>7}: write={c.write_ops:,} read={c.read_ops:,} worst_post={worst:,} t={secs:.2f}s match={same}")
