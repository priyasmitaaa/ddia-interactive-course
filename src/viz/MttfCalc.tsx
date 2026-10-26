import { useMemo, useState } from 'react';
import { Controls, Seg, Slider, Stat, rng } from './ui';

/**
 * Disk failures in a cluster. With N disks each failing independently with a mean time
 * to failure of M years, the expected number of failures per day is N / (M * 365).
 * We also simulate a year of failures and show mirrored pairs losing data only when
 * the second disk dies during the first one's rebuild window.
 */
export default function MttfCalc() {
  const [disks, setDisks] = useState(10000);
  const [mttf, setMttf] = useState(27);
  const [mode, setMode] = useState<'single' | 'mirror'>('single');
  const [rebuildHrs, setRebuildHrs] = useState(24);
  const [seed, setSeed] = useState(1);

  const perDay = disks / (mttf * 365);
  const pAnyToday = 1 - Math.exp(-perDay);

  const sim = useMemo(() => {
    const r = rng(seed * 7919);
    const days = 365;
    const fails = new Array(days).fill(0);
    const lambda = 1 / (mttf * 365);
    // Poisson count per day via sum over disks is too slow for 100k; use Poisson sampling.
    for (let d = 0; d < days; d++) {
      const L = Math.exp(-perDay);
      let k = 0, p = 1;
      if (perDay < 30) { do { k++; p *= r(); } while (p > L); k -= 1; }
      else { k = Math.max(0, Math.round(perDay + Math.sqrt(perDay) * (r() + r() + r() - 1.5) * 2)); }
      fails[d] = k;
    }
    // Mirrored: data lost if partner disk fails within rebuild window. P(partner fails in window) ≈ lambda * window_days
    const pPartner = 1 - Math.exp(-lambda * (rebuildHrs / 24));
    let losses = 0;
    for (const f of fails) for (let i = 0; i < f; i++) if (r() < pPartner) losses++;
    return { fails, losses, total: fails.reduce((a, b) => a + b, 0), pPartner };
  }, [perDay, mttf, rebuildHrs, seed]);

  const max = Math.max(...sim.fails, 1);
  const W = 720, H = 150;
  return (
    <div>
      <Controls>
        <Slider label="Disks" value={disks} min={100} max={100000} step={100} onChange={setDisks} fmt={(v) => v.toLocaleString()} />
        <Slider label="MTTF (years)" value={mttf} min={5} max={60} onChange={setMttf} />
      </Controls>
      <Controls>
        <Seg value={mode} onChange={setMode} options={[{ value: 'single', label: 'No redundancy' }, { value: 'mirror', label: 'Mirrored pairs (RAID 1)' }]} />
        {mode === 'mirror' && <Slider label="Rebuild time (h)" value={rebuildHrs} min={1} max={168} onChange={setRebuildHrs} />}
        <button className="btn sm" onClick={() => setSeed(seed + 1)}>Simulate another year</button>
      </Controls>
      <div>
        <Stat label="Expected disk deaths / day" value={perDay.toFixed(2)} tone={perDay >= 1 ? 'bad' : undefined} />
        <Stat label="P(at least one today)" value={`${(pAnyToday * 100).toFixed(1)}%`} />
        <Stat label="Deaths this simulated year" value={sim.total} />
        {mode === 'single'
          ? <Stat label="Disks whose data is lost" value={sim.total} tone="bad" />
          : <Stat label="Pairs that lost data" value={sim.losses} tone={sim.losses ? 'bad' : 'good'} />}
      </div>
      <svg viewBox={`0 0 ${W} ${H + 24}`} aria-label="Disk failures per day over one simulated year">
        {sim.fails.map((f, d) => (
          <rect key={d} x={(d / 365) * W} y={H - (f / max) * H} width={W / 365 + 0.3} height={(f / max) * H}
            fill={f === 0 ? 'var(--v-muted)' : 'var(--v-d)'} />
        ))}
        <line x1={0} x2={W} y1={H - (perDay / max) * H} y2={H - (perDay / max) * H} stroke="var(--v-a)" strokeDasharray="5 4" />
        <text x={4} y={H + 18} fontSize={12} style={{ fill: 'var(--ink-3)' }}>Jan</text>
        <text x={W - 4} y={H + 18} fontSize={12} textAnchor="end" style={{ fill: 'var(--ink-3)' }}>Dec</text>
        <text x={W - 4} y={Math.max(12, H - (perDay / max) * H - 5)} fontSize={12} textAnchor="end" style={{ fill: 'var(--v-a)' }}>expected per day</text>
      </svg>
      <div className="hint">
        {mode === 'single'
          ? 'Each red bar is a day with at least one disk death. With 10,000 disks and an MTTF around 27 years, that is roughly one per day — routine, not exceptional.'
          : `A mirrored pair loses data only if the partner also dies during the ${rebuildHrs} h rebuild (chance ≈ ${(sim.pPartner * 100).toFixed(4)}% per failure). Redundancy turns frequent faults into rare failures.`}
      </div>
    </div>
  );
}
