import { useState } from 'react';
import { Controls, Seg, Stat } from './ui';

/**
 * Chapter 11, pp. 437-442.
 * Tab "race": Figure 11-4 - two clients dual-write X to a database and a search index; with unlucky timing the two
 * systems end up permanently different. With change data capture (Figure 11-5) the index applies the database's
 * change log in the database's order, so it always converges to the database's value.
 * Tab "compaction": a CDC topic with log compaction - keep only the latest value per key (null = tombstone);
 * a new consumer reading from offset 0 rebuilds the full current state.
 */

export type Order = 'A-first' | 'B-first';

/**
 * dbOrder / indexOrder: which client's write each system processes first.
 * Returns final values and whether they diverged. With CDC, the index applies the db's change log order.
 */
export function dualWrite(dbOrder: Order, indexOrder: Order, cdc: boolean, failIndexWrite = false) {
  const apply = (order: Order) => (order === 'A-first' ? ['A', 'B'] : ['B', 'A']);
  const dbSeq = apply(dbOrder);
  const db = dbSeq[dbSeq.length - 1];
  let index: string;
  let indexSeq: string[];
  if (cdc) {
    indexSeq = dbSeq;                                   // the index follows the database's log
    index = indexSeq[indexSeq.length - 1];
  } else {
    indexSeq = apply(indexOrder).filter((v) => !(failIndexWrite && v === indexOrder[0]));
    index = indexSeq.length ? indexSeq[indexSeq.length - 1] : '(old)';
  }
  return { db, index, dbSeq, indexSeq, consistent: db === index };
}

export interface ChangeRec { key: string; value: string | null }

export function compact(log: ChangeRec[]): ChangeRec[] {
  const last = new Map<string, number>();
  log.forEach((r, i) => last.set(r.key, i));
  return log.filter((r, i) => last.get(r.key) === i && r.value !== null);
}

export function materialize(log: ChangeRec[]): Record<string, string> {
  const state: Record<string, string> = {};
  for (const r of log) { if (r.value === null) delete state[r.key]; else state[r.key] = r.value; }
  return state;
}

export const CHANGELOG: ChangeRec[] = [
  { key: 'user:1', value: 'Ada' }, { key: 'user:2', value: 'Bo' }, { key: 'user:1', value: 'Ada L.' },
  { key: 'user:3', value: 'Cy' }, { key: 'user:2', value: null }, { key: 'user:1', value: 'Ada Lovelace' },
  { key: 'user:4', value: 'Di' }, { key: 'user:3', value: 'Cyrus' },
];

export default function DualWriteSim({ initialTab = 'race' }: { initialTab?: 'race' | 'compaction' }) {
  const [tab, setTab] = useState(initialTab);
  return (
    <div>
      <Controls>
        <Seg value={tab} onChange={setTab} options={[{ value: 'race', label: 'Dual writes vs CDC (Fig 11-4/11-5)' }, { value: 'compaction', label: 'Log compaction' }]} />
      </Controls>
      {tab === 'race' ? <Race /> : <Compaction />}
    </div>
  );
}

