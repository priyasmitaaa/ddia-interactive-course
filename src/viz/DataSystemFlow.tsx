import { useEffect, useRef, useState } from 'react';
import { Controls, Log, useLog } from './ui';

type N = 'client' | 'app' | 'cache' | 'db' | 'queue' | 'search' | 'worker';
const POS: Record<N, [number, number, string]> = {
  client: [360, 34, 'Client'],
  app: [360, 120, 'Application code'],
  cache: [110, 120, 'In-memory cache'],
  search: [610, 120, 'Full-text index'],
  db: [360, 220, 'Primary database'],
  queue: [610, 220, 'Message queue'],
  worker: [610, 310, 'Worker (e.g. send email)'],
};
const EDGES: [N, N][] = [
  ['client', 'app'], ['app', 'cache'], ['app', 'db'], ['app', 'search'], ['app', 'queue'], ['queue', 'worker'], ['db', 'search'],
];

interface Step { from: N; to: N; text: string; effect?: () => void; tone?: 'good' | 'bad' | 'warn' }

export default function DataSystemFlow() {
  const [db, setDb] = useState('Alice');
  const [cache, setCache] = useState<string | null>(null);
  const [index, setIndex] = useState('Alice');
  const [invalidate, setInvalidate] = useState(true);
  const [steps, setSteps] = useState<Step[]>([]);
  const [i, setI] = useState(0);
  const [t, setT] = useState(0);
  const log = useLog();
  const raf = useRef(0);
  const state = useRef({ db, cache, index });
  state.current = { db, cache, index };

  useEffect(() => {
    if (i >= steps.length) return;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / 750);
      setT(p);
      if (p < 1) raf.current = requestAnimationFrame(tick);
      else {
        const s = steps[i];
        s.effect?.();
        log.add(s.text, s.tone);
        setI(i + 1);
      }
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i, steps]);

  const busy = i < steps.length;
  const run = (s: Step[]) => { setSteps(s); setI(0); setT(0); };

  const read = () => {
    const { cache: c, db: d } = state.current;
    if (c !== null) {
      run([
        { from: 'client', to: 'app', text: 'GET /user/42' },
        { from: 'app', to: 'cache', text: `cache HIT → "${c}"${c !== d ? `  (database says "${d}" — STALE!)` : ''}`, tone: c !== d ? 'bad' : 'good' },
        { from: 'app', to: 'client', text: `respond "${c}"`, tone: c !== d ? 'bad' : undefined },
      ]);
    } else {
      run([
        { from: 'client', to: 'app', text: 'GET /user/42' },
        { from: 'app', to: 'cache', text: 'cache MISS', tone: 'warn' },
        { from: 'app', to: 'db', text: `read from database → "${d}"` },
        { from: 'app', to: 'cache', text: `populate cache with "${d}"`, effect: () => setCache(state.current.db) },
        { from: 'app', to: 'client', text: `respond "${d}"`, tone: 'good' },
      ]);
    }
  };

  const write = () => {
    const next = state.current.db === 'Alice' ? 'Alicia' : 'Alice';
    const s: Step[] = [
      { from: 'client', to: 'app', text: `PUT /user/42 name="${next}"` },
      { from: 'app', to: 'db', text: `write "${next}" to the primary database (the source of truth)`, effect: () => setDb(next) },
    ];
    if (invalidate) s.push({ from: 'app', to: 'cache', text: 'invalidate cached entry', effect: () => setCache(null) });
    else s.push({ from: 'app', to: 'app', text: 'application forgot to invalidate the cache…', tone: 'bad' });
    s.push(
      { from: 'db', to: 'search', text: 'capture change → update search index', effect: () => setIndex(next) },
      { from: 'app', to: 'queue', text: 'enqueue async task "send name-changed email"' },
      { from: 'queue', to: 'worker', text: 'worker sends the email (outside world)', tone: 'good' },
    );
    run(s);
  };

  const cur = steps[Math.min(i, steps.length - 1)];
  let dot: [number, number] | null = null;
  if (busy && cur) {
    const [x1, y1] = POS[cur.from];
    const [x2, y2] = POS[cur.to];
    dot = [x1 + (x2 - x1) * t, y1 + (y2 - y1) * t];
  }
  const active = (a: N, b: N) => busy && cur && ((cur.from === a && cur.to === b) || (cur.from === b && cur.to === a));

  return (
    <div>
      <Controls>
        <button className="btn sm" disabled={busy} onClick={read}>Read user 42</button>
        <button className="btn sm" disabled={busy} onClick={write}>Change user 42’s name</button>
        <label><input type="checkbox" checked={invalidate} onChange={(e) => setInvalidate(e.target.checked)} /> app invalidates cache on write</label>
        <button className="btn sm ghost" disabled={busy} onClick={() => { setDb('Alice'); setCache(null); setIndex('Alice'); log.clear(); }}>Reset</button>
      </Controls>
      <svg viewBox="0 0 720 350" role="img" aria-label="Data system with cache, database, search index and queue">
        {EDGES.map(([a, b]) => (
          <line key={a + b} x1={POS[a][0]} y1={POS[a][1]} x2={POS[b][0]} y2={POS[b][1]}
            stroke={active(a, b) ? 'var(--v-a)' : 'var(--v-muted)'} strokeWidth={active(a, b) ? 3 : 1.5} />
        ))}
        {(Object.keys(POS) as N[]).map((n) => {
          const [x, y, label] = POS[n];
          const val = n === 'cache' ? (cache ?? '(empty)') : n === 'db' ? db : n === 'search' ? index : '';
          const stale = n === 'cache' && cache !== null && cache !== db;
          return (
            <g key={n}>
              <rect x={x - 88} y={y - 22} width={176} height={val ? 46 : 38} rx={10}
                fill={stale ? 'color-mix(in srgb, var(--v-d) 15%, var(--surface))' : 'var(--surface)'}
                stroke={stale ? 'var(--v-d)' : n === 'db' ? 'var(--v-a)' : 'var(--ink-3)'} strokeWidth={n === 'db' ? 2 : 1.2} />
              <text x={x} y={y - 2} textAnchor="middle" fontSize={13.5} fontWeight={600}>{label}</text>
              {val && <text x={x} y={y + 16} textAnchor="middle" fontSize={12.5} style={{ fill: stale ? 'var(--v-d)' : 'var(--ink-3)' }}>user42 = {val}</text>}
            </g>
          );
        })}
        {dot && <circle cx={dot[0]} cy={dot[1]} r={8} fill="var(--v-a)" />}
      </svg>
      <Log lines={log.lines} />
      <div className="hint">Try: read twice (miss, then hit). Then untick “invalidates cache”, change the name, and read again.</div>
    </div>
  );
}
