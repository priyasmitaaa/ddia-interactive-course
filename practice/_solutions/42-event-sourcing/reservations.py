"""Exercise 42 - event sourcing: theatre seat reservations (pp. 442-448).

The system of record is an append-only EVENT STORE. Nothing is ever updated or deleted; a cancellation is a new
event. Current state is DERIVED by replaying events, and several read views (projections) are derived from the same
log - including one you add later and build from the full history (CQRS, p. 446).

A COMMAND (a user request) may be rejected; only a validated command becomes an EVENT, which is an immutable fact
(p. 443-444). To validate "seat not already taken" safely under concurrency, appends to a show's stream use
optimistic concurrency: append(stream, events, expected_version) fails if someone else appended first.

  TODO 1  decide         (command + current state -> new events, or raise Rejected)
  TODO 2  evolve         (state + event -> new state; the fold used for replay)
  TODO 3  EventStore.append with the expected_version check
  TODO 4  cancellations_per_show (a projection added later, built from the full history)
"""
from __future__ import annotations

import json
from dataclasses import dataclass, field


class Rejected(Exception):
    """The command failed validation and did NOT become an event."""


class ConcurrencyConflict(Exception):
    """Someone appended to this stream since we read it; reload state and decide again."""


# ------------------------------------------------------------------ the event store

@dataclass
class EventStore:
    events: list[dict] = field(default_factory=list)       # the log: {"stream", "version", "type", "data"}

    def stream(self, name: str) -> list[dict]:
        return [e for e in self.events if e["stream"] == name]

    def version(self, name: str) -> int:
        return len(self.stream(name))

    def append(self, name: str, new_events: list[dict], expected_version: int) -> None:
        """Append events to stream `name` only if its current version equals expected_version (else raise
        ConcurrencyConflict). Each appended event gets the next version number of the stream."""
        # TODO 3 (solution)
        current = self.version(name)
        if current != expected_version:
            raise ConcurrencyConflict(f"{name}: expected version {expected_version}, but it is {current}")
        for i, e in enumerate(new_events, start=1):
            self.events.append({"stream": name, "version": current + i, **e})

    def save(self, path: str) -> None:
        with open(path, "w", encoding="utf-8") as f:
            for e in self.events:
                f.write(json.dumps(e) + "\n")

    @classmethod
    def load(cls, path: str) -> "EventStore":
        with open(path, encoding="utf-8") as f:
            return cls([json.loads(line) for line in f])


# ------------------------------------------------------------------ the show aggregate

@dataclass
class Show:
    seats: set[str]
    taken: dict[str, str] = field(default_factory=dict)    # seat -> customer


def new_show(seats: int = 10) -> Show:
    return Show({f"A{i}" for i in range(1, seats + 1)})


def evolve(state: Show, event: dict) -> Show:
    """Apply one event to the state (must be deterministic, p. 443)."""
    # TODO 2 (solution)
    d = event["data"]
    if event["type"] == "SeatReserved":
        state.taken[d["seat"]] = d["customer"]
    elif event["type"] == "ReservationCancelled":
        state.taken.pop(d["seat"], None)
    return state


def decide(state: Show, command: dict) -> list[dict]:
    """Validate a command against the current state and return the resulting events.
    Commands: {"type": "Reserve", "seat", "customer"} and {"type": "Cancel", "seat", "customer"}.
    Reject: unknown seat; seat already taken; cancelling a seat that customer doesn't hold."""
    # TODO 1 (solution)
    seat, cust = command["seat"], command["customer"]
    if seat not in state.seats:
        raise Rejected(f"no such seat {seat}")
    if command["type"] == "Reserve":
        if seat in state.taken:
            raise Rejected(f"{seat} already reserved")
        return [{"type": "SeatReserved", "data": {"seat": seat, "customer": cust}}]
    if command["type"] == "Cancel":
        if state.taken.get(seat) != cust:
            raise Rejected(f"{cust} does not hold {seat}")
        return [{"type": "ReservationCancelled", "data": {"seat": seat, "customer": cust}}]
    raise Rejected(f"unknown command {command['type']}")


def load_show(store: EventStore, show: str) -> tuple[Show, int]:
    state = new_show()
    for e in store.stream(show):
        state = evolve(state, e)
    return state, store.version(show)


def handle(store: EventStore, show: str, command: dict, read_hook=None) -> list[dict]:
    """Load, decide, append with the version we read. `read_hook` lets tests interleave another writer."""
    state, version = load_show(store, show)
    events = decide(state, command)
    if read_hook:
        read_hook()
    store.append(show, events, expected_version=version)
    return events


def handle_with_retry(store: EventStore, show: str, command: dict, read_hook=None) -> list[dict]:
    try:
        return handle(store, show, command, read_hook)
    except ConcurrencyConflict:
        return handle(store, show, command)            # reload the newer state and decide again


# ------------------------------------------------------------------ projections (read views)

def seat_map(store: EventStore, show: str) -> dict[str, str]:
    return dict(load_show(store, show)[0].taken)


def customer_history(store: EventStore, customer: str) -> list[str]:
    """Every reservation-related fact about a customer, including ones later cancelled."""
    out = []
    for e in store.events:
        if e["data"].get("customer") == customer:
            out.append(f'{e["stream"]}: {e["type"]} {e["data"]["seat"]}')
    return out


def cancellations_per_show(store: EventStore) -> dict[str, int]:
    """A NEW read view added long after launch: number of cancellations per show, derived from the full history."""
    # TODO 4 (solution)
    out: dict[str, int] = {}
    for e in store.events:
        if e["type"] == "ReservationCancelled":
            out[e["stream"]] = out.get(e["stream"], 0) + 1
    return out


if __name__ == "__main__":
    store = EventStore()
    for cmd in [{"type": "Reserve", "seat": "A1", "customer": "ann"}, {"type": "Reserve", "seat": "A2", "customer": "bob"},
                {"type": "Cancel", "seat": "A1", "customer": "ann"}, {"type": "Reserve", "seat": "A1", "customer": "cy"}]:
        handle(store, "hamlet-0612", cmd)
    try:
        handle(store, "hamlet-0612", {"type": "Reserve", "seat": "A2", "customer": "dee"})
    except Rejected as e:
        print("command rejected (no event written):", e)
    print("seat map      :", seat_map(store, "hamlet-0612"))
    print("ann's history :", customer_history(store, "ann"))
    print("cancellations :", cancellations_per_show(store))

    # two box offices reserve the last free seat "A3" concurrently
    def other_box_office():
        handle(store, "hamlet-0612", {"type": "Reserve", "seat": "A3", "customer": "eve"})
    try:
        handle_with_retry(store, "hamlet-0612", {"type": "Reserve", "seat": "A3", "customer": "fay"}, read_hook=other_box_office)
    except Rejected as e:
        print("concurrent reservation: conflict detected, retried, then rejected:", e)
    print("A3 belongs to :", seat_map(store, "hamlet-0612")["A3"])
