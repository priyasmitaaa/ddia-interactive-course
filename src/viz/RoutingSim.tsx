import { useState } from 'react';
import { Controls, Log, Seg, useLog } from './ui';

/**
 * Figure 6-7 / 6-8: three ways to route a request for key "foo" to the node that owns its partition,
 * and what happens when a partition moves and the router's view of the assignment is stale.
 */
type Mode = 'any' | 'tier' | 'client';
const NODES = 3;

export default function RoutingSim() {
  const [mode, setMode] = useState<Mode>('tier');
  const [owner, setOwner] = useState(2);                // true owner of foo's partition
  const [routerView, setRouterView] = useState(2);      // what the router/client/nodes believe
  const [notify, setNotify] = useState(true);           // coordination service pushes changes
  const [path, setPath] = useState<number[]>([]);
  const [ok, setOk] = useState<boolean | null>(null);
  const log = useLog();

  const send = () => {
    let p: number[] = [];
    let success = false;
    if (mode === 'any') {
      const first = Math.floor(Math.random() * NODES);
      p = [first];
      if (first === owner) success = true;
      else { p.push(routerView); success = routerView === owner; }
      log.add(`client → random node ${first}${first === owner ? ' (owns it)' : ` → forwards to node ${routerView}`}${success ? ' ✓' : ' ✗ node no longer owns that partition'}`, success ? 'good' : 'bad');
    } else if (mode === 'tier') {
      p = [-1, routerView];
      success = routerView === owner;
      log.add(`client → routing tier → node ${routerView}${success ? ' ✓' : ' ✗ stale routing table'}`, success ? 'good' : 'bad');
    } else {
      p = [routerView];
      success = routerView === owner;
      log.add(`partition-aware client → node ${routerView} directly${success ? ' ✓ (fewest hops)' : ' ✗ client’s partition map is stale'}`, success ? 'good' : 'bad');
    }
    setPath(p);
    setOk(success);
  };

  const move = () => {
    const next = (owner + 1) % NODES;
    setOwner(next);
    if (notify) { setRouterView(next); log.add(`rebalancing moved foo's partition to node ${next}; ZooKeeper notified the routers`, 'muted'); }
    else log.add(`rebalancing moved foo's partition to node ${next}; nobody told the routers…`, 'warn');
  };

  const nodeX = (n: number) => 120 + n * 200;
  return (
    <div>
      <Controls>
        <Seg value={mode} onChange={(m) => { setMode(m); setPath([]); setOk(null); }} options={[
          { value: 'any', label: '1 · any node forwards' },
          { value: 'tier', label: '2 · routing tier' },
          { value: 'client', label: '3 · partition-aware client' },
        ]} />
      </Controls>
      <Controls>
        <button className="btn sm primary" onClick={send}>get "foo"</button>
        <button className="btn sm" onClick={move}>Rebalance: move foo's partition</button>
        <label><input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} /> coordination service (ZooKeeper) notifies routers</label>
        {!notify && routerView !== owner && <button className="btn sm" onClick={() => { setRouterView(owner); log.add('routing info refreshed', 'muted'); }}>Refresh routing info</button>}
      </Controls>
      <svg viewBox="0 0 720 210">
        <rect x={320} y={10} width={80} height={30} rx={8} fill="var(--surface)" stroke="var(--ink-3)" />
        <text x={360} y={30} textAnchor="middle" fontSize={13} fontWeight={600}>client</text>
        {mode === 'tier' && (
          <g>
            <rect x={300} y={70} width={120} height={30} rx={8} fill="color-mix(in srgb, var(--v-e) 15%, var(--surface))" stroke="var(--v-e)" />
            <text x={360} y={90} textAnchor="middle" fontSize={12.5}>routing tier</text>
          </g>
        )}
        {Array.from({ length: NODES }, (_, n) => (
          <g key={n}>
            <rect x={nodeX(n) - 60} y={150} width={120} height={44} rx={8} fill={n === owner ? 'color-mix(in srgb, var(--v-b) 18%, var(--surface))' : 'var(--surface)'} stroke={n === owner ? 'var(--v-b)' : 'var(--ink-3)'} strokeWidth={n === owner ? 2 : 1} />
            <text x={nodeX(n)} y={168} textAnchor="middle" fontSize={13} fontWeight={600}>node {n}</text>
            <text x={nodeX(n)} y={185} textAnchor="middle" fontSize={11} style={{ fill: 'var(--ink-3)' }}>{n === owner ? '"foo" lives here' : ''}</text>
          </g>
        ))}
        {path.length > 0 && (() => {
          const pts: [number, number][] = [[360, 40]];
          for (const p of path) pts.push(p === -1 ? [360, 70] : [nodeX(p), 150]);
          return pts.slice(1).map((pt, i) => (
            <line key={i} x1={pts[i][0]} y1={pts[i][1] + (i === 0 ? 0 : i === 1 && path[0] === -1 ? 30 : 0)} x2={pt[0]} y2={pt[1]}
              stroke={ok ? 'var(--v-b)' : 'var(--v-d)'} strokeWidth={2.5} />
          ));
        })()}
        <text x={10} y={130} fontSize={11.5} style={{ fill: routerView === owner ? 'var(--ink-3)' : 'var(--v-d)' }}>
          {mode === 'tier' ? 'routing tier believes' : mode === 'client' ? 'client believes' : 'nodes believe'}: foo → node {routerView}
        </text>
      </svg>
      <Log lines={log.lines} />
      <div className="hint">All three approaches have the same core problem: whoever makes the routing decision must learn about changes in the partition-to-node assignment, and all participants must agree (pp. 205–206). Untick the notification and rebalance to see why.</div>
    </div>
  );
}
