import { useState } from 'react';
import { Controls, Seg, Slider } from './ui';

/**
 * Figures 5-3, 5-4 and 5-5 as timelines. A write at time w becomes visible on a replica with lag L at
 * time w + L. Reads at chosen times are routed to replicas; fixes change the routing.
 */
type Tab = 'ryw' | 'mono' | 'prefix';
const W = 700, LANE = 46, X0 = 120, SCALE = 0.11; // px per ms (0..5500 ms)
const x = (t: number) => X0 + t * SCALE;

function Lane({ y, label }: { y: number; label: string }) {
  return (
    <g>
      <text x={8} y={y + 4} fontSize={13} fontWeight={600}>{label}</text>
      <line x1={X0} x2={W - 10} y1={y} y2={y} stroke="var(--v-muted)" />
    </g>
  );
}
function Arrow({ x1, y1, x2, y2, color, dash }: { x1: number; y1: number; x2: number; y2: number; color: string; dash?: boolean }) {
  return <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={2} strokeDasharray={dash ? '5 4' : undefined} markerEnd="url(#lag-arrow)" />;
}
function Verdict({ ok, good, bad }: { ok: boolean; good: string; bad: string }) {
  return <div className={`feedback ${ok ? 'good' : 'bad'}`} style={{ marginTop: 8 }}><strong>{ok ? '✓ ' : '✗ '}{ok ? good : bad}</strong></div>;
}
const Defs = () => (
  <defs>
    <marker id="lag-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M0,0 L10,5 L0,10 z" fill="var(--ink-3)" />
    </marker>
  </defs>
);

export default function LagAnomalySim() {
  const [tab, setTab] = useState<Tab>('ryw');
  return (
    <div>
      <Controls>
        <Seg value={tab} onChange={setTab} options={[
          { value: 'ryw', label: 'Read your own writes' },
          { value: 'mono', label: 'Monotonic reads' },
          { value: 'prefix', label: 'Consistent prefix' },
        ]} />
      </Controls>
      {tab === 'ryw' && <RYW />}
      {tab === 'mono' && <Mono />}
      {tab === 'prefix' && <Prefix />}
    </div>
  );
}

function RYW() {
  const [lag, setLag] = useState(2000);
  const [readAt, setReadAt] = useState(800);
  const [fix, setFix] = useState<'none' | 'leader' | 'lsn'>('none');
  const writeAt = 300;
  const visibleAt = writeAt + lag;
  const target = fix === 'none' ? 'follower' : fix === 'leader' ? 'leader' : (readAt >= visibleAt ? 'follower' : 'leader');
  const ok = target === 'leader' || readAt >= visibleAt;
  const yU = 40, yL = 90, yF = 140;
  return (
    <div>
      <Controls>
        <Slider label="replication lag" value={lag} min={100} max={4500} step={100} onChange={setLag} fmt={(v) => `${v} ms`} />
        <Slider label="user re-reads after" value={readAt} min={350} max={5000} step={50} onChange={setReadAt} fmt={(v) => `${v} ms`} />
      </Controls>
      <Controls>
        <span className="small muted">Fix:</span>
        <Seg value={fix} onChange={setFix} options={[
          { value: 'none', label: 'none (read any follower)' },
          { value: 'leader', label: "read own profile from leader" },
          { value: 'lsn', label: 'remember my last write position' },
        ]} />
      </Controls>
      <svg viewBox={`0 0 ${W} 180`}>
        <Defs />
        <Lane y={yU} label="User 1234" /><Lane y={yL} label="Leader" /><Lane y={yF} label="Follower" />
        <Arrow x1={x(writeAt)} y1={yU} x2={x(writeAt + 60)} y2={yL} color="var(--v-a)" />
        <text x={x(writeAt) - 10} y={yU - 8} fontSize={11.5}>insert comment</text>
        <Arrow x1={x(writeAt + 60)} y1={yL} x2={x(visibleAt)} y2={yF} color="var(--v-muted)" dash />
        <text x={x(visibleAt) + 4} y={yF + 16} fontSize={11.5} style={{ fill: 'var(--ink-3)' }}>arrives (lag)</text>
        <Arrow x1={x(readAt)} y1={yU} x2={x(readAt + 60)} y2={target === 'leader' ? yL : yF} color={ok ? 'var(--v-b)' : 'var(--v-d)'} />
        <text x={x(readAt) + 6} y={yU - 20} fontSize={11.5} style={{ fill: ok ? 'var(--v-b)' : 'var(--v-d)' }}>read → {target}</text>
      </svg>
      <Verdict ok={ok} good="The user sees their own comment." bad="The comment seems to have vanished — the follower hasn't received it yet (Figure 5-3)." />
    </div>
  );
}