function Race() {
  const [dbOrder, setDbOrder] = useState<Order>('A-first');
  const [indexOrder, setIndexOrder] = useState<Order>('B-first');
  const [cdc, setCdc] = useState(false);
  const [fail, setFail] = useState(false);
  const r = dualWrite(dbOrder, indexOrder, cdc, fail);
  const W = 640, H = 170;
  return (
    <div>
      <Controls>
        <Seg value={cdc ? 'cdc' : 'dual'} onChange={(v) => setCdc(v === 'cdc')} options={[{ value: 'dual', label: 'Application dual-writes' }, { value: 'cdc', label: 'Change data capture' }]} />
      </Controls>
      <Controls>
        <label>Database receives <Seg value={dbOrder} onChange={setDbOrder} options={[{ value: 'A-first', label: 'A then B' }, { value: 'B-first', label: 'B then A' }]} /></label>
        {!cdc && <label>Search index receives <Seg value={indexOrder} onChange={setIndexOrder} options={[{ value: 'A-first', label: 'A then B' }, { value: 'B-first', label: 'B then A' }]} /></label>}
        {!cdc && <label><input type="checkbox" checked={fail} onChange={(e) => setFail(e.target.checked)} /> first index write fails</label>}
      </Controls>
      <svg className="dg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Clients writing to a database and a search index">
        <rect x={20} y={20} width={110} height={34} rx={6} className="boxa" /><text x={75} y={42} textAnchor="middle">Client 1: X=A</text>
        <rect x={20} y={110} width={110} height={34} rx={6} className="boxe" /><text x={75} y={132} textAnchor="middle">Client 2: X=B</text>
        <rect x={250} y={20} width={150} height={48} rx={8} className="boxb" /><text x={325} y={40} textAnchor="middle" fontWeight={700}>Database</text><text x={325} y={58} textAnchor="middle" className="sub">applied {r.dbSeq.join(' → ')} · X = {r.db}</text>
        <rect x={250} y={100} width={150} height={48} rx={8} className={r.consistent ? 'boxb' : 'boxd'} /><text x={325} y={120} textAnchor="middle" fontWeight={700}>Search index</text><text x={325} y={138} textAnchor="middle" className="sub">applied {r.indexSeq.join(' → ') || '—'} · X = {r.index}</text>
        {cdc ? (
          <g><path className="lna" d="M325 68 L325 100" /><text x={335} y={88} className="sub">change log (CDC), in the database's order</text>
            <path className="ln" d="M130 37 L250 40 M130 127 L250 50" /></g>
        ) : (
          <path className="ln" d="M130 37 L250 40 M130 37 L250 115 M130 127 L250 50 M130 127 L250 128" />
        )}
        <text x={430} y={84} fontWeight={700} fill={r.consistent ? 'var(--v-b)' : 'var(--v-d)'}>{r.consistent ? '✓ consistent' : '✕ permanently inconsistent'}</text>
      </svg>
      <p className="small muted">{cdc ? 'The database is the only leader; the index is a follower consuming its change stream in order (Figure 11-5). Whatever the interleaving, the index converges to the database’s value. (It may lag — CDC is usually asynchronous.)' : 'Two leaders, neither following the other: interleaved writes leave the systems disagreeing with no error reported (Figure 11-4); a failed second write does too — preventing that needs atomic commit (p. 438).'}</p>
    </div>
  );
}

function Compaction() {
  const [n, setN] = useState(CHANGELOG.length);
  const log = CHANGELOG.slice(0, n);
  const compacted = compact(log);
  const state = materialize(log);
  const rebuilt = materialize(compacted);
  return (
    <div>
      <Controls>
        <label>Changes so far: <input type="range" min={1} max={CHANGELOG.length} value={n} onChange={(e) => setN(Number(e.target.value))} /> <b>{n}</b></label>
      </Controls>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <div className="opt" style={{ margin: 0, flex: 1, minWidth: 190, cursor: 'default' }}>
          <b>Change log (CDC topic)</b>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 12.5 }}>{log.map((r, i) => <div key={i}>{i}: {r.key} = {r.value === null ? 'null (delete)' : r.value}</div>)}</div>
        </div>
        <div className="opt correct" style={{ margin: 0, flex: 1, minWidth: 190, cursor: 'default' }}>
          <b>After log compaction</b>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 12.5 }}>{compacted.map((r, i) => <div key={i}>{r.key} = {r.value}</div>)}</div>
        </div>
        <div className="opt" style={{ margin: 0, flex: 1, minWidth: 190, cursor: 'default' }}>
          <b>New consumer reads compacted log from offset 0</b>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 12.5 }}>{Object.entries(rebuilt).map(([k, v]) => <div key={k}>{k} → {v}</div>)}</div>
        </div>
      </div>
      <div style={{ marginTop: 6 }}>
        <Stat label="Log entries" value={log.length} />
        <Stat label="After compaction" value={compacted.length} tone="good" />
        <Stat label="Rebuilt state = database state" value={JSON.stringify(rebuilt) === JSON.stringify(state) ? 'yes' : 'no'} tone="good" />
      </div>
      <p className="small muted">Compaction keeps the most recent value per key and drops keys whose latest value is a null tombstone; the space needed depends on the current contents of the database, not on how many writes ever happened (p. 441). That lets you build a new derived system from offset 0 without a fresh snapshot of the source database.</p>
    </div>
  );
}
