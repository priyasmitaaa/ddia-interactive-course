"""Lab 35 - leader election with epochs (terms) and quorums, fuzz-tested (pp. 355-360).

A Raft-style election: every node has a current term, votes at most once per term, and becomes leader only
with votes from a strict majority. A node that sees a higher term adopts it and steps down. We then
fuzz the protocol - random partitions, crashes and restarts - and check the safety property

    election safety: at most one leader is ever elected for any given term

which is what "within each epoch, the leader is unique" means on p. 358. Two deliberately broken variants
(voting twice in a term; counting "half" as a majority) show that the checker catches real bugs.

  TODO 1  handle_request_vote
  TODO 2  start_election
  TODO 3  handle_heartbeat
  TODO 4  election_safety_violations
"""
from __future__ import annotations

import random
from dataclasses import dataclass, field


@dataclass
class Node:
    id: int
    term: int = 0
    voted_for: int | None = None
    role: str = "follower"          # follower | candidate | leader
    log: list[int] = field(default_factory=list)   # terms of log entries (for the up-to-date check)
    up: bool = True

    def last_term(self) -> int:
        return self.log[-1] if self.log else 0


@dataclass
class Config:
    n: int = 5
    allow_double_vote: bool = False   # BUG switch: vote for anyone who asks in the current term
    half_is_majority: bool = False    # BUG switch: n // 2 votes are enough

    def quorum(self) -> int:
        return self.n // 2 if self.half_is_majority else self.n // 2 + 1


def log_ok(cand_last_term: int, cand_len: int, voter: Node) -> bool:
    """The candidate's log must be at least as up to date as the voter's (Raft's rule)."""
    return cand_last_term > voter.last_term() or (cand_last_term == voter.last_term() and cand_len >= len(voter.log))


def handle_request_vote(voter: Node, cand_term: int, cand_id: int, cand_last_term: int, cand_len: int, cfg: Config) -> bool:
    """Return True if `voter` grants its vote.
    - A request from an older term is refused.
    - A newer term: adopt it, forget any vote, and step down to follower.
    - Grant only if you haven't voted for someone else in this term and the candidate's log is up to date."""
    # TODO 1: refuse if the voter is down or cand_term < voter.term. If cand_term > voter.term: adopt it,
    #         clear voted_for, become follower. Refuse if already voted for someone else this term (unless
    #         cfg.allow_double_vote) or if not log_ok(...). Otherwise record the vote and grant it.
    raise NotImplementedError


def start_election(c: Node, nodes: list[Node], reachable, cfg: Config) -> bool:
    """`c` times out: increment its term, vote for itself, request votes from every node it can reach.
    Become leader iff it collects a quorum (cfg.quorum()) of votes, counting its own. Returns True if elected."""
    # TODO 2: increment c.term, become candidate, vote for yourself. Ask every reachable node via
    #         handle_request_vote(...). If a refusing node has a higher term, adopt it, become follower and
    #         return False. Become leader (return True) iff votes >= cfg.quorum().
    raise NotImplementedError


def handle_heartbeat(f: Node, leader_term: int) -> bool:
    """A leader's heartbeat (AppendEntries) arrives at `f`. Return False to reject a stale leader, so the
    leader learns that it has been superseded. Otherwise adopt the term and become a follower."""
    # TODO 3: reject (return False) if f is down or leader_term < f.term. Otherwise adopt the term
    #         (clearing voted_for if the term is new), become follower, return True.
    raise NotImplementedError


def election_safety_violations(elections: list[tuple[int, int]]) -> list[int]:
    """elections: list of (term, leader id) for every successful election. Return the terms that had more
    than one distinct leader."""
    # TODO 4: group leaders by term; return the sorted list of terms with more than one distinct leader.
    raise NotImplementedError


# --------------------------------------------------------------------------- the fuzzer (given)

def fuzz(cfg: Config, runs: int = 1000, steps: int = 120, seed: int = 0) -> tuple[list[tuple[int, int]], int]:
    """Random partitions, crashes, restarts, elections, heartbeats and client writes.
    Returns (all elections (term, leader), number of runs)."""
    rnd = random.Random(seed)
    all_elections: list[tuple[int, int]] = []
    for run in range(runs):
        nodes = [Node(i) for i in range(cfg.n)]
        group = [0] * cfg.n
        elections: list[tuple[int, int]] = []

        def reachable(a: int, b: int) -> bool:
            return nodes[a].up and nodes[b].up and group[a] == group[b]

        for _ in range(steps):
            r = rnd.random()
            if r < 0.10:                                   # new random partition into two groups
                group = [rnd.randrange(2) for _ in range(cfg.n)]
            elif r < 0.15:
                group = [0] * cfg.n                        # heal
            elif r < 0.22:
                x = nodes[rnd.randrange(cfg.n)]            # crash or restart (term, vote and log are on disk)
                x.up = not x.up
                if x.up:
                    x.role = "follower"
            elif r < 0.62:
                c = nodes[rnd.randrange(cfg.n)]
                if c.up and c.role != "leader" and start_election(c, nodes, reachable, cfg):
                    elections.append((c.term, c.id))
            elif r < 0.90:
                for L in [x for x in nodes if x.up and x.role == "leader"]:
                    for f in nodes:
                        if f.id != L.id and reachable(L.id, f.id) and not handle_heartbeat(f, L.term):
                            L.term, L.role, L.voted_for = f.term, "follower", None
                            break
            else:
                for L in [x for x in nodes if x.up and x.role == "leader"]:
                    L.log.append(L.term)                  # a client write on the leader
                    for f in nodes:
                        if f.id != L.id and reachable(L.id, f.id) and f.term <= L.term:
                            f.log = list(L.log)
        # terms are only comparable within one run, so tag them with the run number
        all_elections.extend((run * 10_000 + t, l) for t, l in elections)
    return all_elections, runs


if __name__ == "__main__":
    for name, cfg in [("correct", Config()), ("BUG: vote twice per term", Config(allow_double_vote=True)),
                      ("BUG: half counts as majority", Config(n=4, half_is_majority=True))]:
        elections, runs = fuzz(cfg)
        bad = election_safety_violations(elections)
        print(f"{name:<30} {len(elections):>5} elections in {runs} runs, terms with two leaders: {len(bad)}")
