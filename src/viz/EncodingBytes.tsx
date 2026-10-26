import { useMemo, useState } from 'react';
import { BOOK_EXAMPLE, FORMATS, type Person, type Role } from './encoders';
import { Controls, Stat } from './ui';

const COLOR: Record<Role, string> = {
  type: 'var(--v-e)', tag: 'var(--v-c)', length: 'var(--v-a)', name: 'var(--v-d)', data: 'var(--v-b)', end: 'var(--ink-3)',
};
const LABEL: Record<Role, string> = {
  type: 'type / structure', tag: 'field tag (+type)', length: 'length', name: 'field NAME', data: 'value', end: 'end marker',
};

export default function EncodingBytes({ initial = 'proto' }: { initial?: string }) {
  const [fmt, setFmt] = useState<string>(initial);
  const [name, setName] = useState(BOOK_EXAMPLE.userName);
  const [num, setNum] = useState(String(BOOK_EXAMPLE.favoriteNumber));
  const [ints, setInts] = useState(BOOK_EXAMPLE.interests.join(', '));
  const [hover, setHover] = useState<number | null>(null);

  const person: Person = useMemo(() => ({
    userName: name,
    favoriteNumber: num.trim() === '' ? null : Math.trunc(Number(num)) || 0,
    interests: ints.split(',').map((s) => s.trim()).filter(Boolean),
  }), [name, num, ints]);

  const all = FORMATS.map((f) => ({ ...f, segs: f.fn(person) }));
  const cur = all.find((f) => f.id === fmt)!;
  const max = Math.max(...all.map((f) => f.segs.reduce((a, s) => a + s.bytes.length, 0)));
  const isText = fmt === 'json';

  return (
    <div>
      <Controls>
        <label>userName <input type="text" value={name} onChange={(e) => setName(e.target.value)} /></label>
        <label>favoriteNumber <input type="text" style={{ width: 80 }} value={num} placeholder="(unset)" onChange={(e) => setNum(e.target.value)} /></label>
        <label>interests <input type="text" style={{ width: 200 }} value={ints} onChange={(e) => setInts(e.target.value)} /></label>
        <button className="btn sm ghost" onClick={() => { setName('Martin'); setNum('1337'); setInts('daydreaming, hacking'); }}>Book example</button>
      </Controls>
      <div style={{ display: 'grid', gap: 4, marginBottom: 12 }}>
        {all.map((f) => {
          const n = f.segs.reduce((a, s) => a + s.bytes.length, 0);
          return (
            <button key={f.id} onClick={() => setFmt(f.id)} className="opt" style={{ margin: 0, padding: '6px 10px', borderColor: f.id === fmt ? 'var(--primary)' : undefined }}>
              <div className="row" style={{ flexWrap: 'nowrap' }}>
                <span style={{ width: 190, fontSize: 14, fontWeight: 600 }}>{f.name}</span>
                <div style={{ flex: 1, height: 12, background: 'var(--surface-2)', borderRadius: 6, overflow: 'hidden' }}>
                  <div style={{ width: `${(n / max) * 100}%`, height: '100%', background: f.id === fmt ? 'var(--primary)' : 'var(--v-muted)', transition: 'width .3s' }} />
                </div>
                <span style={{ width: 70, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: 14 }}>{n} bytes</span>
              </div>
            </button>
          );
        })}
      </div>
      <div className="eyebrow">{cur.name} {cur.fig !== '—' && `· matches ${cur.fig} for the book example`}</div>
      <div style={{ fontFamily: 'var(--mono)', fontSize: 13.5, lineHeight: 2, background: 'var(--code-bg)', padding: 10, borderRadius: 10, wordBreak: 'break-all' }}>
        {isText ? <span style={{ color: 'var(--v-b)' }}>{new TextDecoder().decode(new Uint8Array(cur.segs[0].bytes))}</span> :
          cur.segs.map((s, i) => (
            <span key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
              style={{ color: COLOR[s.role], fontWeight: s.role === 'data' ? 400 : 700, background: hover === i ? 'color-mix(in srgb, var(--v-a) 18%, transparent)' : undefined, borderRadius: 4, padding: '1px 2px', marginRight: 4, cursor: 'help' }}
              title={s.note}>
              {s.bytes.map((b) => b.toString(16).padStart(2, '0')).join(' ')}
            </span>
          ))}
      </div>
      <div className="small" style={{ minHeight: 22, marginTop: 4 }}>{hover !== null && !isText ? <b>{cur.segs[hover].note}</b> : <span className="muted">Hover over a group of bytes to see what it means.</span>}</div>
      {!isText && (
        <div className="row small" style={{ gap: 12 }}>
          {(Object.keys(LABEL) as Role[]).filter((r) => cur.segs.some((s) => s.role === r)).map((r) => (
            <span key={r}><span style={{ color: COLOR[r], fontWeight: 800 }}>■</span> {LABEL[r]}</span>
          ))}
        </div>
      )}
      <div style={{ marginTop: 6 }}>
        <Stat label="Field names in the bytes?" value={fmt === 'json' || fmt === 'msgpack' ? 'yes' : 'no'} tone={fmt === 'json' || fmt === 'msgpack' ? 'warn' : 'good'} />
        <Stat label="Field types in the bytes?" value={fmt === 'avro' ? 'no — the schema says' : fmt === 'json' ? 'partly' : 'yes'} />
      </div>
    </div>
  );
}
