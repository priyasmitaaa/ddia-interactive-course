import { useEffect, useRef, useState, type ReactNode } from 'react';

export function Slider({ label, value, min, max, step = 1, onChange, fmt }: {
  label: string; value: number; min: number; max: number; step?: number;
  onChange: (v: number) => void; fmt?: (v: number) => string;
}) {
  return (
    <label>
      {label}
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
      <b style={{ minWidth: 44, fontVariantNumeric: 'tabular-nums' }}>{fmt ? fmt(value) : value}</b>
    </label>
  );
}

export function Seg<T extends string>({ options, value, onChange }: {
  options: { value: T; label: string }[]; value: T; onChange: (v: T) => void;
}) {
  return (
    <span style={{ display: 'inline-flex', border: '1px solid var(--line)', borderRadius: 9, overflow: 'hidden' }}>
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          style={{
            border: 0, padding: '6px 11px', cursor: 'pointer', fontSize: 14, fontWeight: 600,
            background: o.value === value ? 'var(--ink)' : 'var(--surface)',
            color: o.value === value ? 'var(--bg)' : 'var(--ink-2)',
          }}
        >{o.label}</button>
      ))}
    </span>
  );
}

export function Stat({ label, value, tone }: { label: string; value: ReactNode; tone?: 'good' | 'bad' | 'warn' }) {
  const color = tone === 'good' ? 'var(--good)' : tone === 'bad' ? 'var(--bad)' : tone === 'warn' ? 'var(--warn)' : undefined;
  return <span className="stat">{label}: <b style={{ color }}>{value}</b></span>;
}

export function Controls({ children }: { children: ReactNode }) {
  return <div className="viz-controls">{children}</div>;
}

export function Log({ lines }: { lines: { text: string; tone?: 'good' | 'bad' | 'warn' | 'muted' }[] }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (ref.current) ref.current.scrollTop = ref.current.scrollHeight; }, [lines.length]);
  if (lines.length === 0) return null;
  return (
    <div className="log" ref={ref}>
      {lines.map((l, i) => (
        <div key={i} style={{ color: l.tone === 'good' ? 'var(--good)' : l.tone === 'bad' ? 'var(--bad)' : l.tone === 'warn' ? 'var(--warn)' : l.tone === 'muted' ? 'var(--ink-3)' : undefined }}>{l.text}</div>
      ))}
    </div>
  );
}

/** Deterministic PRNG so "random" demos are reproducible with a seed. */
export function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

export function useInterval(fn: () => void, ms: number | null) {
  const saved = useRef(fn);
  saved.current = fn;
  useEffect(() => {
    if (ms === null) return;
    const id = setInterval(() => saved.current(), ms);
    return () => clearInterval(id);
  }, [ms]);
}

export function useLog(max = 200) {
  const [lines, setLines] = useState<{ text: string; tone?: 'good' | 'bad' | 'warn' | 'muted' }[]>([]);
  const add = (text: string, tone?: 'good' | 'bad' | 'warn' | 'muted') => setLines((l) => [...l.slice(-max + 1), { text, tone }]);
  const clear = () => setLines([]);
  return { lines, add, clear };
}

export const fmtNum = (n: number) =>
  n >= 1e9 ? `${(n / 1e9).toFixed(1)}B` : n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e4 ? `${(n / 1e3).toFixed(0)}k` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}k` : `${Math.round(n)}`;
