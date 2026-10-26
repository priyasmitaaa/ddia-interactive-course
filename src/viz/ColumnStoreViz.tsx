import { useMemo, useState } from 'react';
import { Controls, Seg, Stat } from './ui';

/** Figure 3-10 (row vs column layout), Figure 3-11 (bitmap + run-length encoding), sort order and compression. */
const COLS = ['date_key', 'product_sk', 'store_sk', 'promotion_sk', 'customer_sk', 'quantity', 'net_price', 'discount_price'];
const ROWS: (string | number)[][] = [
  [140102, 69, 4, 'NULL', 'NULL', 1, 13.99, 13.99],
  [140102, 69, 5, 19, 'NULL', 3, 14.99, 9.99],
  [140102, 69, 5, 'NULL', 191, 1, 14.99, 14.99],
  [140102, 74, 3, 23, 202, 5, 0.99, 0.89],
  [140103, 31, 2, 'NULL', 'NULL', 1, 2.49, 2.49],
  [140103, 31, 3, 'NULL', 'NULL', 3, 14.99, 9.99],
  [140103, 31, 3, 21, 123, 1, 49.99, 39.99],
  [140103, 31, 8, 'NULL', 233, 1, 0.99, 0.99],
];
// Figure 3-11 column, plus a store column for AND queries
const PRODUCT = [69, 69, 69, 69, 74, 31, 31, 31, 31, 29, 30, 30, 31, 31, 31, 68, 69, 69];
const STORE = [3, 3, 5, 5, 3, 3, 2, 3, 3, 1, 3, 3, 2, 3, 3, 4, 3, 5];

function rle(bits: number[]) {
  // alternating run lengths starting with zeros, as in Figure 3-11
  const out: number[] = [];
  let cur = 0, run = 0;
  for (const b of bits) {
    if (b === cur) run++;
    else { out.push(run); cur = b; run = 1; }
  }
  if (cur === 1) out.push(run); // trailing zeros are "rest zeros" and omitted
  return out;
}
const bitmap = (col: number[], v: number) => col.map((x) => (x === v ? 1 : 0));

function runs(values: (string | number)[]) {
  let n = 0;
  for (let i = 0; i < values.length; i++) if (i === 0 || values[i] !== values[i - 1]) n++;
  return n;
}

export default function ColumnStoreViz({ initialTab = 'layout' }: { initialTab?: 'layout' | 'bitmap' | 'sort' }) {
  const [tab, setTab] = useState<'layout' | 'bitmap' | 'sort'>(initialTab);
  return (
    <div>
      <Controls>
        <Seg value={tab} onChange={setTab} options={[
          { value: 'layout', label: '1 · Row vs column layout' },
          { value: 'bitmap', label: '2 · Bitmap encoding' },
          { value: 'sort', label: '3 · Sort order & compression' },
        ]} />
      </Controls>
      {tab === 'layout' && <Layout />}
      {tab === 'bitmap' && <Bitmaps />}
      {tab === 'sort' && <SortOrder />}
    </div>
  );
}

