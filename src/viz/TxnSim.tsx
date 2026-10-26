import { useMemo, useState } from 'react';
import { Controls, Seg } from './ui';

/**
 * A step-by-step transaction engine for two concurrent transactions A and B.
 * Isolation levels:
 *   none — read uncommitted, no locks (anomalies galore)
 *   rc   — read committed: row write locks held to commit; reads see latest committed value
 *   si   — snapshot isolation (MVCC): reads from a snapshot taken at the transaction's start;
 *          row write locks; optional automatic lost-update detection (PostgreSQL-style)
 *   2pl  — two-phase locking: shared locks for reads, exclusive for writes, predicate locks for
 *          searches; blocking; deadlock detection aborts a victim
 *   ssi  — serializable snapshot isolation: SI + tracking of reads; a read-write transaction
 *          aborts at commit if a concurrent transaction that committed first wrote data it read
 */
export type Level = 'none' | 'rc' | 'si' | '2pl' | 'ssi';
type Val = number | string | boolean;
type Vars = Record<string, Val>;
type TxId = 'A' | 'B';

interface Op {
  tx: TxId;
  kind: 'read' | 'write' | 'count' | 'commit';
  key?: string;               // read/write
  prefix?: string;            // count: rows whose key starts with prefix
  where?: (v: Val) => boolean; // count: predicate on the row's value
  into?: string;              // read/count: local variable
  value?: Val | ((vars: Vars) => Val);
  cond?: (vars: Vars) => boolean;  // only perform the write if true
  label: string;
}

interface Scenario {
  name: string;
  figure: string;
  txNames: Record<TxId, string>;
  initial: Record<string, Val>;
  ops: Op[];
  check: (db: Record<string, Val>, vars: Record<TxId, Vars>, status: Record<TxId, string>) => { ok: boolean; msg: string };
}

