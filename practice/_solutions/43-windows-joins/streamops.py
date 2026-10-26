"""Exercise 43 - event time, windows and stream joins (pp. 452-460).

Events arrive OUT OF ORDER: each has an event_time (when it happened) and is delivered in arrival order, with
variable delays and a few very late stragglers (think phones that were offline). We check every streaming result
against the "batch" answer computed from the complete, sorted data.

  TODO 1  tumbling_counts    - per-minute counts by EVENT time, emitted when the watermark passes the window end;
                               late events are counted as dropped (or, optionally, emitted as corrections)
  TODO 2  sessionize         - per-user session windows with an inactivity gap
  TODO 3  search_click_join  - stream-stream join: a click joins the search with the same session_id within 1 hour,
                               whichever of the two arrives first
  TODO 4  enrich_as_of       - stream-table join against a CHANGING table, made deterministic by joining with the
                               table version valid at the event's time
"""
from __future__ import annotations

import random
from collections import defaultdict


def make_events(n: int = 3000, seed: int = 4, late_fraction: float = 0.01) -> list[dict]:
    """Page-view events over ~50 minutes from 30 users; returned in ARRIVAL order."""
    rnd = random.Random(seed)
    evs = []
    t = 0.0
    for i in range(n):
        t += rnd.expovariate(1.0)                                   # ~1 event per second
        delay = rnd.uniform(0, 5)                                   # normal network/batching delay (s)
        if rnd.random() < late_fraction:
            delay += rnd.uniform(120, 900)                          # offline device, arrives minutes later
        evs.append({"id": i, "user": f"u{rnd.randrange(30)}", "event_time": t, "arrival": t + delay})
    return sorted(evs, key=lambda e: e["arrival"])


