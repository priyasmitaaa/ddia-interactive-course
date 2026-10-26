import { useState } from 'react';
import { Controls, Seg, Slider, Stat } from './ui';

/**
 * Chapter 10, pp. 379-385: the log-analysis pipeline `cat | awk '{print $7}' | sort | uniq -c | sort -r -n | head -n 5`,
 * one stage at a time on a small sample log ("end the pipeline at any point and look at it", p. 385), plus the
 * in-memory hash table vs sort trade-off (pp. 381-382).
 */

const PAGES = ['/favicon.ico', '/2013/05/24/improving-security-of-ssh-private-keys.html', '/', '/css/typography.css', '/2012/12/05/schema-evolution.html', '/about'];
const IPS = ['216.58.210.78', '66.249.66.1', '157.55.39.12', '93.184.216.34'];
// deterministic sample: weights make the ordering interesting
const WEIGHTS = [7, 5, 3, 4, 2, 1];

export function sampleLog(): string[] {
  const lines: string[] = [];
  let k = 0;
  for (let round = 0; round < 7; round++) {
    PAGES.forEach((p, i) => {
      if (round < WEIGHTS[i]) {
        const ip = IPS[(k * 7 + i) % IPS.length];
        const sec = String(10 + (k % 50)).padStart(2, '0');
        lines.push(`${ip} - - [27/Feb/2015:17:55:${sec} +0000] "GET ${p} HTTP/1.1" 200 ${1000 + k * 37} "-" "Mozilla/5.0"`);
        k++;
      }
    });
  }
  return lines;
}

export type Field = 'url' | 'ip' | 'url-no-css';

/** Run the pipeline up to and including stage `upTo` (0 = cat … 5 = head). */
export function runPipeline(lines: string[], upTo: number, field: Field): string[] {
  let cur = [...lines];
  if (upTo >= 1) {
    cur = cur.map((l) => l.split(/\s+/)).filter((f) => field !== 'url-no-css' || !/\.css$/.test(f[6])).map((f) => (field === 'ip' ? f[0] : f[6]));
  }
  if (upTo >= 2) cur = [...cur].sort();
  if (upTo >= 3) {
    const out: string[] = [];
    for (let i = 0; i < cur.length;) {
      let j = i;
      while (j < cur.length && cur[j] === cur[i]) j++;
      out.push(`${String(j - i).padStart(7, ' ')} ${cur[i]}`);
      i = j;
    }
    cur = out;
  }
  if (upTo >= 4) cur = [...cur].sort((a, b) => parseInt(b, 10) - parseInt(a, 10));
  if (upTo >= 5) cur = cur.slice(0, 5);
  return cur;
}

const STAGES = ['cat access.log', "awk '{print $7}'", 'sort', 'uniq -c', 'sort -r -n', 'head -n 5'];

export default function PipelineViz() {
  const [upTo, setUpTo] = useState(5);
  const [field, setField] = useState<Field>('url');
  const [distinct, setDistinct] = useState(1); // millions of distinct keys
  const [mem, setMem] = useState(1);           // GB
  const lines = sampleLog();
  const out = runPipeline(lines, upTo, field);
  const awkText = field === 'ip' ? "awk '{print $1}'" : field === 'url-no-css' ? "awk '$7 !~ /\\.css$/ {print $7}'" : "awk '{print $7}'";
  // working-set estimate: ~100 bytes per URL + 8-byte counter + hash table overhead (~2x) — illustrative
  const workingGB = (distinct * 1e6 * 216) / 1e9;
  const fits = workingGB <= mem;
  const inputGB = 50;
  const segments = Math.ceil(inputGB / mem);
  return (
    <div>
      <Controls>
        <Seg value={field} onChange={setField} options={[{ value: 'url', label: 'top pages' }, { value: 'url-no-css', label: 'pages, no CSS' }, { value: 'ip', label: 'top client IPs' }]} />
      </Controls>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, margin: '6px 0' }}>
        {STAGES.map((s, i) => (
          <button key={s} className={`btn sm ${i === upTo ? 'primary' : ''}`} onClick={() => setUpTo(i)} style={{ fontFamily: 'var(--mono)', opacity: i <= upTo ? 1 : 0.5 }}>
            {i === 1 ? awkText : s}{i < STAGES.length - 1 ? ' |' : ''}
          </button>
        ))}
      </div>
      <div className="log" style={{ maxHeight: 220 }}>
        {out.slice(0, 40).map((l, i) => <div key={i}>{l}</div>)}
        {out.length > 40 && <div style={{ color: 'var(--ink-3)' }}>… {out.length - 40} more lines</div>}
      </div>
      <div className="small muted" style={{ marginTop: 4 }}>Showing the output after <b style={{ fontFamily: 'var(--mono)' }}>{upTo === 1 ? awkText : STAGES[upTo]}</b> · {out.length} lines. Click a stage to "end the pipeline there" (p. 385).</div>
      <h4 style={{ margin: '14px 0 4px' }}>Hash table or sort?</h4>
      <Controls>
        <Slider label="Distinct URLs" value={distinct} min={0.1} max={50} step={0.1} onChange={setDistinct} fmt={(v) => `${v.toFixed(1)} M`} />
        <Slider label="Memory" value={mem} min={0.5} max={16} step={0.5} onChange={setMem} fmt={(v) => `${v} GB`} />
      </Controls>
      <div>
        <Stat label="Hash table working set" value={`≈ ${workingGB.toFixed(2)} GB`} tone={fits ? 'good' : 'bad'} />
        <Stat label="In-memory aggregation (the Ruby script)" value={fits ? 'fits — fine, even on a laptop' : 'does not fit — swapping or out of memory'} tone={fits ? 'good' : 'bad'} />
        <Stat label="sort on a 50 GB log" value={`spills ~${segments} sorted segments, then merges them sequentially`} tone="good" />
      </div>
      <p className="small muted">The hash table's size depends only on the number of <i>distinct</i> keys (p. 381). Sorting needs memory for just one chunk at a time and writes sorted runs to disk, then merges them — the SSTable idea from Chapter 3. GNU sort spills to disk and parallelizes automatically (p. 382). Working-set estimate ≈ 216 bytes per distinct key — illustrative, not measured.</p>
    </div>
  );
}