function Layout() {
  const [mode, setMode] = useState<'row' | 'column'>('row');
  const [used, setUsed] = useState<string[]>(['date_key', 'product_sk', 'quantity']);
  const toggle = (c: string) => setUsed((u) => (u.includes(c) ? u.filter((x) => x !== c) : [...u, c]));
  const cell = (ri: number, ci: number) => {
    const read = mode === 'row' || used.includes(COLS[ci]);
    const needed = used.includes(COLS[ci]);
    return (
      <span key={`${ri}-${ci}`} className="chip" style={{
        minWidth: 46, textAlign: 'center',
        background: read ? (needed ? 'color-mix(in srgb, var(--v-a) 22%, var(--surface))' : 'color-mix(in srgb, var(--v-d) 14%, var(--surface))') : 'var(--surface)',
        opacity: read ? 1 : 0.35, borderColor: needed ? 'var(--v-a)' : undefined,
      }}>{String(ROWS[ri][ci])}</span>
    );
  };
  const totalCells = ROWS.length * COLS.length;
  const readCells = mode === 'row' ? totalCells : ROWS.length * used.length;
  const fullTableCols = 100;
  return (
    <div>
      <div className="small" style={{ marginBottom: 6 }}>Columns the query needs (Example 3-1 uses date_key, product_sk, quantity):</div>
      <Controls>
        {COLS.map((c) => <label key={c}><input type="checkbox" checked={used.includes(c)} onChange={() => toggle(c)} /> {c}</label>)}
      </Controls>
      <Controls>
        <Seg value={mode} onChange={setMode} options={[{ value: 'row', label: 'Row-oriented storage' }, { value: 'column', label: 'Column-oriented storage' }]} />
      </Controls>
      {mode === 'row' ? (
        <div>
          <div className="eyebrow">One file; each row's values stored together</div>
          {ROWS.map((_, ri) => <div key={ri}><span className="small muted" style={{ width: 46, display: 'inline-block' }}>row {ri + 1}</span>{COLS.map((_, ci) => cell(ri, ci))}</div>)}
        </div>
      ) : (
        <div>
          <div className="eyebrow">One file per column; the k-th entry of every file belongs to row k</div>
          {COLS.map((c, ci) => (
            <div key={c}><span className="small" style={{ width: 120, display: 'inline-block', fontFamily: 'var(--mono)', color: used.includes(c) ? 'var(--v-a)' : 'var(--ink-3)' }}>{c}</span>{ROWS.map((_, ri) => cell(ri, ci))}</div>
          ))}
        </div>
      )}
      <div style={{ marginTop: 8 }}>
        <Stat label="Values read from disk" value={`${readCells} / ${totalCells}`} tone={mode === 'row' ? 'bad' : 'good'} />
        <Stat label="Wasted reads" value={readCells - ROWS.length * used.length} />
        <Stat label={`With ${fullTableCols} columns (typical fact table)`} value={mode === 'row' ? '100% of data read' : `${Math.round((used.length / fullTableCols) * 100)}% of data read`} />
      </div>
      <div className="hint">Blue = needed by the query. Red = read from disk but thrown away. A row store must load whole rows; a column store loads only the needed column files.</div>
    </div>
  );
}

