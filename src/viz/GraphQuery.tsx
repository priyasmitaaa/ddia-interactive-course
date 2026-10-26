import { useEffect, useMemo, useState } from 'react';
import { Controls, Log, Seg, Stat, useLog } from './ui';

/** Figure 2-5 as a property graph, and the "emigrated from US to Europe" query (Example 2-4). */
interface V { id: string; label: string; type: string; x: number; y: number }
type E = [string, string, string]; // tail, label, head

const BASE_V: V[] = [
  { id: 'namerica', label: 'North America', type: 'continent', x: 120, y: 30 },
  { id: 'europe', label: 'Europe', type: 'continent', x: 520, y: 30 },
  { id: 'usa', label: 'United States', type: 'country', x: 120, y: 95 },
  { id: 'uk', label: 'United Kingdom', type: 'country', x: 420, y: 95 },
  { id: 'france', label: 'France', type: 'country', x: 640, y: 95 },
  { id: 'idaho', label: 'Idaho', type: 'state', x: 120, y: 165 },
  { id: 'england', label: 'England', type: 'country', x: 420, y: 165 },
  { id: 'bourgogne', label: 'Burgundy', type: 'région', x: 640, y: 165 },
  { id: 'london', label: 'London', type: 'city', x: 420, y: 235 },
  { id: 'cotedor', label: "Côte-d'Or", type: 'département', x: 640, y: 235 },
  { id: 'beaune', label: 'Beaune', type: 'city', x: 640, y: 305 },
  { id: 'lucy', label: 'Lucy', type: 'person', x: 200, y: 305 },
  { id: 'alain', label: 'Alain', type: 'person', x: 420, y: 330 },
];
const BASE_E: E[] = [
  ['usa', 'within', 'namerica'], ['idaho', 'within', 'usa'], ['uk', 'within', 'europe'], ['england', 'within', 'uk'],
  ['london', 'within', 'england'], ['france', 'within', 'europe'], ['bourgogne', 'within', 'france'],
  ['cotedor', 'within', 'bourgogne'], ['beaune', 'within', 'cotedor'],
  ['lucy', 'born_in', 'idaho'], ['lucy', 'lives_in', 'london'], ['alain', 'born_in', 'beaune'], ['alain', 'lives_in', 'london'],
  ['lucy', 'married', 'alain'],
];
const EXTRA_V: V = { id: 'sam', label: 'Sam', type: 'person', x: 120, y: 245 };
const EXTRA_E: E[] = [['sam', 'born_in', 'usa'], ['sam', 'lives_in', 'beaune']];

type Strategy = 'forward' | 'backward';

