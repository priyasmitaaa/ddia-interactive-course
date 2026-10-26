"""Run every reference solution in practice/_solutions and report pass/fail.

    python tools/check_solutions.py            # all
    python tools/check_solutions.py 30 45      # only exercises whose folder starts with these numbers

For each solution folder: if it has test_*.py files, run them (unittest); otherwise run its main .py file(s) and
require exit code 0. Exercises that need optional tools (e.g. Docker/PostgreSQL) are skipped if they say so.
"""
from __future__ import annotations

import os
import subprocess
import sys
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SOL = os.path.join(ROOT, "practice", "_solutions")


def run(cmd: list[str], cwd: str, timeout: int = 600) -> tuple[bool, str]:
    try:
        p = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, timeout=timeout,
                           env={**os.environ, "PYTHONIOENCODING": "utf-8"})
        out = (p.stdout + p.stderr).strip().splitlines()
        return p.returncode == 0, out[-1] if out else ""
    except subprocess.TimeoutExpired:
        return False, f"timeout after {timeout}s"


def main() -> int:
    only = sys.argv[1:]
    failures = 0
    for name in sorted(os.listdir(SOL)):
        folder = os.path.join(SOL, name)
        if not os.path.isdir(folder) or name.startswith((".", "_")):
            continue
        if only and not any(name.startswith(o.zfill(2)) for o in only):
            continue
        files = sorted(f for f in os.listdir(folder) if f.endswith(".py"))
        tests = [f for f in files if f.startswith("test_")]
        t0 = time.time()
        if tests:
            ok, last = True, ""
            for t in tests:
                o, last = run([sys.executable, t], folder)
                ok = ok and o
        else:
            mains = [f for f in files if not f.startswith("_")]
            ok, last = True, ""
            for m in mains:
                o, last = run([sys.executable, m], folder)
                ok = ok and o
        failures += not ok
        print(f"{'PASS' if ok else 'FAIL'}  {name:<34} {time.time() - t0:6.1f}s  {last[:70]}")
    print(f"\n{failures} failing" if failures else "\nAll reference solutions pass")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
