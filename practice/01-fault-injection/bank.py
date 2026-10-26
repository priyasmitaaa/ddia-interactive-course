"""
Exercise 01 — Fault injection: why retries are not enough.

A client sends money transfers to a server over a FLAKY network. Your job is to write
client code that survives the faults without creating or losing money.

Run:  python practice/01-fault-injection/bank.py
"""
import random


class Timeout(Exception):
    """The client gave up waiting. It does NOT know whether the server applied the request."""


class ServiceUnavailable(Exception):
    """The server refused the request before doing anything (safe to retry)."""


class BankServer:
    def __init__(self, starting_balance: int):
        self.balances = {"alice": starting_balance, "bob": 0}
        self.processed: dict[str, str] = {}   # request_id -> result (for de-duplication)
        self.applied = 0                       # how many transfers were really executed

    def transfer(self, src: str, dst: str, amount: int, request_id: str | None = None) -> str:
        if request_id is not None and request_id in self.processed:
            return self.processed[request_id]          # seen before: do NOT apply twice
        if self.balances[src] < amount:
            result = "insufficient funds"
        else:
            self.balances[src] -= amount
            self.balances[dst] += amount
            self.applied += 1
            result = "ok"
        if request_id is not None:
            self.processed[request_id] = result
        return result


class FlakyNetwork:
    """Delivers calls to the server, but injects three kinds of fault."""

    def __init__(self, server: BankServer, seed: int,
                 p_unavailable=0.05, p_lose_request=0.05, p_lose_response=0.05):
        self.server = server
        self.rand = random.Random(seed)
        self.p_unavailable = p_unavailable
        self.p_lose_request = p_lose_request
        self.p_lose_response = p_lose_response
        self.calls = 0

    def transfer(self, *args, **kwargs) -> str:
        self.calls += 1
        r = self.rand.random()
        if r < self.p_unavailable:
            raise ServiceUnavailable("503: server overloaded, nothing was done")
        r = self.rand.random()
        if r < self.p_lose_request:
            raise Timeout("request lost on the way (server never saw it)")
        result = self.server.transfer(*args, **kwargs)
        r = self.rand.random()
        if r < self.p_lose_response:
            raise Timeout("response lost on the way back (server DID apply it!)")
        return result


# ---------------------------------------------------------------------------
# Strategy 0 (given): naive client, no error handling at all.
# ---------------------------------------------------------------------------
def send_naive(net: FlakyNetwork, payment_no: int) -> bool:
    """Return True if the client believes the payment succeeded."""
    try:
        return net.transfer("alice", "bob", 1) == "ok"
    except (Timeout, ServiceUnavailable):
        return False


# ---------------------------------------------------------------------------
# Strategy 1 (YOUR TASK): retry on failure.
# Retry up to 5 attempts on Timeout or ServiceUnavailable. Count a "backoff" of
# 2**attempt milliseconds in self-made bookkeeping if you like (no real sleeping needed).
# ---------------------------------------------------------------------------
def send_with_retries(net: FlakyNetwork, payment_no: int) -> bool:
    raise NotImplementedError


# ---------------------------------------------------------------------------
# Strategy 2 (YOUR TASK): retries + idempotency.
# Make retries safe: give each LOGICAL payment one unique request_id and send the same
# id on every retry. The server already de-duplicates by request_id (look at transfer()).
# ---------------------------------------------------------------------------
def send_idempotent(net: FlakyNetwork, payment_no: int) -> bool:
    raise NotImplementedError


# ---------------------------------------------------------------------------
# Chaos test harness — do not change.
# ---------------------------------------------------------------------------
def chaos_test(strategy, n_payments=2000, seed=7):
    server = BankServer(starting_balance=n_payments * 2)
    net = FlakyNetwork(server, seed)
    believed_ok = sum(1 for i in range(n_payments) if strategy(net, i))
    return {
        "client thinks succeeded": believed_ok,
        "server actually applied": server.applied,
        "bob's balance": server.balances["bob"],
        "network calls": net.calls,
    }


if __name__ == "__main__":
    print(f"Sending 2000 payments of $1 from alice to bob over a flaky network.\n")
    for name, fn in [("naive", send_naive), ("retries", send_with_retries), ("idempotent retries", send_idempotent)]:
        try:
            r = chaos_test(fn)
        except NotImplementedError:
            print(f"{name:>20}: not implemented yet")
            continue
        mismatch = r["client thinks succeeded"] - r["server actually applied"]
        verdict = "client and server AGREE" if mismatch == 0 else f"DISAGREE by {abs(mismatch)} payments"
        print(f"{name:>20}: " + ", ".join(f"{k}={v}" for k, v in r.items()) + f"  -> {verdict}")