def batch_counts(events: list[dict], size: float = 60.0) -> dict[int, int]:
    out: dict[int, int] = defaultdict(int)
    for e in events:
        out[int(e["event_time"] // size)] += 1
    return dict(out)


def tumbling_counts(stream: list[dict], size: float = 60.0, lateness: float = 10.0, corrections: bool = False):
    """Process events in arrival order. Keep a count per window (window = floor(event_time / size)).
    watermark = (max event_time seen so far) - lateness. When the watermark passes a window's END, emit it.
    An event for an already-emitted window is late: if `corrections`, update and record (window, new_count) in
    corrections; otherwise drop it and count it. At the end of the stream, emit every remaining window.
    Returns (emitted: dict window -> count, dropped: int, corrections: list)."""
    # TODO 1 (solution)
    open_counts: dict[int, int] = defaultdict(int)
    emitted: dict[int, int] = {}
    corrections_out: list[tuple[int, int]] = []
    dropped = 0
    max_seen = float("-inf")
    for e in stream:
        w = int(e["event_time"] // size)
        if w in emitted:
            if corrections:
                emitted[w] += 1
                corrections_out.append((w, emitted[w]))
            else:
                dropped += 1
            continue
        open_counts[w] += 1
        max_seen = max(max_seen, e["event_time"])
        watermark = max_seen - lateness
        for win in sorted(k for k in open_counts if (k + 1) * size <= watermark):
            emitted[win] = open_counts.pop(win)
    for win, c in open_counts.items():
        emitted[win] = c
    return emitted, dropped, corrections_out


def sessionize(events: list[dict], gap: float = 30.0) -> dict[str, list[tuple[float, float, int]]]:
    """Per user, group events whose event_times are within `gap` seconds of the previous one into sessions.
    Returns user -> list of (start, end, number_of_events), in time order. (Sort by event time first: input is out of order.)"""
    # TODO 2 (solution)
    by_user: dict[str, list[float]] = defaultdict(list)
    for e in events:
        by_user[e["user"]].append(e["event_time"])
    out = {}
    for u, ts in by_user.items():
        ts.sort()
        sessions = []
        start = prev = ts[0]
        count = 1
        for t in ts[1:]:
            if t - prev <= gap:
                count += 1
            else:
                sessions.append((start, prev, count))
                start, count = t, 1
            prev = t
        sessions.append((start, prev, count))
        out[u] = sessions
    return out


def make_search_clicks(n: int = 400, seed: int = 9):
    """Searches and clicks keyed by session_id, in arrival order. ~60% of searches get a click, after 2 s to 2 h;
    because of network delays a click can arrive BEFORE its search."""
    rnd = random.Random(seed)
    out = []
    for i in range(n):
        t = rnd.uniform(0, 36000)
        sid = f"s{i}"
        out.append({"kind": "search", "session": sid, "event_time": t, "arrival": t + rnd.uniform(0, 30), "query": f"q{i % 17}"})
        if rnd.random() < 0.6:
            ct = t + rnd.choice([rnd.uniform(2, 120), rnd.uniform(2, 7200)])
            out.append({"kind": "click", "session": sid, "event_time": ct, "arrival": ct + rnd.uniform(-25, 5), "result": rnd.randrange(10)})
    return sorted(out, key=lambda e: e["arrival"])


def search_click_join(stream: list[dict], window: float = 3600.0) -> list[tuple[str, float]]:
    """Emit (session_id, seconds_from_search_to_click) for every click whose search (same session) happened at most
    `window` seconds earlier, no matter which of the two arrives first. Keep both sides in state indexed by session."""
    # TODO 3 (solution)
    searches: dict[str, dict] = {}
    pending_clicks: dict[str, list[dict]] = defaultdict(list)
    out = []

    def match(s, c):
        dt = c["event_time"] - s["event_time"]
        if 0 <= dt <= window:
            out.append((s["session"], dt))

    for e in stream:
        sid = e["session"]
        if e["kind"] == "search":
            searches[sid] = e
            for c in pending_clicks.pop(sid, []):
                match(e, c)
        else:
            if sid in searches:
                match(searches[sid], e)
            else:
                pending_clicks[sid].append(e)
    return sorted(out)


def batch_click_through(stream: list[dict], window: float = 3600.0) -> list[tuple[str, float]]:
    s = {e["session"]: e for e in stream if e["kind"] == "search"}
    out = []
    for c in (e for e in stream if e["kind"] == "click"):
        if c["session"] in s:
            dt = c["event_time"] - s[c["session"]]["event_time"]
            if 0 <= dt <= window:
                out.append((c["session"], dt))
    return sorted(out)


def enrich_naive(stream: list[dict], profile_changes: list[dict]) -> list[tuple[int, str]]:
    """Given: process events and profile changes interleaved by ARRIVAL, joining each event with whatever profile
    version happens to be loaded at that moment. The result depends on the interleaving (p. 459)."""
    merged = sorted([("event", e["arrival"], e) for e in stream] + [("change", c["arrival"], c) for c in profile_changes],
                    key=lambda x: x[1])
    current: dict[str, str] = {}
    out = []
    for kind, _, x in merged:
        if kind == "change":
            current[x["user"]] = x["country"]
        else:
            out.append((x["id"], current.get(x["user"], "?")))
    return sorted(out)


def enrich_as_of(stream: list[dict], profile_changes: list[dict]) -> list[tuple[int, str]]:
    """Join each event with the profile version that was valid at the event's EVENT TIME (the latest change with
    valid_from <= event_time), regardless of arrival order. Return sorted (event id, country)."""
    # TODO 4 (solution)
    versions: dict[str, list[tuple[float, str]]] = defaultdict(list)
    for c in profile_changes:
        versions[c["user"]].append((c["valid_from"], c["country"]))
    for v in versions.values():
        v.sort()
    out = []
    for e in stream:
        country = "?"
        for valid_from, c in versions.get(e["user"], []):
            if valid_from <= e["event_time"]:
                country = c
            else:
                break
        out.append((e["id"], country))
    return sorted(out)


def make_profile_changes(seed: int = 5) -> list[dict]:
    rnd = random.Random(seed)
    out = []
    for u in range(30):
        t = 0.0
        for _ in range(3):
            out.append({"user": f"u{u}", "valid_from": t, "country": rnd.choice(["DE", "IN", "US", "BR", "JP"]),
                        "arrival": t + rnd.uniform(0, 400)})
            t += rnd.uniform(300, 1500)
    return out


if __name__ == "__main__":
    evs = make_events()
    truth = batch_counts(evs)
    for lateness in (5.0, 30.0, 1000.0):
        em, dropped, _ = tumbling_counts(evs, lateness=lateness)
        wrong = sum(1 for w in truth if em.get(w) != truth[w])
        print(f"tumbling 1-min windows, lateness {lateness:6.0f}s: {dropped:3d} events dropped, {wrong:2d} of {len(truth)} windows differ from batch")
    em, _, corr = tumbling_counts(evs, lateness=5.0, corrections=True)
    print(f"  with corrections instead: {len(corr)} corrections published; final counts match batch? {em == truth}")
    s = sessionize(evs)
    print(f"sessions (30 s gap): {sum(len(v) for v in s.values())} sessions for {len(s)} users")
    sc = make_search_clicks()
    joined = search_click_join(sc)
    print(f"search-click join: {len(joined)} joined; matches batch? {joined == batch_click_through(sc)}")
    pc = make_profile_changes()
    naive, as_of = enrich_naive(evs, pc), enrich_as_of(evs, pc)
    differ = sum(1 for a, b in zip(naive, as_of) if a != b)
    print(f"stream-table join: {differ} of {len(evs)} events got a different country from the arrival-order join")
