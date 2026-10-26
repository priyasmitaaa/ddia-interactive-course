import { useRef, useState } from 'react';
import { CHAPTERS, exercises, lessonById, lessons, questionById } from '../lib/content';
import { isStruggling } from '../lib/srs';
import { exportProgress, importProgress, resetProgress, useStore } from '../lib/store';
import { currentLesson } from './Home';

export function ProgressPage() {
  const st = useStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState('');
  const done = lessons.filter((l) => st.completed[l.id]).length;
  const cur = currentLesson(st.completed);
  const chapterNums = Object.keys(CHAPTERS).map(Number);
  const chapterStats = chapterNums.map((c) => {
    const ls = lessons.filter((l) => l.chapter === c);
    return { c, total: ls.length, done: ls.filter((l) => st.completed[l.id]).length };
  });
  const chaptersDone = chapterStats.filter((s) => s.total > 0 && s.done === s.total).length;
  const struggling = Object.entries(st.cards).filter(([id, c]) => isStruggling(c) && questionById.has(id));
  const byLesson = new Map<string, number>();
  for (const [id] of struggling) byLesson.set(id.split(':')[0], (byLesson.get(id.split(':')[0]) ?? 0) + 1);
  const answered = Object.values(st.answers);
  const accuracy = answered.length ? Math.round((answered.filter((a) => a.correct).length / answered.length) * 100) : null;

  const download = () => {
    const blob = new Blob([exportProgress()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `ddia-progress-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="narrow">
      <div className="eyebrow">Progress</div>
      <h1>Where you are</h1>
      <div className="stats">
        <div className="card stat-card"><div className="muted small">Lessons completed</div><div className="n">{done}<span className="muted small"> / {lessons.length}</span></div></div>
        <div className="card stat-card"><div className="muted small">Chapters completed</div><div className="n">{chaptersDone}<span className="muted small"> / 11</span></div></div>
        <div className="card stat-card"><div className="muted small">Exercises done</div><div className="n">{Object.keys(st.exercisesDone).length}<span className="muted small"> / {exercises.length}</span></div></div>
        <div className="card stat-card"><div className="muted small">First-try quiz accuracy</div><div className="n">{accuracy === null ? '—' : `${accuracy}%`}</div></div>
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <h3 style={{ marginTop: 0 }}>Current position</h3>
        {cur ? (
          <p style={{ margin: 0 }}>Week {cur.week}, Day {cur.day}: <a href={`#/lesson/${cur.id}`}>{cur.title}</a></p>
        ) : <p style={{ margin: 0 }}>All lessons complete.</p>}
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <h3 style={{ marginTop: 0 }}>Chapters</h3>
        <div className="chapter-bars">
          {chapterStats.map(({ c, total, done: d }) => (
            <div className="chapter-bar" key={c}>
              <strong>{c}</strong>
              <span className="name">{CHAPTERS[c]}</span>
              <div className="row" style={{ flexWrap: 'nowrap' }}>
                <div className="progressbar" style={{ flex: 1 }}><div style={{ width: total ? `${(d / total) * 100}%` : 0 }} /></div>
                <span className="small muted" style={{ width: 44, textAlign: 'right' }}>{d}/{total}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <h3 style={{ marginTop: 0 }}>Topics needing revision</h3>
        {byLesson.size === 0 ? <p className="muted small" style={{ margin: 0 }}>Nothing flagged. Questions you miss show up here until you get them right.</p> : (
          <ul style={{ margin: 0, paddingLeft: '1.1em' }}>
            {[...byLesson.entries()].sort((a, b) => b[1] - a[1]).map(([lid, n]) => {
              const l = lessonById.get(lid);
              return l ? <li key={lid}><a href={`#/lesson/${lid}`}>W{l.week} D{l.day}: {l.title}</a> <span className="muted small">({n} question{n > 1 ? 's' : ''})</span></li> : null;
            })}
          </ul>
        )}
        {byLesson.size > 0 && <a className="btn" href="#/review" style={{ marginTop: 12 }}>Practise them in Review</a>}
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <h3 style={{ marginTop: 0 }}>Backup</h3>
        <p className="small muted" style={{ marginTop: 0 }}>
          Progress is saved automatically in this browser. Download a backup now and then (or to move to another computer/browser).
        </p>
        <div className="row">
          <button className="btn" onClick={download}>Download backup</button>
          <button className="btn" onClick={() => fileRef.current?.click()}>Restore from backup…</button>
          <input ref={fileRef} type="file" accept="application/json" style={{ display: 'none' }} onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            try { importProgress(await f.text()); setMsg('Progress restored.'); } catch (err) { setMsg(String((err as Error).message)); }
            e.target.value = '';
          }} />
          <button className="btn ghost" onClick={() => { if (confirm('Erase all progress? This cannot be undone (unless you have a backup).')) resetProgress(); }}>Reset…</button>
        </div>
        {msg && <p className="small">{msg}</p>}
      </div>
    </div>
  );
}
