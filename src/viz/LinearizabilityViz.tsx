import { useMemo, useState } from 'react';
import { Controls, Seg, Stat } from './ui';
import { checkLinearizable, describeOp, fig92, fig94, fig96, findCulprit, type Op } from './linearizability';

/**
 * Chapter 9, pp. 314-319: is this history linearizable? Bars are operations from the clients' point of view
 * (request sent → response received). Click a read's value to change what the database returned; the checker
 * searches for a sequential order that respects real time and register semantics, and draws the
 * linearization points joined in order (Figure 9-4 style).
 */

type Example = 'fig92' | 'fig94' | 'fig96';

const READ_CHOICES: Record<Example, number[]> = { fig92: [0, 1], fig94: [0, 1, 2, 3, 4], fig96: [0, 1] };

export default function LinearizabilityViz({ initial = 'fig92' }: { initial?: Example }) {
  const [ex, setEx] = useState<Example>(initial);
  const [overrides, setOverrides] = useState<Record<string, number>>({});
  const base = useMemo(() => (ex === 'fig92' ? fig92(1, 0, 0) : ex === 'fig94' ? fig94(2) : fig96()), [ex]);
  const history: Op[] = base.map((o) => (o.kind === 'read' && overrides[`${ex}:${o.id}`] !== undefined ? { ...o, value: overrides[`${ex}:${o.id}`] } : o));
  const res = checkLinearizable(history, 0);
  const culprit = res.linearizable ? null : findCulprit(history, 0);
  const clients = [...new Set(history.map((o) => o.client))];
  const W = 680, rowH = 46, x0 = 70, top = 16;
  const H = top + clients.length * rowH + 44;
  const X = (t: number) => x0 + (t / 100) * (W - x0 - 14);
  const Y = (c: string) => top + clients.indexOf(c) * rowH + 18;
  const cycle = (o: Op) => {
    const choices = READ_CHOICES[ex];
    const cur = o.value!;
    const next = choices[(choices.indexOf(cur) + 1) % choices.length];
    setOverrides({ ...overrides, [`${ex}:${o.id}`]: next });
  };
  const pts = res.order.map((id) => ({ id, t: res.points[id], c: history.find((o) => o.id === id)!.client }));
  return (
    <div>
      <Controls>
        <Seg value={ex} onChange={(v) => setEx(v)} options={[
          { value: 'fig92', label: 'Figures 9-2/9-3' },
          { value: 'fig94', label: 'Figure 9-4' },
          { value: 'fig96', label: 'Figure 9-6 (quorum)' },
        ]} />
        <button className="btn sm" onClick={() => setOverrides({})}>Reset values</button>
      </Controls>
      <svg className="dg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Operation history: bars per client, with linearization points">
        {clients.map((c) => (
          <g key={c}><text x={8} y={Y(c) + 5} fontWeight={700}>{c === 'Writer' ? 'Writer' : `Client ${c}`}</text><line x1={x0} x2={W - 8} y1={Y(c)} y2={Y(c)} stroke="var(--line)" /></g>
        ))}
        {history.map((o) => {
          const isCulprit = o.id === culprit;
          const cls = o.kind === 'read' ? 'boxa' : o.kind === 'write' ? 'boxb' : 'boxe';
          return (
            <g key={o.id} style={{ cursor: o.kind === 'read' ? 'pointer' : 'default' }} onClick={() => o.kind === 'read' && cycle(o)}>
              <rect x={X(o.start)} y={Y(o.client) - 13} width={X(o.end) - X(o.start)} height={26} rx={5} className={isCulprit ? 'boxd' : cls} />
              <text x={(X(o.start) + X(o.end)) / 2} y={Y(o.client) + 4} textAnchor="middle" style={{ fontSize: 11.5 }} fontWeight={o.kind === 'read' ? 700 : 400}>{describeOp(o)}</text>
            </g>
          );
        })}
        {res.linearizable && (
          <g>
            <path d={pts.map((p, i) => `${i ? 'L' : 'M'}${X(p.t).toFixed(1)} ${Y(p.c)}`).join(' ')} stroke="var(--v-d)" strokeWidth={1.4} fill="none" strokeDasharray="4 3" />
            {pts.map((p) => <circle key={p.id} cx={X(p.t)} cy={Y(p.c)} r={3.5} fill="var(--v-d)" />)}
          </g>
        )}
        <text x={x0} y={H - 10} className="sub">time → · click a read to change the value the database returned</text>
      </svg>
      <div>
        <Stat label="Linearizable?" value={res.linearizable ? 'yes' : 'no'} tone={res.linearizable ? 'good' : 'bad'} />
        {res.linearizable && <Stat label="One valid order" value={res.order.map((id) => describeOp(history.find((o) => o.id === id)!)).join(' → ')} />}
        {!res.linearizable && culprit && <Stat label="Removing this read would fix it" value={`${culprit}: ${describeOp(history.find((o) => o.id === culprit)!)}`} tone="bad" />}
      </div>
      <p className="small muted">
        {ex === 'fig92' && 'Reads concurrent with the write may return 0 or 1 — but once any read has returned 1, every read that starts later must return 1 too (Figure 9-3). Try A’s middle read = 1 with B’s second read = 0.'}
        {ex === 'fig94' && 'B’s final read (red when it’s the problem) started after A had already read 4, so it may not return an older value (p. 319). Click it and set it to 4.'}
        {ex === 'fig96' && 'n = 3, w = 3, r = 2: the quorum condition holds, but A (finished first) saw 1 and B (started later) saw 0 — not linearizable (p. 325).'}
      </p>
    </div>
  );
}