export const SCENARIOS: Record<string, Scenario> = {
  lost: {
    name: 'Lost update', figure: 'Figure 7-1', txNames: { A: 'User 1 (increment)', B: 'User 2 (increment)' },
    initial: { counter: 42 },
    ops: [
      { tx: 'A', kind: 'read', key: 'counter', into: 'x', label: 'x = get counter' },
      { tx: 'B', kind: 'read', key: 'counter', into: 'y', label: 'y = get counter' },
      { tx: 'A', kind: 'write', key: 'counter', value: (v) => (v.x as number) + 1, label: 'set counter = x + 1' },
      { tx: 'A', kind: 'commit', label: 'commit' },
      { tx: 'B', kind: 'write', key: 'counter', value: (v) => (v.y as number) + 1, label: 'set counter = y + 1' },
      { tx: 'B', kind: 'commit', label: 'commit' },
    ],
    check: (db, _v, st) => {
      const commits = (['A', 'B'] as TxId[]).filter((t) => st[t] === 'committed').length;
      const want = 42 + commits;
      return db.counter === want
        ? { ok: true, msg: `counter = ${db.counter}: ${commits} committed increment(s), none lost${commits < 2 ? ' (the aborted one should be retried)' : ''}.` }
        : { ok: false, msg: `counter = ${db.counter}, but ${commits} increments committed — an update was LOST.` };
    },
  },
  dirtyRead: {
    name: 'Dirty read', figure: 'Figure 7-2', txNames: { A: 'User 1 (new email)', B: 'User 2 (view mailbox)' },
    initial: { emails: 0, unread: 0 },
    ops: [
      { tx: 'A', kind: 'write', key: 'emails', value: 1, label: 'insert email (emails = 1)' },
      { tx: 'B', kind: 'read', key: 'emails', into: 'listed', label: 'listed = count emails' },
      { tx: 'B', kind: 'read', key: 'unread', into: 'counter', label: 'counter = get unread' },
      { tx: 'A', kind: 'write', key: 'unread', value: 1, label: 'unread = unread + 1' },
      { tx: 'A', kind: 'commit', label: 'commit' },
      { tx: 'B', kind: 'commit', label: 'commit' },
    ],
    check: (_db, v) => (v.B.listed === v.B.counter
      ? { ok: true, msg: `User 2 saw a consistent mailbox (${v.B.listed} email(s), unread counter ${v.B.counter}).` }
      : { ok: false, msg: `User 2 saw ${v.B.listed} email(s) but an unread counter of ${v.B.counter} — a half-finished transaction (dirty read).` }),
  },
  dirtyWrite: {
    name: 'Dirty write', figure: 'Figure 7-5', txNames: { A: 'Alice buys car', B: 'Bob buys car' },
    initial: { 'listing.buyer': '—', 'invoice.recipient': '—' },
    ops: [
      { tx: 'A', kind: 'write', key: 'listing.buyer', value: 'Alice', label: "listing.buyer = 'Alice'" },
      { tx: 'B', kind: 'write', key: 'listing.buyer', value: 'Bob', label: "listing.buyer = 'Bob'" },
      { tx: 'B', kind: 'write', key: 'invoice.recipient', value: 'Bob', label: "invoice.recipient = 'Bob'" },
      { tx: 'A', kind: 'write', key: 'invoice.recipient', value: 'Alice', label: "invoice.recipient = 'Alice'" },
      { tx: 'A', kind: 'commit', label: 'commit' },
      { tx: 'B', kind: 'commit', label: 'commit' },
    ],
    check: (db) => (db['listing.buyer'] === db['invoice.recipient']
      ? { ok: true, msg: `Consistent: the car and the invoice both go to ${db['listing.buyer']}.` }
      : { ok: false, msg: `The car goes to ${db['listing.buyer']} but the invoice to ${db['invoice.recipient']} — writes were mixed up (dirty write).` }),
  },
  readSkew: {
    name: 'Read skew', figure: 'Figure 7-6', txNames: { A: 'Alice reads balances', B: 'Transfer $100' },
    initial: { account1: 500, account2: 500 },
    ops: [
      { tx: 'A', kind: 'read', key: 'account1', into: 'a1', label: 'a1 = balance of account 1' },
      { tx: 'B', kind: 'read', key: 'account1', into: 't1', label: 't1 = balance of account 1' },
      { tx: 'B', kind: 'write', key: 'account1', value: (v) => (v.t1 as number) + 100, label: 'account 1 = t1 + 100' },
      { tx: 'B', kind: 'read', key: 'account2', into: 't2', label: 't2 = balance of account 2' },
      { tx: 'B', kind: 'write', key: 'account2', value: (v) => (v.t2 as number) - 100, label: 'account 2 = t2 − 100' },
      { tx: 'B', kind: 'commit', label: 'commit' },
      { tx: 'A', kind: 'read', key: 'account2', into: 'a2', label: 'a2 = balance of account 2' },
      { tx: 'A', kind: 'commit', label: 'commit' },
    ],
    check: (_db, v) => {
      const total = (v.A.a1 as number) + (v.A.a2 as number);
      return total === 1000 ? { ok: true, msg: `Alice saw a total of $${total} — a consistent view.` } : { ok: false, msg: `Alice saw a total of $${total}: $100 seems to have vanished (read skew / non-repeatable read).` };
    },
  },
  writeSkew: {
    name: 'Write skew (doctors on call)', figure: 'Figure 7-8', txNames: { A: 'Alice goes off call', B: 'Bob goes off call' },
    initial: { 'doctor:alice': true, 'doctor:bob': true, 'doctor:carol': false },
    ops: [
      { tx: 'A', kind: 'count', prefix: 'doctor:', where: (x) => x === true, into: 'n', label: 'n = count doctors on call' },
      { tx: 'B', kind: 'count', prefix: 'doctor:', where: (x) => x === true, into: 'n', label: 'n = count doctors on call' },
      { tx: 'A', kind: 'write', key: 'doctor:alice', value: false, cond: (v) => (v.n as number) >= 2, label: 'if n ≥ 2: Alice off call' },
      { tx: 'B', kind: 'write', key: 'doctor:bob', value: false, cond: (v) => (v.n as number) >= 2, label: 'if n ≥ 2: Bob off call' },
      { tx: 'A', kind: 'commit', label: 'commit' },
      { tx: 'B', kind: 'commit', label: 'commit' },
    ],
    check: (db) => {
      const on = Object.entries(db).filter(([k, v]) => k.startsWith('doctor:') && v === true).length;
      return on >= 1 ? { ok: true, msg: `${on} doctor(s) on call — the requirement holds.` } : { ok: false, msg: 'NO doctor is on call: both checks saw 2 doctors, each removed a different one (write skew).' };
    },
  },
  phantom: {
    name: 'Phantom (room booking)', figure: 'Example 7-2', txNames: { A: 'User A books room 123', B: 'User B books room 123' },
    initial: {},
    ops: [
      { tx: 'A', kind: 'count', prefix: 'booking:123:noon', where: () => true, into: 'c', label: 'c = count bookings for room 123 at noon' },
      { tx: 'B', kind: 'count', prefix: 'booking:123:noon', where: () => true, into: 'c', label: 'c = count bookings for room 123 at noon' },
      { tx: 'A', kind: 'write', key: 'booking:123:noon:A', value: 'user A', cond: (v) => v.c === 0, label: 'if c = 0: INSERT booking for A' },
      { tx: 'B', kind: 'write', key: 'booking:123:noon:B', value: 'user B', cond: (v) => v.c === 0, label: 'if c = 0: INSERT booking for B' },
      { tx: 'A', kind: 'commit', label: 'commit' },
      { tx: 'B', kind: 'commit', label: 'commit' },
    ],
    check: (db) => {
      const n = Object.keys(db).filter((k) => k.startsWith('booking:123:noon')).length;
      return n <= 1 ? { ok: true, msg: `${n} booking for room 123 at noon — no double booking.` } : { ok: false, msg: `${n} overlapping bookings: each transaction checked for the absence of a row that the other then inserted (a phantom).` };
    },
  },
};

