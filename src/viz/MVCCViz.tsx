import { useState } from 'react';
import { Controls } from './ui';

/**
 * Figure 7-7 and the visibility rules (pp. 230-232). Rows carry created_by / deleted_by transaction IDs.
 * Pick a reading transaction and see which row versions it can see, and why.
 */
interface Tx { id: number; status: 'committed' | 'in progress' | 'aborted' }
interface Row { account: number; balance: number; created: number; deleted: number | null }

const INITIAL_TXS: Tx[] = [
  { id: 3, status: 'committed' }, { id: 5, status: 'committed' }, { id: 11, status: 'aborted' },
  { id: 12, status: 'in progress' }, { id: 13, status: 'in progress' },
];
const ROWS: Row[] = [
  { account: 1, balance: 500, created: 3, deleted: 13 },
  { account: 1, balance: 600, created: 13, deleted: null },
  { account: 2, balance: 500, created: 5, deleted: 13 },
  { account: 2, balance: 400, created: 13, deleted: null },
  { account: 2, balance: 9999, created: 11, deleted: null },
];

export default function MVCCViz() {
  const [txs, setTxs] = useState<Tx[]>(INITIAL_TXS);
  const [reader, setReader] = useState(12);
  const [inProgressAtStart, setIPAS] = useState<Record<number, number[]>>({ 12: [13], 13: [12], 14: [], 15: [] });
  const status = (id: number) => txs.find((t) => t.id === id)?.status ?? 'committed';
  const ignored = (writer: number, r: number): string | null => {
    if (writer === r) return null;                                   // own writes are visible
    if ((inProgressAtStart[r] ?? []).includes(writer)) return `rule 1: tx ${writer} was in progress when tx ${r} started`;
    if (status(writer) === 'aborted') return `rule 2: tx ${writer} aborted`;
    if (writer > r) return `rule 3: tx ${writer} started after tx ${r}`;
    if (status(writer) === 'in progress') return `tx ${writer} hasn't committed`;
    return null;
  };
  const verdict = (row: Row) => {
    const c = ignored(row.created, reader);
    if (c) return { vis: false, why: `creation ignored — ${c}` };
    if (row.deleted !== null) {
      const d = ignored(row.deleted, reader);
      if (!d) return { vis: false, why: `deleted by tx ${row.deleted}, and that deletion is visible to tx ${reader}` };
      return { vis: true, why: `created by committed tx ${row.created}; deletion by tx ${row.deleted} ignored (${d})` };
    }
    return { vis: true, why: row.created === reader ? 'my own write' : `created by committed tx ${row.created}, not deleted` };
  };
  const commit13 = () => setTxs(txs.map((t) => (t.id === 13 ? { ...t, status: 'committed' } : t)));
  const startNew = () => {
    const id = Math.max(...txs.map((t) => t.id)) + 1;
    setIPAS({ ...inProgressAtStart, [id]: txs.filter((t) => t.status === 'in progress').map((t) => t.id) });
    setTxs([...txs, { id, status: 'in progress' }]);
    setReader(id);
  };
  return (
    <div>
      <Controls>
        <span className="small muted">Reading transaction:</span>
        {txs.filter((t) => t.status === 'in progress' || t.id > 13).map((t) => (
          <button key={t.id} className={`btn sm ${reader === t.id ? 'primary' : ''}`} onClick={() => setReader(t.id)}>tx {t.id}</button>
        ))}
        <button className="btn sm" disabled={status(13) === 'committed'} onClick={commit13}>Commit tx 13 (the transfer)</button>
        <button className="btn sm" onClick={startNew}>Start a new transaction</button>
        <button className="btn sm ghost" onClick={() => { setTxs(INITIAL_TXS); setReader(12); setIPAS({ 12: [13], 13: [12] }); }}>Reset</button>
      </Controls>
      <div className="small" style={{ marginBottom: 6 }}>
        Transactions: {txs.map((t) => <span key={t.id} className={`chip ${t.status === 'committed' ? 'b' : t.status === 'aborted' ? 'd' : 'c'}`}>tx {t.id}: {t.status}</span>)}
        <span className="muted"> · tx {reader} started while {(inProgressAtStart[reader] ?? []).map((i) => `tx ${i}`).join(', ') || 'nothing else'} was in progress</span>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
        <thead><tr style={{ textAlign: 'left' }}><th>account</th><th>balance</th><th>created_by</th><th>deleted_by</th><th>visible to tx {reader}?</th></tr></thead>
        <tbody>
          {ROWS.map((r, i) => {
            const v = verdict(r);
            return (
              <tr key={i} style={{ borderTop: '1px solid var(--line)', background: v.vis ? 'color-mix(in srgb, var(--v-b) 12%, transparent)' : undefined }}>
                <td style={{ padding: 4 }}>{r.account}</td>
                <td style={{ fontFamily: 'var(--mono)' }}>${r.balance}</td>
                <td>{r.created}</td><td>{r.deleted ?? '—'}</td>
                <td><b style={{ color: v.vis ? 'var(--good)' : 'var(--ink-3)' }}>{v.vis ? 'visible' : 'invisible'}</b> <span className="small muted">— {v.why}</span></td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="feedback" style={{ marginTop: 8 }}>
        tx {reader} sees: account 1 = ${ROWS.filter((r) => r.account === 1 && verdict(r).vis).map((r) => r.balance).join(' / ') || '∅'}, account 2 = ${ROWS.filter((r) => r.account === 2 && verdict(r).vis).map((r) => r.balance).join(' / ') || '∅'}
        {' '}→ total ${ROWS.filter((r) => verdict(r).vis).reduce((a, r) => a + r.balance, 0)}
      </div>
      <div className="hint">An update is a delete plus a create. Try: read as tx 12, commit tx 13 — tx 12 still sees $500/$500 (its snapshot). Start a new transaction after the commit — it sees $600/$400. Either way the total is $1000.</div>
    </div>
  );
}
