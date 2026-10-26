"""
Exercise 27 — Actual serial execution and stored procedures (book pp. 243-248, Figure 7-9).

A transaction "move a doctor off call if safe" has 3 statements. Between statements, an interactive
client waits one network round trip (simulated: 0.5 ms). We compare:
  A) interactive transactions executed one at a time (a global lock = serial execution)
  B) interactive transactions with per-transaction concurrency (what most databases do)
  C) the same logic as a "stored procedure" submitted to a single-threaded executor (VoltDB/Redis style)

Run:  python practice/27-serial-execution/serial.py
"""
import queue
import threading
import time
from concurrent.futures import Future

RTT = 0.0005          # one network round trip between application and database
CLIENTS = 16
TX_PER_CLIENT = 40

doctors = {f"shift{s}:{n}": True for s in range(CLIENTS) for n in ("alice", "bob")}


def take_off_call(state, shift, name):
    """The transaction logic (Figure 7-8), as a function of the database state."""
    on_call = sum(1 for n in ("alice", "bob") if state[f"{shift}:{n}"])
    if on_call >= 2:
        state[f"{shift}:{name}"] = False
    state[f"{shift}:{name}"] = True          # put them back so the benchmark can repeat
    return on_call


# ---------------------------------------------------------------------------
# A) Interactive, serial: hold one global lock for the whole transaction, including the round trips.
# ---------------------------------------------------------------------------
GLOBAL = threading.Lock()


def interactive_serial(shift, name):
    with GLOBAL:
        for _ in range(3):              # each statement costs a round trip while holding the "database"
            time.sleep(RTT)
        return take_off_call(doctors, shift, name)


# ---------------------------------------------------------------------------
# B) Interactive with concurrency: transactions on different shifts don't conflict, so a lock per shift
#    (think row/predicate locks) lets them overlap. Same round trips.
# ---------------------------------------------------------------------------
SHIFT_LOCKS = {f"shift{s}": threading.Lock() for s in range(CLIENTS)}


def interactive_concurrent(shift, name):
    with SHIFT_LOCKS[shift]:
        for _ in range(3):
            time.sleep(RTT)
        return take_off_call(doctors, shift, name)


# ---------------------------------------------------------------------------
# C) YOUR TASK: a single-threaded executor of stored procedures.
# One worker thread owns the data and runs submitted procedures ONE AT A TIME (so they're serializable
# by construction). Clients pay one round trip to submit the whole transaction, then wait for the result.
# ---------------------------------------------------------------------------
class SerialExecutor:
    def __init__(self, state):
        self.state = state
        self.q: queue.Queue = queue.Queue()
        # TODO: start a daemon worker thread running self._loop

    def _loop(self):
        """TODO: forever: take (procedure, args, future) from the queue, run procedure(self.state, *args),
        and set the future's result (or exception)."""
        raise NotImplementedError

    def submit(self, procedure, *args) -> Future:
        """TODO: put the call on the queue and return a Future."""
        raise NotImplementedError


def stored_procedure_call(executor, shift, name):
    time.sleep(RTT)                          # one round trip to send the procedure call
    return executor.submit(take_off_call, shift, name).result()


def bench(name, fn):
    def client(c):
        for i in range(TX_PER_CLIENT):
            fn(f"shift{c}", "alice" if i % 2 else "bob")
    t0 = time.perf_counter()
    ts = [threading.Thread(target=client, args=(c,)) for c in range(CLIENTS)]
    for t in ts:
        t.start()
    for t in ts:
        t.join()
    secs = time.perf_counter() - t0
    print(f"{name:<44} {CLIENTS * TX_PER_CLIENT / secs:>8,.0f} transactions/s")


if __name__ == "__main__":
    print(f"{CLIENTS} clients, {TX_PER_CLIENT} transactions each, 3 statements per transaction, RTT {RTT * 1000} ms\n")
    bench("A) interactive, executed serially", interactive_serial)
    bench("B) interactive, concurrent (per-shift locks)", interactive_concurrent)
    try:
        ex = SerialExecutor(doctors)
        bench("C) stored procedures, single thread", lambda s, n: stored_procedure_call(ex, s, n))
    except NotImplementedError:
        print("C) not implemented yet")
