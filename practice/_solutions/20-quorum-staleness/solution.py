"""Reference solution for exercise 20. Run: python practice/_solutions/20-quorum-staleness/solution.py"""
import importlib.util
import pathlib

spec = importlib.util.spec_from_file_location(
    "staleness", pathlib.Path(__file__).resolve().parents[2] / "20-quorum-staleness" / "staleness.py")
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)


def trial(n, w, r, read_after_ms, rand, mean_delay=m.MEAN_DELAY_MS, p_down=0.0):
    # 1. the write reaches each replica after a random delay (or never, if that replica is down)
    arrive = []
    for _ in range(n):
        arrive.append(None if rand.random() < p_down else rand.expovariate(1 / mean_delay))
    acks = sorted(a + rand.expovariate(1 / mean_delay) for a in arrive if a is not None)
    if len(acks) < w:
        return False, None
    commit = acks[w - 1]                      # client is told "success" when the w-th ack arrives
    # 2. the read starts read_after_ms after the commit; each up replica answers after a random delay
    start = commit + read_after_ms
    replies = []
    for a in arrive:
        if a is None:
            continue
        req_arrives = start + rand.expovariate(1 / mean_delay)
        has_new = a <= req_arrives
        replies.append((req_arrives + rand.expovariate(1 / mean_delay), has_new))
    if len(replies) < r:
        return True, None
    first_r = sorted(replies)[:r]
    return True, not any(has for _, has in first_r)


m.trial = trial
src = pathlib.Path(m.__file__).read_text(encoding="utf-8").split('if __name__ == "__main__":', 1)[1]
exec("if True:" + src, vars(m))
