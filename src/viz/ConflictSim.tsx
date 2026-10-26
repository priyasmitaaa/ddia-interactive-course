import { useState } from 'react';
import { Controls, Seg, Slider } from './ui';

/**
 * Figure 5-7: two leaders, concurrent title changes A→B (leader 1) and A→C (leader 2).
 * Each leader applies its local write, then receives the other's write later. Pick a conflict
 * resolution strategy and see whether replicas converge, and what is lost.
 */
type Strategy = 'arrival' | 'lww' | 'replica' | 'merge' | 'siblings';
interface W { value: string; origin: 1 | 2; realTime: number; ts: number }

export default function ConflictSim() {
  const [strategy, setStrategy] = useState<Strategy>('arrival');
  const [skew, setSkew] = useState(0);         // leader 2's clock offset (ms)
  const [gap, setGap] = useState(40);          // user 2 writes this many ms after user 1 (real time)
  const w1: W = { value: 'B', origin: 1, realTime: 1000, ts: 1000 };
  const w2: W = { value: 'C', origin: 2, realTime: 1000 + gap, ts: 1000 + gap + skew };

  // order of application at each leader: own write first, the other's write arrives later
  const orders: [W[], W[]] = [[w1, w2], [w2, w1]];
  const resolve = (seq: W[]): { value: string; note: string } => {
    switch (strategy) {
      case 'arrival': return { value: seq[seq.length - 1].value, note: 'applied in arrival order' };
      case 'lww': {
        const win = [...seq].sort((a, b) => b.ts - a.ts || b.origin - a.origin)[0];
        return { value: win.value, note: `highest timestamp wins (${win.ts})` };
      }
      case 'replica': return { value: [...seq].sort((a, b) => b.origin - a.origin)[0].value, note: 'higher replica ID wins' };
      case 'merge': return { value: [...seq].map((s) => s.value).sort().join('/'), note: 'values merged' };
      case 'siblings': return { value: `{${[...seq].map((s) => s.value).sort().join(', ')}}`, note: 'both kept; app/user resolves later' };
    }
  };
  const r1 = resolve(orders[0]), r2 = resolve(orders[1]);
  const converged = r1.value === r2.value;
  const lost = strategy === 'lww' || strategy === 'replica' ? (r1.value === 'B' ? 'C (user 2’s write)' : 'B (user 1’s write)') : strategy === 'arrival' ? '—' : 'nothing';
  const realLater = gap >= 0 ? 'C' : 'B';
  const lwwSurprise = strategy === 'lww' && r1.value !== realLater && gap !== 0;

  return (
    <div>
      <Controls>
        <span className="small muted">Resolution:</span>
        <Seg value={strategy} onChange={setStrategy} options={[
          { value: 'arrival', label: 'none' },
          { value: 'lww', label: 'last write wins' },
          { value: 'replica', label: 'replica ID' },
          { value: 'merge', label: 'merge' },
          { value: 'siblings', label: 'keep siblings' },
        ]} />
      </Controls>
      {strategy === 'lww' && (
        <Controls>
          <Slider label="user 2 writes … after user 1 (real time)" value={gap} min={-500} max={500} step={10} onChange={setGap} fmt={(v) => `${v} ms`} />
          <Slider label="leader 2's clock is off by" value={skew} min={-800} max={800} step={20} onChange={setSkew} fmt={(v) => `${v > 0 ? '+' : ''}${v} ms`} />
        </Controls>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {[0, 1].map((i) => {
          const seq = orders[i];
          const r = i === 0 ? r1 : r2;
          return (
            <div key={i} style={{ border: '1.5px solid var(--v-a)', borderRadius: 10, padding: 10, background: 'var(--v-fill)' }}>
              <div style={{ fontWeight: 700 }}>Leader {i + 1} (datacenter {i + 1})</div>
              <div className="small" style={{ fontFamily: 'var(--mono)', margin: '6px 0' }}>
                initially title = A<br />
                1. local: title = {seq[0].value} {strategy === 'lww' && <span className="muted">(ts {seq[0].ts})</span>}<br />
                2. replicated in: title = {seq[1].value} {strategy === 'lww' && <span className="muted">(ts {seq[1].ts})</span>}
              </div>
              <div>final: <b style={{ fontSize: 18 }}>{r.value}</b> <span className="small muted">— {r.note}</span></div>
            </div>
          );
        })}
      </div>
      <div className={`feedback ${converged ? 'good' : 'bad'}`} style={{ marginTop: 10 }}>
        <strong>{converged ? '✓ Replicas converge' : '✗ Replicas disagree forever'}</strong>
        <div className="small">Lost writes: {lost}.{lwwSurprise && ' Note: the write that really happened later LOST, because of clock skew.'}</div>
      </div>
      <div className="hint">“None” = each leader applies writes in the order it saw them: leader 1 ends with C, leader 2 with B. Every convergent strategy either loses data (LWW, replica ID) or pushes the problem to the application (merge, siblings).</div>
    </div>
  );
}
