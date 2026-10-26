import { useMemo, useState } from 'react';
import { Controls, Stat } from './ui';

/** Figure 3-12: a 2-D data cube (date × product) of SUM(net_price), with roll-ups along each dimension. */
const DATES = [140101, 140102, 140103, 140104];
const PRODUCTS = [32, 33, 34, 35];

export default function DataCubeViz() {
  const raw = useMemo(() => {
    // 400 synthetic sales facts with a price attribute
    let s = 3;
    const next = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    return Array.from({ length: 400 }, () => ({
      date: DATES[Math.floor(next() * 4)], product: PRODUCTS[Math.floor(next() * 4)], price: Math.round((next() ** 3 * 180 + 1) * 100) / 100,
    }));
  }, []);
  const cell = (d: number, p: number) => raw.filter((r) => r.date === d && r.product === p).reduce((a, r) => a + r.price, 0);
  const [sel, setSel] = useState<{ kind: 'cell' | 'row' | 'col' | 'all'; d?: number; p?: number } | null>(null);
  const [q, setQ] = useState<'none' | 'over100'>('none');
  const rowTotal = (d: number) => PRODUCTS.reduce((a, p) => a + cell(d, p), 0);
  const colTotal = (p: number) => DATES.reduce((a, d) => a + cell(d, p), 0);
  const grand = raw.reduce((a, r) => a + r.price, 0);
  const isSel = (d?: number, p?: number) =>
    sel && ((sel.kind === 'cell' && sel.d === d && sel.p === p) || (sel.kind === 'row' && sel.d === d && p === undefined) || (sel.kind === 'col' && sel.p === p && d === undefined) || (sel.kind === 'all' && d === undefined && p === undefined));
  const td = (key: string, content: number, on: boolean, onClick: () => void, strong = false) => (
    <td key={key} onClick={onClick} style={{
      padding: '6px 10px', textAlign: 'right', cursor: 'pointer', fontVariantNumeric: 'tabular-nums', fontWeight: strong ? 700 : 400,
      border: '1px solid var(--line)', background: on ? 'color-mix(in srgb, var(--v-a) 25%, var(--surface))' : strong ? 'var(--surface-2)' : 'var(--surface)',
    }}>{content.toFixed(2)}</td>
  );
  let sql = 'Click a cell or a total.';
  if (sel?.kind === 'cell') sql = `SELECT SUM(net_price) FROM fact_sales WHERE date_key = ${sel.d} AND product_sk = ${sel.p}`;
  if (sel?.kind === 'row') sql = `SELECT SUM(net_price) FROM fact_sales WHERE date_key = ${sel.d}`;
  if (sel?.kind === 'col') sql = `SELECT SUM(net_price) FROM fact_sales WHERE product_sk = ${sel.p}`;
  if (sel?.kind === 'all') sql = 'SELECT SUM(net_price) FROM fact_sales';
  return (
    <div>
      <div className="small muted" style={{ marginBottom: 6 }}>Precomputed SUM(net_price) for every (date, product) combination; totals are roll-ups along one dimension. Raw fact table: {raw.length} rows.</div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr><th style={{ padding: 6 }}>date_key \ product_sk</th>{PRODUCTS.map((p) => <th key={p} style={{ padding: 6 }}>{p}</th>)}<th style={{ padding: 6 }}>total</th></tr>
          </thead>
          <tbody>
            {DATES.map((d) => (
              <tr key={d}>
                <th style={{ padding: 6, fontFamily: 'var(--mono)' }}>{d}</th>
                {PRODUCTS.map((p) => td(`c${d}-${p}`, cell(d, p), !!isSel(d, p) || (sel?.kind === 'row' && sel.d === d) || (sel?.kind === 'col' && sel.p === p) || sel?.kind === 'all', () => setSel({ kind: 'cell', d, p })))}
                {td(`r${d}`, rowTotal(d), !!isSel(d, undefined), () => setSel({ kind: 'row', d }), true)}
              </tr>
            ))}
            <tr>
              <th style={{ padding: 6 }}>total</th>
              {PRODUCTS.map((p) => td(`t${p}`, colTotal(p), !!isSel(undefined, p), () => setSel({ kind: 'col', p }), true))}
              {td("g", grand, !!isSel(undefined, undefined), () => setSel({ kind: 'all' }), true)}
            </tr>
          </tbody>
        </table>
      </div>
      <div className="log" style={{ marginTop: 8 }}>{sql}{sel ? '\n→ answered by reading precomputed cell(s): no scan of raw rows' : ''}</div>
      <Controls>
        <button className={`btn sm ${q === 'over100' ? 'primary' : ''}`} onClick={() => setQ(q === 'over100' ? 'none' : 'over100')}>Ask: what share of sales come from items costing more than $100?</button>
      </Controls>
      {q === 'over100' && (
        <div className="feedback bad fade-in">
          <strong>The cube can't answer this.</strong> Price isn't a dimension of the cube — the individual prices were summed away.
          You must go back to the raw fact table: <Stat label="answer from raw data" value={`${((raw.filter((r) => r.price > 100).reduce((a, r) => a + r.price, 0) / grand) * 100).toFixed(1)}%`} />
          — which is why warehouses keep the raw data and use cubes only as a performance boost.
        </div>
      )}
    </div>
  );
}