export default function GraphQuery() {
  const [strategy, setStrategy] = useState<Strategy>('backward');
  const [extra, setExtra] = useState(false);
  const [visits, setVisits] = useState<string[]>([]);
  const [shown, setShown] = useState(0);
  const [result, setResult] = useState<string[] | null>(null);
  const log = useLog();

  const vs = useMemo(() => (extra ? [...BASE_V, EXTRA_V] : BASE_V), [extra]);
  const es = useMemo(() => (extra ? [...BASE_E, ...EXTRA_E] : BASE_E), [extra]);
  const byId = useMemo(() => Object.fromEntries(vs.map((v) => [v.id, v])), [vs]);

  useEffect(() => {
    if (shown >= visits.length) return;
    const t = setTimeout(() => setShown((s) => s + 1), 280);
    return () => clearTimeout(t);
  }, [shown, visits]);

  const run = () => {
    log.clear();
    const order: string[] = [];
    const out = (v: string, l: string) => es.filter((e) => e[0] === v && e[1] === l).map((e) => e[2]);
    const inc = (v: string, l: string) => es.filter((e) => e[2] === v && e[1] === l).map((e) => e[0]);
    let people: string[] = [];
    if (strategy === 'forward') {
      // scan every person; follow born_in then within* up; then lives_in then within* up
      const reaches = (start: string, target: string) => {
        let cur: string[] = [start];
        while (cur.length) {
          const next: string[] = [];
          for (const c of cur) { order.push(c); if (c === target) return true; next.push(...out(c, 'within')); }
          cur = next;
        }
        return false;
      };
      for (const p of vs.filter((v) => v.type === 'person')) {
        order.push(p.id);
        log.add(`scan person ${p.label}`);
        const b = out(p.id, 'born_in').some((l) => reaches(l, 'usa'));
        const l = b && out(p.id, 'lives_in').some((x) => reaches(x, 'europe'));
        log.add(`  born in US? ${b ? 'yes' : 'no'}${b ? `, lives in Europe? ${l ? 'yes' : 'no'}` : ''}`, b && l ? 'good' : 'muted');
        if (b && l) people.push(p.label);
      }
    } else {
      const down = (root: string) => {
        const set = new Set([root]);
        let frontier = [root];
        while (frontier.length) {
          const next: string[] = [];
          for (const f of frontier) { order.push(f); for (const c of inc(f, 'within')) if (!set.has(c)) { set.add(c); next.push(c); } }
          frontier = next;
        }
        return set;
      };
      log.add('index lookup: name = "United States"; follow incoming WITHIN edges...');
      const inUs = down('usa');
      log.add(`  in_usa = {${[...inUs].map((x) => byId[x].label).join(', ')}}`, 'muted');
      log.add('index lookup: name = "Europe"; follow incoming WITHIN edges...');
      const inEu = down('europe');
      log.add(`  in_europe = {${[...inEu].map((x) => byId[x].label).join(', ')}}`, 'muted');
      const born = new Set([...inUs].flatMap((l) => inc(l, 'born_in')));
      const lives = new Set([...inEu].flatMap((l) => inc(l, 'lives_in')));
      born.forEach((p) => order.push(p));
      log.add(`born_in_usa = {${[...born].map((x) => byId[x].label).join(', ')}}; lives_in_europe = {${[...lives].map((x) => byId[x].label).join(', ')}}`);
      people = [...born].filter((p) => lives.has(p)).map((p) => byId[p].label);
    }
    log.add(`RESULT: ${people.join(', ') || '(none)'}`, 'good');
    setResult(people);
    setVisits(order);
    setShown(0);
  };

  const visited = new Set(visits.slice(0, shown));
  const current = visits[shown - 1];
  const color = (l: string) => (l === 'within' ? 'var(--v-muted)' : l === 'born_in' ? 'var(--v-c)' : l === 'lives_in' ? 'var(--v-b)' : 'var(--v-e)');

  return (
    <div>
      <Controls>
        <Seg value={strategy} onChange={(s) => { setStrategy(s); setVisits([]); setResult(null); log.clear(); }} options={[
          { value: 'forward', label: 'Start from every person' },
          { value: 'backward', label: 'Start from the two locations' },
        ]} />
        <label><input type="checkbox" checked={extra} onChange={(e) => { setExtra(e.target.checked); setVisits([]); setResult(null); log.clear(); }} /> add Sam (born in “United States”, lives in Beaune)</label>
        <button className="btn sm primary" onClick={run}>Run query</button>
      </Controls>
      <svg viewBox="0 0 760 360" aria-label="Property graph of Lucy and Alain">
        <defs>
          <marker id="gq-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill="var(--ink-3)" />
          </marker>
        </defs>
        {es.map(([t, l, h], i) => {
          const a = byId[t], b = byId[h];
          const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
          return (
            <g key={i}>
              <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={color(l)} strokeWidth={l === 'within' ? 1.5 : 2.2} markerEnd="url(#gq-arrow)" />
              {l !== 'within' && <text x={mx} y={my - 4} fontSize={11} textAnchor="middle" style={{ fill: color(l), fontWeight: 600 }}>{l}</text>}
            </g>
          );
        })}
        {vs.map((v) => {
          const on = visited.has(v.id);
          const isCur = current === v.id;
          const hit = result?.includes(v.label);
          return (
            <g key={v.id}>
              <rect x={v.x - 58} y={v.y - 17} width={116} height={34} rx={8}
                fill={hit ? 'color-mix(in srgb, var(--v-b) 30%, var(--surface))' : on ? 'color-mix(in srgb, var(--v-a) 22%, var(--surface))' : 'var(--surface)'}
                stroke={isCur ? 'var(--v-a)' : v.type === 'person' ? 'var(--v-e)' : 'var(--ink-3)'} strokeWidth={isCur ? 3 : 1.2} />
              <text x={v.x} y={v.y - 1} textAnchor="middle" fontSize={12.5} fontWeight={600}>{v.label}</text>
              <text x={v.x} y={v.y + 12} textAnchor="middle" fontSize={10} style={{ fill: 'var(--ink-3)' }}>{v.type}</text>
            </g>
          );
        })}
      </svg>
      <Stat label="Vertices visited" value={Math.min(shown, visits.length)} />
      {result && shown >= visits.length && <Stat label="People who emigrated US → Europe" value={result.join(', ') || 'none'} tone="good" />}
      <Log lines={log.lines} />
      <div className="hint">Both strategies give the same answer — the query is declarative, so an optimizer may pick either. Notice how <code>WITHIN*0..</code> lets the BORN_IN edge point at a state (Lucy), or straight at a country (Sam).</div>
    </div>
  );
}