function Bitmaps() {
  const [inSet, setInSet] = useState<number[]>([30, 68, 69]);
  const [andStore, setAndStore] = useState(false);
  const distinct = useMemo(() => [...new Set(PRODUCT)].sort((a, b) => a - b), []);
  const orBits = PRODUCT.map((p) => (inSet.includes(p) ? 1 : 0));
  const storeBits = bitmap(STORE, 3);
  const result = andStore ? orBits.map((b, i) => b & storeBits[i]) : orBits;
  const Bits = ({ bits, color }: { bits: number[]; color?: string }) => (
    <span style={{ fontFamily: 'var(--mono)', fontSize: 13, letterSpacing: 2 }}>
      {bits.map((b, i) => <span key={i} style={{ color: b ? color ?? 'var(--ink)' : 'var(--v-muted)', fontWeight: b ? 800 : 400 }}>{b}</span>)}
    </span>
  );
  return (
    <div>
      <div className="small" style={{ fontFamily: 'var(--mono)' }}>product_sk column: {PRODUCT.join(' ')}</div>
      <table style={{ borderCollapse: 'collapse', marginTop: 8, fontSize: 13 }}>
        <thead><tr><th style={{ textAlign: 'left', paddingRight: 10 }}>value</th><th style={{ textAlign: 'left' }}>bitmap (one bit per row)</th><th style={{ textAlign: 'left', paddingLeft: 12 }}>run-length encoded</th><th>in query?</th></tr></thead>
        <tbody>
          {distinct.map((v) => (
            <tr key={v}>
              <td style={{ fontFamily: 'var(--mono)', paddingRight: 10 }}>= {v}</td>
              <td><Bits bits={bitmap(PRODUCT, v)} color={inSet.includes(v) ? 'var(--v-a)' : undefined} /></td>
              <td style={{ fontFamily: 'var(--mono)', paddingLeft: 12 }}>{rle(bitmap(PRODUCT, v)).join(', ')}</td>
              <td style={{ textAlign: 'center' }}><input type="checkbox" checked={inSet.includes(v)} onChange={() => setInSet((s) => (s.includes(v) ? s.filter((x) => x !== v) : [...s, v]))} /></td>
            </tr>
          ))}
        </tbody>
      </table>
      <Controls>
        <label><input type="checkbox" checked={andStore} onChange={(e) => setAndStore(e.target.checked)} /> AND store_sk = 3</label>
      </Controls>
      <div style={{ fontFamily: 'var(--mono)', fontSize: 13 }}>
        <div>WHERE product_sk IN ({[...inSet].sort((a, b) => a - b).join(', ') || '—'}) → bitwise OR: <Bits bits={orBits} color="var(--v-a)" /></div>
        {andStore && <div>store_sk = 3 bitmap{' '.repeat(22)}: <Bits bits={storeBits} color="var(--v-b)" /></div>}
        <div style={{ marginTop: 4 }}>result rows{' '.repeat(28)}: <Bits bits={result} color="var(--v-d)" /> → {result.filter(Boolean).length} matching rows</div>
      </div>
      <div className="hint">Run-length encoding lists alternating run lengths: zeros, ones, zeros… (trailing zeros omitted), exactly as in Figure 3-11. Bitwise AND works across columns because every column stores rows in the same order.</div>
    </div>
  );
}

function SortOrder() {
  const [sortBy, setSortBy] = useState<'insert' | 'date' | 'date_product'>('insert');
  const data = useMemo(() => {
    // 60 synthetic sales rows over 3 days, 6 products, 4 stores
    const rows: { date: number; product: number; store: number }[] = [];
    let s = 7;
    const next = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    for (let i = 0; i < 60; i++) rows.push({ date: 140101 + Math.floor(next() * 3), product: 30 + Math.floor(next() * 6), store: 1 + Math.floor(next() * 4) });
    return rows;
  }, []);
  const sorted = useMemo(() => {
    const r = [...data];
    if (sortBy === 'date') r.sort((a, b) => a.date - b.date);
    if (sortBy === 'date_product') r.sort((a, b) => a.date - b.date || a.product - b.product);
    return r;
  }, [data, sortBy]);
  const cols: [string, (string | number)[]][] = [
    ['date_key', sorted.map((r) => r.date)],
    ['product_sk', sorted.map((r) => r.product)],
    ['store_sk', sorted.map((r) => r.store)],
  ];
  return (
    <div>
      <Controls>
        <Seg value={sortBy} onChange={setSortBy} options={[
          { value: 'insert', label: 'Insertion order' },
          { value: 'date', label: 'Sorted by date_key' },
          { value: 'date_product', label: 'by date_key, then product_sk' },
        ]} />
      </Controls>
      {cols.map(([name, vals]) => (
        <div key={name} style={{ marginBottom: 8 }}>
          <div className="small" style={{ fontFamily: 'var(--mono)' }}>{name}: <b>{runs(vals)}</b> runs (fewer runs = better run-length compression)</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {vals.map((v, i) => {
              const hue = (Number(String(v).slice(-2)) * 47) % 360;
              return <span key={i} title={String(v)} style={{ width: 10, height: 18, background: `hsl(${hue} 55% 55%)`, borderRadius: 2 }} />;
            })}
          </div>
        </div>
      ))}
      <Stat label="Rows" value={60} />
      <div className="hint">Rows are sorted as whole rows (columns can't be sorted independently, or we couldn't reassemble rows). The first sort key compresses best; the second a bit; later columns stay jumbled.</div>
    </div>
  );
}