// ---------------------------------------------------------------- engine
interface Version { value: Val | null; tx: TxId | 'init'; status: 'committed' | 'active' | 'aborted'; commitAt: number }
interface TxState {
  status: 'idle' | 'active' | 'blocked' | 'committed' | 'aborted';
  start: number; commitAt: number; vars: Vars;
  writes: Set<string>; readKeys: Set<string>; readPrefixes: string[];
  ignored: Set<TxId>;       // SSI: concurrent writers whose uncommitted versions we ignored
  blockedOn?: string; blockedSince?: number;
}
interface Engine {
  versions: Record<string, Version[]>;
  tx: Record<TxId, TxState>;
  clock: number;
  done: boolean[];            // per op index
  results: (string | null)[]; // per op index
  locksS: Record<string, Set<TxId>>;
  locksX: Record<string, TxId>;
  predicate: { tx: TxId; prefix: string }[];
  log: { text: string; tone?: 'good' | 'bad' | 'warn' }[];
}

const other = (t: TxId): TxId => (t === 'A' ? 'B' : 'A');

export function initEngine(sc: Scenario): Engine {
  const versions: Record<string, Version[]> = {};
  for (const [k, v] of Object.entries(sc.initial)) versions[k] = [{ value: v, tx: 'init', status: 'committed', commitAt: 0 }];
  const mk = (): TxState => ({ status: 'idle', start: 0, commitAt: 0, vars: {}, writes: new Set(), readKeys: new Set(), readPrefixes: [], ignored: new Set() });
  return { versions, tx: { A: mk(), B: mk() }, clock: 0, done: sc.ops.map(() => false), results: sc.ops.map(() => null), locksS: {}, locksX: {}, predicate: [], log: [] };
}

function clone(e: Engine): Engine {
  const versions: Record<string, Version[]> = {};
  for (const [k, vs] of Object.entries(e.versions)) versions[k] = vs.map((v) => ({ ...v }));
  const ct = (t: TxState): TxState => ({ ...t, vars: { ...t.vars }, writes: new Set(t.writes), readKeys: new Set(t.readKeys), readPrefixes: [...t.readPrefixes], ignored: new Set(t.ignored) });
  const locksS: Record<string, Set<TxId>> = {};
  for (const [k, s] of Object.entries(e.locksS)) locksS[k] = new Set(s);
  return { versions, tx: { A: ct(e.tx.A), B: ct(e.tx.B) }, clock: e.clock, done: [...e.done], results: [...e.results], locksS, locksX: { ...e.locksX }, predicate: [...e.predicate], log: [...e.log] };
}

