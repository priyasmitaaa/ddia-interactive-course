import { CHAPTERS, lessons, weeks } from '../lib/content';
import { useStore } from '../lib/store';
import type { Lesson } from '../lib/types';
import { minutesFor, useDueCount } from './Review';
import { SESSION_SIZE } from '../lib/srs';

export function currentLesson(completed: Record<string, number>): Lesson | undefined {
  return lessons.find((l) => !completed[l.id]);
}

export const KIND_LABEL: Record<string, string> = {
  lesson: '', lab: 'Lab', review: 'Review', assessment: 'Checkpoint', project: 'Project', supplement: 'Beyond the PDF',
};

export function Check({ on, here }: { on: boolean; here?: boolean }) {
  return (
    <span className={`check ${on ? 'on' : ''} ${here ? 'here' : ''}`}>
      {on && <svg width="11" height="11" viewBox="0 0 12 12"><path d="M2 6.5l2.5 2.5L10 3.5" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" /></svg>}
    </span>
  );
}

export function Home() {
  const st = useStore();
  const due = useDueCount();
  const cur = currentLesson(st.completed);
  const idx = cur ? lessons.indexOf(cur) : lessons.length;
  const next = cur ? lessons[idx + 1] : undefined;
  const doneCount = lessons.filter((l) => st.completed[l.id]).length;
  const pct = Math.round((doneCount / lessons.length) * 100);
  let lastPart = '';

  return (
    <div>
      {cur ? (
        <div className="card today">
          <div>
            <div className="eyebrow">Today’s lesson · Week {cur.week}, Day {cur.day}</div>
            <h1>{cur.title}</h1>
            <div className="meta">
              <span>⏱ about {cur.minutes} min</span>
              {cur.chapter && <span>Chapter {cur.chapter}: {CHAPTERS[cur.chapter]}</span>}
              {KIND_LABEL[cur.kind] && <span className={`kind-tag ${cur.kind}`}>{KIND_LABEL[cur.kind]}</span>}
            </div>
            {cur.objectives.length > 0 && (
              <>
                <div className="eyebrow" style={{ marginTop: 18 }}>What you will learn</div>
                <ul>{cur.objectives.slice(0, 4).map((o, i) => <li key={i}>{o}</li>)}</ul>
              </>
            )}
            <a className="btn primary big" href={`#/lesson/${cur.id}`} data-testid="continue">Continue Learning →</a>
          </div>
          <div className="today-side">
            {due > 0 ? (
              <a className="revision-pill" href="#/review" style={{ textDecoration: 'none' }}>
                <span><strong>Revision:</strong> {minutesFor(Math.min(due, SESSION_SIZE))} min — {Math.min(due, SESSION_SIZE)} questions</span>
                <span>→</span>
              </a>
            ) : (
              <div className="small muted">No revision due today.</div>
            )}
            <div>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <span className="small muted">Course progress</span>
                <span className="small"><strong>{doneCount}</strong> / {lessons.length} days · {pct}%</span>
              </div>
              <div className="progressbar" style={{ marginTop: 6 }}><div style={{ width: `${pct}%` }} /></div>
            </div>
            {next && (
              <div>
                <div className="eyebrow">Up next</div>
                <a href={`#/lesson/${next.id}`} style={{ color: 'var(--ink)', textDecoration: 'none' }}>
                  W{next.week} D{next.day} · {next.title}
                </a>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="card today">
          <div>
            <div className="eyebrow">Course complete</div>
            <h1>You finished all {lessons.length} days.</h1>
            <p className="muted">Keep doing your revision sessions — that is how this knowledge stays with you.</p>
            <a className="btn primary big" href="#/review">Go to Review</a>
          </div>
        </div>
      )}

      <h2 style={{ marginTop: 40 }}>The whole course</h2>
      <p className="muted" style={{ marginTop: -6 }}>24 weeks · 6 days a week · 1–2 hours a day. Day 6 is always a lighter review day. Skip around freely; “Continue” always takes you to the first unfinished day.</p>
      {weeks.map((w) => {
        const showPart = w.part && w.part !== lastPart;
        lastPart = w.part;
        const done = w.lessons.filter((l) => st.completed[l.id]).length;
        const isCur = !!cur && cur.week === w.week;
        return (
          <div key={w.week}>
            {showPart && <div className="part-title">{w.part}</div>}
            <details className={`week ${isCur ? 'current' : ''}`} open={isCur}>
              <summary>
                <span className="week-num">WEEK {w.week}</span>
                <span className="week-title">{w.title}</span>
                <span className="week-count">{done}/{w.lessons.length}</span>
                <Check on={done === w.lessons.length} />
              </summary>
              <div className="week-body">
                {w.summary && <div className="week-summary">{w.summary}</div>}
                {w.lessons.map((l) => (
                  <a key={l.id} className="lesson-row" href={`#/lesson/${l.id}`}>
                    <Check on={!!st.completed[l.id]} here={cur?.id === l.id} />
                    <span className="day">Day {l.day}</span>
                    <span className="t">{l.title}</span>
                    {KIND_LABEL[l.kind] && <span className={`kind-tag ${l.kind}`}>{KIND_LABEL[l.kind]}</span>}
                    <span className="min">{l.minutes} min</span>
                  </a>
                ))}
              </div>
            </details>
          </div>
        );
      })}
    </div>
  );
}
