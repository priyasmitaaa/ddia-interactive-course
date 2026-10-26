"""Reference solution for exercise 01. Run: python practice/_solutions/01-fault-injection/solution.py"""
import importlib.util
import pathlib
import uuid

spec = importlib.util.spec_from_file_location(
    "bank", pathlib.Path(__file__).resolve().parents[2] / "01-fault-injection" / "bank.py")
bank = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bank)

MAX_ATTEMPTS = 5


def send_with_retries(net, payment_no):
    for attempt in range(MAX_ATTEMPTS):
        try:
            return net.transfer("alice", "bob", 1) == "ok"
        except (bank.Timeout, bank.ServiceUnavailable):
            backoff_ms = 2 ** attempt  # in real code: time.sleep(backoff_ms / 1000 * random jitter)
    return False


def send_idempotent(net, payment_no):
    request_id = str(uuid.uuid4())          # chosen ONCE per logical payment
    for attempt in range(MAX_ATTEMPTS):
        try:
            return net.transfer("alice", "bob", 1, request_id=request_id) == "ok"
        except (bank.Timeout, bank.ServiceUnavailable):
            pass
    return False


if __name__ == "__main__":
    for name, fn in [("naive", bank.send_naive), ("retries", send_with_retries), ("idempotent retries", send_idempotent)]:
        r = bank.chaos_test(fn)
        print(f"{name:>20}: {r}")