function visible(e: Engine, level: Level, t: TxId, key: string): Version | undefined {
  const vs = (e.versions[key] ?? []).filter((v) => v.status !== 'aborted');
  const own = [...vs].reverse().find((v) => v.tx === t);
  if (own) return own;
  if (level === 'none') return vs[vs.length - 1];
  if (level === 'rc' || level === '2pl') return [...vs].reverse().find((v) => v.status === 'committed');
  // snapshot: committed before my start
  const me = e.tx[t];
  return [...vs].reverse().find((v) => v.status === 'committed' && v.commitAt < me.start);
}

function noteIgnored(e: Engine, level: Level, t: TxId, key: string) {
  if (level !== 'ssi') return;
  for (const v of e.versions[key] ?? []) {
    if (v.tx !== 'init' && v.tx !== t && (v.status === 'active' || (v.status === 'committed' && v.commitAt > e.tx[t].start))) e.tx[t].ignored.add(v.tx);
  }
}

function keysWithPrefix(e: Engine, prefix: string) {
  return Object.keys(e.versions).filter((k) => k.startsWith(prefix));
}

/** Returns null if the op can run now, or a string describing what it's waiting for. */
function lockConflict(e: Engine, level: Level, op: Op): string | null {
  const t = op.tx, o = other(t);
  if (e.tx[o].status === 'committed' || e.tx[o].status === 'aborted' || e.tx[o].status === 'idle') {
    // the other tx holds no locks
  }
  const holdsX = (k: string) => e.locksX[k] === o;
  const holdsS = (k: string) => e.locksS[k]?.has(o);
  if (op.kind === 'write') {
    if (level === 'none') return null;
    if (holdsX(op.key!)) return `exclusive lock on ${op.key} held by ${o}`;
    if (level === '2pl') {
      if (holdsS(op.key!)) return `shared lock on ${op.key} held by ${o}`;
      if (e.predicate.some((p) => p.tx === o && op.key!.startsWith(p.prefix))) return `predicate lock (index-range lock) held by ${o}`;
    }
    return null;
  }
  if (level === '2pl') {
    if (op.kind === 'read' && holdsX(op.key!)) return `exclusive lock on ${op.key} held by ${o}`;
    if (op.kind === 'count' && keysWithPrefix(e, op.prefix!).some(holdsX)) return `exclusive lock on a matching row held by ${o}`;
  }
  return null;
}

function abortTx(e: Engine, t: TxId, why: string) {
  const s = e.tx[t];
  s.status = 'aborted';
  for (const vs of Object.values(e.versions)) for (const v of vs) if (v.tx === t && v.status === 'active') v.status = 'aborted';
  for (const k of Object.keys(e.locksX)) if (e.locksX[k] === t) delete e.locksX[k];
  for (const sset of Object.values(e.locksS)) sset.delete(t);
  e.predicate = e.predicate.filter((p) => p.tx !== t);
  e.log.push({ text: `${t} ABORTED: ${why}. The application should retry it.`, tone: 'bad' });
}