function Mono() {
  const [lags, setLags] = useState<[number, number]>([400, 3500]);
  const [sticky, setSticky] = useState(false);
  const [routes, setRoutes] = useState<[number, number]>([0, 1]);
  const writeAt = 200, r1 = 1200, r2 = 2000;
  const route = sticky ? [0, 0] : routes;
  const seen = (r: number, rep: number) => r >= writeAt + lags[rep];
  const s1 = seen(r1, route[0]), s2 = seen(r2, route[1]);
  const ok = !(s1 && !s2);
  const ys = [80, 130];
  return (
    <div>
      <Controls>
        <Slider label="lag of follower 1" value={lags[0]} min={100} max={4000} step={100} onChange={(v) => setLags([v, lags[1]])} fmt={(v) => `${v} ms`} />
        <Slider label="lag of follower 2" value={lags[1]} min={100} max={4000} step={100} onChange={(v) => setLags([lags[0], v])} fmt={(v) => `${v} ms`} />
      </Controls>
      <Controls>
        <button className="btn sm" disabled={sticky} onClick={() => setRoutes([Math.random() < 0.5 ? 0 : 1, Math.random() < 0.5 ? 0 : 1])}>Route both reads randomly</button>
        <label><input type="checkbox" checked={sticky} onChange={(e) => setSticky(e.target.checked)} /> fix: always route this user to the same replica (hash of user ID)</label>
      </Controls>
      <svg viewBox={`0 0 ${W} 170`}>
        <Defs />
        <Lane y={30} label="User 2345" /><Lane y={ys[0]} label="Follower 1" /><Lane y={ys[1]} label="Follower 2" />
        {[0, 1].map((rep) => (
          <g key={rep}>
            <circle cx={x(writeAt + lags[rep])} cy={ys[rep]} r={5} fill="var(--v-a)" />
            <text x={x(writeAt + lags[rep]) + 6} y={ys[rep] - 6} fontSize={11} style={{ fill: 'var(--v-a)' }}>comment arrives</text>
          </g>
        ))}
        {[r1, r2].map((r, i) => {
          const s = i === 0 ? s1 : s2;
          return (
            <g key={i}>
              <Arrow x1={x(r)} y1={30} x2={x(r + 50)} y2={ys[route[i]]} color={i === 1 && !ok ? 'var(--v-d)' : 'var(--v-b)'} />
              <text x={x(r) - 20} y={20} fontSize={11.5}>read {i + 1}: {s ? '1 comment' : 'no comments'}</text>
            </g>
          );
        })}
      </svg>
      <Verdict ok={ok} good="Time never moves backwards for this user." bad="The comment appeared, then disappeared on refresh — time went backwards (Figure 5-4)." />
    </div>
  );
}

function Prefix() {
  const [lags, setLags] = useState<[number, number]>([2500, 300]);
  const [samePartition, setSame] = useState(false);
  const qAt = 200, aAt = 900;
  const lq = lags[0], la = samePartition ? lags[0] : lags[1];
  const qSeen = qAt + lq, aSeen = aAt + la;
  const ok = qSeen <= aSeen;
  return (
    <div>
      <Controls>
        <Slider label="lag of partition 1 (Mr Poons)" value={lags[0]} min={100} max={4000} step={100} onChange={(v) => setLags([v, lags[1]])} fmt={(v) => `${v} ms`} />
        <Slider label="lag of partition 2 (Mrs Cake)" value={lags[1]} min={100} max={4000} step={100} onChange={(v) => setLags([lags[0], v])} fmt={(v) => `${v} ms`} />
      </Controls>
      <Controls>
        <label><input type="checkbox" checked={samePartition} onChange={(e) => setSame(e.target.checked)} /> fix: write causally related messages to the same partition</label>
      </Controls>
      <svg viewBox={`0 0 ${W} 150`}>
        <Defs />
        <Lane y={30} label="Writers" /><Lane y={110} label="Observer" />
        <text x={x(qAt)} y={22} fontSize={11.5}>Q: "How far into the future can you see?"</text>
        <text x={x(aAt)} y={48} fontSize={11.5}>A: "About ten seconds usually."</text>
        <Arrow x1={x(qAt)} y1={30} x2={x(qSeen)} y2={110} color="var(--v-a)" dash />
        <Arrow x1={x(aAt)} y1={36} x2={x(aSeen)} y2={110} color="var(--v-c)" dash />
        <text x={x(Math.min(qSeen, aSeen))} y={130} fontSize={11.5}>sees first: {qSeen <= aSeen ? 'question' : 'ANSWER'}</text>
      </svg>
      <Verdict ok={ok} good="The observer sees the question before the answer." bad="The observer hears the answer before the question was asked (Figure 5-5)." />
    </div>
  );
}
