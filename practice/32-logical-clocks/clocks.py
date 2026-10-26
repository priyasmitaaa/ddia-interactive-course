"""Exercise 32 - ordering events: Lamport timestamps, vector clocks, and non-causal sequence generators.

We simulate a random message trace between 4 nodes (local events, sends, receives with network delay).
Vector clocks give the exact happened-before relation (and so tell concurrent events apart); we use them
as ground truth to score other ways of numbering events (pp. 334-337):

  * odd/even style: each node counts its own events; node id in the low bits makes numbers unique
  * block allocation: each node hands out numbers from its own pre-allocated block
  * physical clock: time-of-day timestamps from skewed clocks
  * Lamport timestamps: (counter, node id), with the max counter carried on every message

A generator is *consistent with causality* if a -> b always implies number(a) < number(b).
"""
from __future__ import annotations

import random
from dataclasses import dataclass, field


@dataclass
class Event:
    node: int
    kind: str            # 'local' | 'send' | 'recv'
    real_time: float
    msg: int | None = None
    lamport: tuple[int, int] | None = None
    vector: list[int] = field(default_factory=list)


def make_trace(n_nodes: int = 4, n_events: int = 400, seed: int = 1) -> list[Event]:
    """Random trace in real-time order. Each send's message is received later by a random other node."""
    rnd = random.Random(seed)
    t = 0.0
    events: list[Event] = []
    in_flight: list[tuple[float, int, int]] = []   # (arrival time, destination, msg id)
    msg_id = 0
    while len(events) < n_events:
        t += rnd.expovariate(1.0)
        # deliver due messages first
        in_flight.sort()
        while in_flight and in_flight[0][0] <= t:
            arr, dst, m = in_flight.pop(0)
            events.append(Event(dst, "recv", arr, msg=m))
        node = rnd.randrange(n_nodes)
        if rnd.random() < 0.5:
            dst = rnd.choice([x for x in range(n_nodes) if x != node])
            events.append(Event(node, "send", t, msg=msg_id))
            in_flight.append((t + rnd.uniform(0.5, 8.0), dst, msg_id))
            msg_id += 1
        else:
            events.append(Event(node, "local", t))
    events.sort(key=lambda e: e.real_time)
    # drop receives whose send isn't in the trace (cannot happen here, but keep the trace self-consistent)
    return events


def assign_lamport(events: list[Event], n_nodes: int) -> None:
    """Set e.lamport = (counter, node) for every event (events are in real-time order)."""
    # TODO 1: keep one counter per node. On every event the node increments its counter; on a receive it
    #         first moves its counter up to the counter carried by the message (remember what each send
    #         carried, keyed by e.msg). Set e.lamport = (counter, node).
    raise NotImplementedError


def assign_vectors(events: list[Event], n_nodes: int) -> None:
    """Set e.vector for every event: one entry per node, as in "Detecting concurrent writes" (Chapter 5)."""
    # TODO 2a: like TODO 1, but each node keeps a whole vector. On receive, take the element-wise max with
    #          the vector carried by the message; then increment your own entry. Set e.vector.
    raise NotImplementedError


def happened_before(a: Event, b: Event) -> bool:
    # TODO 2b: a -> b iff a's vector <= b's element-wise and they differ.
    raise NotImplementedError


# ---------------------------------------------------------------- the non-causal generators (given)

def odd_even_numbers(events: list[Event], n_nodes: int) -> list[int]:
    """Each node counts its own events; number = count * n_nodes + node (unique, 'odd/even' generalised)."""
    counts = [0] * n_nodes
    out = []
    for e in events:
        counts[e.node] += 1
        out.append(counts[e.node] * n_nodes + e.node)
    return out


def block_numbers(events: list[Event], n_nodes: int, block: int = 50) -> list[int]:
    """Nodes claim blocks of `block` numbers from a shared allocator when they run out."""
    next_block = 0
    cur = [None] * n_nodes
    left = [0] * n_nodes
    out = []
    for e in events:
        if left[e.node] == 0:
            cur[e.node] = next_block * block
            next_block += 1
            left[e.node] = block
        out.append(cur[e.node])
        cur[e.node] += 1
        left[e.node] -= 1
    return out


def physical_numbers(events: list[Event], n_nodes: int, skew: float = 3.0, seed: int = 2) -> list[float]:
    rnd = random.Random(seed)
    offsets = [rnd.uniform(-skew / 2, skew / 2) for _ in range(n_nodes)]
    return [e.real_time + offsets[e.node] for e in events]


def causality_violations(events: list[Event], numbers: list) -> tuple[int, int]:
    """(pairs a -> b with number(a) >= number(b), total causally ordered pairs)."""
    bad = total = 0
    for i in range(len(events)):
        for j in range(len(events)):
            if i != j and happened_before(events[i], events[j]):
                total += 1
                if numbers[i] >= numbers[j]:
                    bad += 1
    return bad, total


def main() -> None:
    n = 4
    ev = make_trace(n)
    assign_lamport(ev, n)
    assign_vectors(ev, n)
    pairs = [(a, b) for a in ev for b in ev if a is not b]
    concurrent = sum(1 for a, b in pairs if not happened_before(a, b) and not happened_before(b, a)) // 2
    print(f"{len(ev)} events on {n} nodes; {concurrent} concurrent pairs (no causal link either way)\n")
    gens = [
        ("odd/even counters", odd_even_numbers(ev, n)),
        ("block allocation", block_numbers(ev, n)),
        ("physical clocks (skew 3)", physical_numbers(ev, n)),
        ("Lamport timestamps", [e.lamport for e in ev]),
    ]
    print(f"  {'generator':<26}{'causally ordered pairs out of order':>38}")
    for name, nums in gens:
        bad, total = causality_violations(ev, nums)
        print(f"  {name:<26}{bad:>20} of {total} ({100 * bad / total:.2f}%)")
    lam_bad, _ = causality_violations(ev, [e.lamport for e in ev])
    assert lam_bad == 0, "Lamport timestamps must be consistent with causality - check TODO 1"
    # Lamport can't tell you which pairs were concurrent:
    a, b = next((a, b) for a, b in pairs if not happened_before(a, b) and not happened_before(b, a))
    print(f"\n  e.g. events with Lamport {a.lamport} and {b.lamport} are concurrent, "
          f"but the Lamport order alone says {'first' if a.lamport < b.lamport else 'second'} < other.")


if __name__ == "__main__":
    main()