function runOp(e: Engine, level: Level, sc: Scenario, i: number, detectLost: boolean) {
  const op = sc.ops[i];
  const t = op.tx;
  const s = e.tx[t];
  if (s.status === 'idle') { s.status = 'active'; s.start = ++e.clock; }
  s.status = 'active';
  s.blockedOn = undefined;
  const fmt = (v: Val | null | undefined) => (v === undefined || v === null ? '∅' : String(v));
  if (op.kind === 'read') {
    noteIgnored(e, level, t, op.key!);
    const v = visible(e, level, t, op.key!);
    s.vars[op.into!] = (v?.value ?? 0) as Val;
    s.readKeys.add(op.key!);
    if (level === '2pl') (e.locksS[op.key!] ??= new Set()).add(t);
    const dirty = v && v.tx !== 'init' && v.tx !== t && v.status === 'active';
    e.results[i] = `→ ${fmt(v?.value)}${dirty ? ' (UNCOMMITTED data!)' : ''}`;
    e.log.push({ text: `${t}: ${op.label} → ${fmt(v?.value)}${dirty ? `  ⚠ dirty read of ${v!.tx}'s uncommitted write` : ''}`, tone: dirty ? 'bad' : undefined });
  } else if (op.kind === 'count') {
    let n = 0;
    for (const k of keysWithPrefix(e, op.prefix!)) {
      noteIgnored(e, level, t, k);
      const v = visible(e, level, t, k);
      if (v && v.value !== null && op.where!(v.value)) n++;
    }
    s.vars[op.into!] = n;
    s.readPrefixes.push(op.prefix!);
    if (level === '2pl') e.predicate.push({ tx: t, prefix: op.prefix! });
    e.results[i] = `→ ${n}`;
    e.log.push({ text: `${t}: ${op.label} → ${n}${level === '2pl' ? '  (shared predicate lock taken)' : ''}` });
  } else if (op.kind === 'write') {
    if (op.cond && !op.cond(s.vars)) {
      e.results[i] = 'skipped (condition false)';
      e.log.push({ text: `${t}: ${op.label} → condition false, nothing written`, tone: 'good' });
    } else {
      if ((level === 'si' && detectLost) || level === 'ssi') {
        const vs = e.versions[op.key!] ?? [];
        const concurrent = vs.find((v) => v.tx !== t && v.tx !== 'init' && v.status === 'committed' && v.commitAt > s.start);
        if (concurrent) {
          e.done[i] = true; e.results[i] = 'lost update detected';
          abortTx(e, t, `${concurrent.tx} already committed a change to ${op.key} after ${t}'s snapshot was taken (lost update detection)`);
          return;
        }
      }
      const value = typeof op.value === 'function' ? op.value(s.vars) : op.value!;
      (e.versions[op.key!] ??= []).push({ value, tx: t, status: 'active', commitAt: 0 });
      s.writes.add(op.key!);
      if (level !== 'none') e.locksX[op.key!] = t;
      e.results[i] = `wrote ${fmt(value)}`;
      e.log.push({ text: `${t}: ${op.label} → wrote ${fmt(value)}${level !== 'none' ? ' (exclusive lock held until commit)' : ''}` });
    }
  } else {
    // commit
    if (level === 'ssi' && s.writes.size > 0) {
      const o = other(t);
      const oc = e.tx[o];
      const premiseChanged = oc.status === 'committed' && oc.commitAt > s.start &&
        ([...oc.writes].some((k) => s.readKeys.has(k) || s.readPrefixes.some((p) => k.startsWith(p))));
      if (premiseChanged || (s.ignored.has(o) && oc.status === 'committed')) {
        e.done[i] = true; e.results[i] = 'ABORT';
        abortTx(e, t, `serialization conflict — ${o} committed a write to data ${t} had read, so ${t}'s premise is outdated`);
        return;
      }
    }
    s.status = 'committed';
    s.commitAt = ++e.clock;
    for (const vs of Object.values(e.versions)) for (const v of vs) if (v.tx === t && v.status === 'active') { v.status = 'committed'; v.commitAt = s.commitAt; }
    for (const k of Object.keys(e.locksX)) if (e.locksX[k] === t) delete e.locksX[k];
    for (const sset of Object.values(e.locksS)) sset.delete(t);
    e.predicate = e.predicate.filter((p) => p.tx !== t);
    e.results[i] = 'committed';
    e.log.push({ text: `${t}: commit ✓${level === '2pl' || level === 'rc' || level === 'si' || level === 'ssi' ? ' (locks released)' : ''}`, tone: 'good' });
  }
  e.done[i] = true;
}

export function step(prev: Engine, level: Level, sc: Scenario, detectLost: boolean): Engine {
  const e = clone(prev);
  const next = (t: TxId) => sc.ops.findIndex((op, i) => op.tx === t && !e.done[i]);
  // candidate order: unblocked-but-waiting tx first, then script order
  const pending = sc.ops.map((op, i) => ({ op, i })).filter(({ i }) => !e.done[i]);
  const order: number[] = [];
  for (const t of ['A', 'B'] as TxId[]) if (e.tx[t].status === 'blocked') { const n = next(t); if (n >= 0) order.push(n); }
  for (const { i } of pending) if (!order.includes(i) && next(sc.ops[i].tx) === i) order.push(i);
  for (const i of order) {
    const op = sc.ops[i];
    if (e.tx[op.tx].status === 'aborted') { e.done[i] = true; e.results[i] = 'not run (aborted)'; return e; }
    const c = lockConflict(e, level, op);
    if (c === null) { runOp(e, level, sc, i, detectLost); return e; }
    if (e.tx[op.tx].status !== 'blocked') {
      if (e.tx[op.tx].status === 'idle') e.tx[op.tx].start = ++e.clock;
      e.tx[op.tx].status = 'blocked';
      e.tx[op.tx].blockedOn = c;
      e.tx[op.tx].blockedSince = ++e.clock;
      e.results[i] = `⏳ waiting: ${c}`;
      e.log.push({ text: `${op.tx}: ${op.label} → BLOCKED, waiting for ${c}`, tone: 'warn' });
      return e;
    }
  }
  // everybody remaining is blocked → deadlock
  const blocked = (['A', 'B'] as TxId[]).filter((t) => e.tx[t].status === 'blocked');
  if (blocked.length === 2) {
    const victim = blocked.sort((a, b) => (e.tx[b].blockedSince ?? 0) - (e.tx[a].blockedSince ?? 0))[0];
    e.log.push({ text: 'DEADLOCK: A waits for B and B waits for A. The database aborts one of them.', tone: 'bad' });
    abortTx(e, victim, 'chosen as the deadlock victim');
    for (let i = 0; i < sc.ops.length; i++) if (sc.ops[i].tx === victim && !e.done[i]) { e.done[i] = true; e.results[i] = 'not run (aborted)'; }
  }
  return e;
}

export function finalDb(e: Engine): Record<string, Val> {
  const out: Record<string, Val> = {};
  for (const [k, vs] of Object.entries(e.versions)) {
    const c = [...vs].reverse().find((v) => v.status === 'committed');
    if (c && c.value !== null) out[k] = c.value;
  }
  return out;
}

const LEVELS: { value: Level; label: string }[] = [
  { value: 'none', label: 'No isolation' },
  { value: 'rc', label: 'Read committed' },
  { value: 'si', label: 'Snapshot isolation' },
  { value: '2pl', label: 'Serializable: 2PL' },
  { value: 'ssi', label: 'Serializable: SSI' },
];

export default function TxnSim({ scenario: initialScenario = 'lost', level: initialLevel = 'none' }: { scenario?: string; level?: Level }) {
  const [scKey, setScKey] = useState(initialScenario);
  const [level, setLevel] = useState<Level>(initialLevel);
  const [detectLost, setDetectLost] = useState(true);
  const sc = SCENARIOS[scKey];
  const [hist, setHist] = useState<Engine[]>(() => [initEngine(sc)]);
  const e = hist[hist.length - 1];
  const finished = e.done.every(Boolean);

  const reset = (k = scKey) => setHist([initEngine(SCENARIOS[k])]);
  const doStep = () => { if (!finished) setHist([...hist, step(e, level, sc, detectLost)]); };
  const runAll = () => {
    let cur = e;
    const out = [...hist];
    for (let n = 0; n < 30 && !cur.done.every(Boolean); n++) { cur = step(cur, level, sc, detectLost); out.push(cur); }
    setHist(out);
  };
  const result = useMemo(() => (finished ? sc.check(finalDb(e), { A: e.tx.A.vars, B: e.tx.B.vars }, { A: e.tx.A.status, B: e.tx.B.status }) : null), [finished, e, sc]);

  const statusChip = (t: TxId) => {
    const s = e.tx[t].status;
    const color = s === 'committed' ? 'var(--v-b)' : s === 'aborted' ? 'var(--v-d)' : s === 'blocked' ? 'var(--v-c)' : 'var(--ink-3)';
    return <span className="chip" style={{ borderColor: color, color }}>{s}</span>;
  };

  return (
    <div>
      <Controls>
        <span className="small muted">Scenario:</span>
        <select value={scKey} onChange={(ev) => { setScKey(ev.target.value); reset(ev.target.value); }}>
          {Object.entries(SCENARIOS).map(([k, s]) => <option key={k} value={k}>{s.name} ({s.figure})</option>)}
        </select>
      </Controls>
      <Controls>
        <Seg value={level} onChange={(l) => { setLevel(l); reset(); }} options={LEVELS} />
        {level === 'si' && <label><input type="checkbox" checked={detectLost} onChange={(ev) => { setDetectLost(ev.target.checked); reset(); }} /> detect lost updates (PostgreSQL-style)</label>}
      </Controls>
      <Controls>
        <button className="btn sm primary" disabled={finished} onClick={doStep}>Next step</button>
        <button className="btn sm" disabled={finished} onClick={runAll}>Run to end</button>
        <button className="btn sm" disabled={hist.length < 2} onClick={() => setHist(hist.slice(0, -1))}>Back</button>
        <button className="btn sm ghost" onClick={() => reset()}>Reset</button>
      </Controls>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 0.9fr', gap: 10 }}>
        {(['A', 'B'] as TxId[]).map((t) => (
          <div key={t} style={{ border: '1px solid var(--line)', borderRadius: 10, padding: 8, background: 'var(--v-fill)' }}>
            <div className="row" style={{ justifyContent: 'space-between' }}><b>{t}: {sc.txNames[t]}</b>{statusChip(t)}</div>
            {sc.ops.map((op, i) => op.tx !== t ? null : (
              <div key={i} style={{ fontSize: 13, padding: '3px 0', borderBottom: '1px dashed var(--line)', opacity: e.done[i] ? 1 : e.results[i] ? 0.9 : 0.5 }}>
                <span style={{ fontFamily: 'var(--mono)', color: 'var(--ink-3)', marginRight: 4 }}>{i + 1}.</span>
                {op.label}
                {e.results[i] && <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: e.results[i]!.includes('UNCOMMITTED') || e.results[i]!.includes('ABORT') || e.results[i]!.includes('lost') || e.results[i]!.includes('aborted') ? 'var(--v-d)' : e.results[i]!.startsWith('⏳') ? 'var(--v-c)' : 'var(--v-b)' }}>{e.results[i]}</div>}
              </div>
            ))}
            {Object.keys(e.tx[t].vars).length > 0 && <div className="small muted" style={{ marginTop: 4 }}>local: {Object.entries(e.tx[t].vars).map(([k, v]) => `${k}=${v}`).join(', ')}</div>}
          </div>
        ))}
        <div style={{ border: '1.5px solid var(--v-a)', borderRadius: 10, padding: 8 }}>
          <b>Database</b>
          {Object.entries(e.versions).map(([k, vs]) => (
            <div key={k} style={{ fontFamily: 'var(--mono)', fontSize: 12, marginTop: 4 }}>
              <div style={{ fontWeight: 700 }}>{k}{e.locksX[k] ? <span style={{ color: 'var(--v-c)' }}> 🔒X:{e.locksX[k]}</span> : ''}{e.locksS[k]?.size ? <span style={{ color: 'var(--v-e)' }}> 🔒S:{[...e.locksS[k]].join(',')}</span> : ''}</div>
              {vs.filter((v) => v.status !== 'aborted').map((v, j) => (
                <div key={j} style={{ paddingLeft: 8, color: v.status === 'active' ? 'var(--v-c)' : undefined }}>
                  {String(v.value)} <span className="muted">· by {v.tx}{v.status === 'active' ? ' (uncommitted)' : ''}</span>
                </div>
              ))}
            </div>
          ))}
          {e.predicate.length > 0 && <div className="small" style={{ color: 'var(--v-e)', marginTop: 6 }}>predicate locks: {e.predicate.map((p) => `${p.tx} on "${p.prefix}*"`).join('; ')}</div>}
        </div>
      </div>
      <div className="log" style={{ maxHeight: 150 }}>
        {e.log.length === 0 ? <div className="muted">Press “Next step”. Steps run in the order shown by the numbers, unless a transaction is blocked.</div> :
          e.log.map((l, i) => <div key={i} style={{ color: l.tone === 'bad' ? 'var(--bad)' : l.tone === 'good' ? 'var(--good)' : l.tone === 'warn' ? 'var(--warn)' : undefined }}>{l.text}</div>)}
      </div>
      {result && (
        <div className={`feedback ${result.ok ? 'good' : 'bad'}`} style={{ marginTop: 8 }}>
          <strong>{result.ok ? '✓ Correct outcome' : '✗ Anomaly'}</strong> {result.msg}
        </div>
      )}
    </div>
  );
}
