import { CHAPTERS, exerciseById, exercises, lessons } from '../lib/content';
import { toggleExercise, useStore } from '../lib/store';
import type { Exercise } from '../lib/types';
import { Check } from './Home';
import { Markdown } from './Markdown';

const usedIn = (id: string) => lessons.filter((l) => l.sections.some((s) => s.type === 'practice' && s.ref === id));

export function ExerciseBody({ ex, inline = false }: { ex: Exercise; inline?: boolean }) {
  const st = useStore();
  const done = !!st.exercisesDone[ex.id];
  const content = (
    <>
      <div className="row small muted" style={{ marginBottom: 6 }}>
        <span>⏱ ~{ex.minutes} min</span>
        <span>Folder: <span className="file-path">ddia-course/{ex.folder}</span></span>
      </div>
      <Markdown src={ex.body} />
      <div className="row" style={{ marginTop: 14 }}>
        <button className={`btn ${done ? '' : 'good'}`} onClick={() => toggleExercise(ex.id)}>
          {done ? '✓ Done — mark as not done' : 'Mark exercise as done'}
        </button>
      </div>
    </>
  );
  if (!inline) return content;
  return (
    <details className="card" style={{ padding: '16px 20px' }} open={!done}>
      <summary style={{ cursor: 'pointer', listStyle: 'none', display: 'flex', alignItems: 'center', gap: 10 }}>
        <Check on={done} />
        <strong style={{ flex: 1 }}>Exercise: {ex.title}</strong>
        <span className="small muted">{done ? 'done · click to expand' : 'click to collapse'}</span>
      </summary>
      <div style={{ marginTop: 10 }}>{content}</div>
    </details>
  );
}

export function PracticePage({ id }: { id?: string }) {
  const st = useStore();
  if (id) {
    const ex = exerciseById.get(id);
    if (!ex) return <div className="empty">Exercise not found. <a href="#/practice">All exercises</a></div>;
    const where = usedIn(ex.id);
    return (
      <div className="narrow">
        <a className="btn ghost sm" href="#/practice">← All exercises</a>
        <div className="eyebrow" style={{ marginTop: 12 }}>{ex.chapter ? `Chapter ${ex.chapter} · ${CHAPTERS[ex.chapter] ?? ''}` : ex.topic}</div>
        <h1>{ex.title}</h1>
        {where.length > 0 && (
          <p className="small muted">Part of: {where.map((l, i) => <span key={l.id}>{i ? ', ' : ''}<a href={`#/lesson/${l.id}`}>W{l.week} D{l.day} {l.title}</a></span>)}</p>
        )}
        <ExerciseBody ex={ex} />
      </div>
    );
  }
  const groups = new Map<string, Exercise[]>();
  for (const e of exercises) {
    const key = e.chapter ? `Chapter ${e.chapter} · ${CHAPTERS[e.chapter] ?? ''}` : e.topic || 'Projects';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(e);
  }
  const done = exercises.filter((e) => st.exercisesDone[e.id]).length;
  return (
    <div>
      <div className="eyebrow">Practice</div>
      <h1>Hands-on exercises</h1>
      <p className="muted" style={{ marginTop: -4 }}>
        {exercises.length} exercises and projects ({done} done). Each one also appears inside the lesson where it belongs.
        Code lives in <span className="file-path">ddia-course/practice/</span>; everything runs with plain Python 3 on your laptop.
      </p>
      {[...groups.entries()].map(([g, list]) => (
        <div key={g}>
          <h3>{g}</h3>
          <div className="grid2">
            {list.map((e) => (
              <a key={e.id} className="card ex-card" href={`#/practice/${e.id}`}>
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <span className="small muted">~{e.minutes} min</span>
                  <Check on={!!st.exercisesDone[e.id]} />
                </div>
                <h3>{e.title}</h3>
                <div className="small muted">{e.topic}</div>
              </a>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
