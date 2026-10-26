/**
 * A small linearizability checker for a single register (Chapter 9, pp. 314-319).
 *
 * A history is a list of operations, each with the real-time interval [start, end] during which the client
 * was waiting for it. The history is linearizable if the operations can be put in a sequential order that
 * (1) respects real time — if a ended before b started, a comes first — and (2) is a valid sequence of
 * register operations: every read returns the most recent write, cas succeeds iff the value matched.
 * Brute-force search in the style of Wing & Gong; fine for the dozen-operation histories in the lessons.
 */

export type OpKind = 'write' | 'read' | 'cas';

export interface Op {
  id: string;
  client: string;
  kind: OpKind;
  value?: number;        // write: value written; read: value returned
  from?: number;         // cas: expected old value
  to?: number;           // cas: new value
  ok?: boolean;          // write/cas: whether it succeeded (writes always ok here)
  start: number;
  end: number;
}

export interface CheckResult {
  linearizable: boolean;
  order: string[];               // a valid linearization (op ids), if any
  points: Record<string, number>; // a linearization point inside each op's interval
  explored: number;
}

/** Apply op to register value v. Returns the new value, or null if the op's recorded result is impossible. */
export function apply(op: Op, v: number): number | null {
  switch (op.kind) {
    case 'write': return op.value!;
    case 'read': return op.value === v ? v : null;
    case 'cas': {
      const matches = v === op.from;
      if (op.ok && matches) return op.to!;
      if (!op.ok && !matches) return v;
      return null;
    }
  }
}

export function checkLinearizable(history: Op[], initial = 0): CheckResult {
  const n = history.length;
  let explored = 0;
  const used = new Array(n).fill(false);
  const order: number[] = [];
  const seen = new Set<string>();

  const search = (v: number): boolean => {
    if (order.length === n) return true;
    const key = used.map((u) => (u ? 1 : 0)).join('') + '|' + v;
    if (seen.has(key)) return false; // same set of ops done, same value → same outcome
    seen.add(key);
    // the earliest end among remaining ops: any op that starts after it can't be next
    let minEnd = Infinity;
    for (let i = 0; i < n; i++) if (!used[i]) minEnd = Math.min(minEnd, history[i].end);
    for (let i = 0; i < n; i++) {
      if (used[i] || history[i].start > minEnd) continue;
      explored++;
      const nv = apply(history[i], v);
      if (nv === null) continue;
      used[i] = true; order.push(i);
      if (search(nv)) return true;
      used[i] = false; order.pop();
    }
    return false;
  };

  const ok = search(initial);
  const points: Record<string, number> = {};
  if (ok) {
    let t = -Infinity;
    for (const i of order) {
      const op = history[i];
      t = Math.max(op.start, t + 0.5);
      if (t > op.end) t = op.end; // cannot happen for a valid order, kept as a guard
      points[op.id] = t;
    }
  }
  return { linearizable: ok, order: ok ? order.map((i) => history[i].id) : [], points, explored };
}

/** For a non-linearizable history, find a read that, removed, makes it linearizable (a "culprit"). */
export function findCulprit(history: Op[], initial = 0): string | null {
  if (checkLinearizable(history, initial).linearizable) return null;
  // Try the latest-starting reads first: usually the read that "went back in time".
  const reads = history.filter((o) => o.kind === 'read').sort((a, b) => b.start - a.start);
  for (const op of reads) {
    if (checkLinearizable(history.filter((o) => o !== op), initial).linearizable) return op.id;
  }
  return null;
}

// ---------- histories from the book ----------

/** Figure 9-2/9-3: C writes 1 while A and B poll. Returned values of the concurrent reads are parameters. */
export function fig92(aMid: number, bFirst: number, bSecond: number): Op[] {
  return [
    { id: 'A1', client: 'A', kind: 'read', value: 0, start: 2, end: 16 },
    { id: 'A2', client: 'A', kind: 'read', value: aMid, start: 34, end: 48 },
    { id: 'A3', client: 'A', kind: 'read', value: 1, start: 76, end: 92 },
    { id: 'B1', client: 'B', kind: 'read', value: bFirst, start: 22, end: 40 },
    { id: 'B2', client: 'B', kind: 'read', value: bSecond, start: 52, end: 66 },
    { id: 'C1', client: 'C', kind: 'write', value: 1, ok: true, start: 28, end: 72 },
  ];
}

/** Figure 9-4 (times chosen to match the figure's ordering). `bLast` is the value of B's final, shaded read. */
export function fig94(bLast = 2): Op[] {
  return [
    { id: 'B1', client: 'B', kind: 'read', value: 1, start: 3, end: 30 },
    { id: 'D1', client: 'D', kind: 'write', value: 0, ok: true, start: 6, end: 14 },
    { id: 'A1', client: 'A', kind: 'write', value: 1, ok: true, start: 10, end: 42 },
    { id: 'C1', client: 'C', kind: 'read', value: 1, start: 20, end: 33 },
    { id: 'B2', client: 'B', kind: 'cas', from: 1, to: 2, ok: true, start: 35, end: 50 },
    { id: 'C2', client: 'C', kind: 'read', value: 2, start: 52, end: 62 },
    { id: 'D2', client: 'D', kind: 'cas', from: 0, to: 3, ok: false, start: 55, end: 68 },
    { id: 'C3', client: 'C', kind: 'cas', from: 2, to: 4, ok: true, start: 65, end: 95 },
    { id: 'A2', client: 'A', kind: 'read', value: 4, start: 70, end: 85 },
    { id: 'B3', client: 'B', kind: 'read', value: bLast, start: 87, end: 99 },
  ];
}

/** Figure 9-6: a strict quorum, yet A sees the new value and the later B sees the old one. */
export function fig96(): Op[] {
  return [
    { id: 'W', client: 'Writer', kind: 'write', value: 1, ok: true, start: 5, end: 95 },
    { id: 'A', client: 'A', kind: 'read', value: 1, start: 20, end: 40 },
    { id: 'B', client: 'B', kind: 'read', value: 0, start: 50, end: 70 },
  ];
}

export const describeOp = (o: Op) =>
  o.kind === 'write' ? `write(x, ${o.value})` : o.kind === 'read' ? `read(x) → ${o.value}` : `cas(x, ${o.from}, ${o.to}) → ${o.ok ? 'ok' : 'error'}`;
