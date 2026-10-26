import { useMemo, useState } from 'react';
import { questionById, lessonById } from '../lib/content';
import { dueQueue, isStruggling, SESSION_SIZE } from '../lib/srs';
import { getState, recordReview, useStore } from '../lib/store';
import { QuestionCard } from './Quiz';

export function minutesFor(n: number) {
  return Math.max(1, Math.round(n * 1.3));
}

export function useDueCount() {
  const st = useStore();
  return useMemo(() => dueQueue(st.cards, Date.now()).filter((id) => questionById.has(id)).length, [st.cards]);
}

type SessionKind = 'due' | 'struggling' | 'mixed';

function buildQueue(kind: SessionKind): string[] {
  const st = getState();
  const now = Date.now();
  if (kind === 'due') return dueQueue(st.cards, now).filter((id) => questionById.has(id)).slice(0, SESSION_SIZE);
  if (kind === 'struggling') {
    return Object.entries(st.cards).filter(([id, c]) => isStruggling(c) && questionById.has(id)).map(([id]) => id).slice(0, SESSION_SIZE);
  }
  // mixed: interleaved sample across everything answered so far
  const pool = Object.keys(st.answers).filter((id) => questionById.has(id));
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, 8);
}

export function ReviewSession({ kind = 'due', onDone }: { kind?: SessionKind; onDone?: () => void }) {
  const [queue] = useState(() => buildQueue(kind));
  const [pos, setPos] = useState(0);
  const [results, setResults] = useState<boolean[]>([]);
  const [answered, setAnswered] = useState(false);

  if (queue.length === 0) {
    return (
      <div className="card empty">
        {kind === 'due' ? 'Nothing due for review right now. Nice — come back tomorrow.' :
          kind === 'struggling' ? 'No struggling topics. Everything you missed has since been answered correctly.' :
            'Answer some lesson questions first — then mixed quizzes draw from everything you have learned.'}
      </div>
    );
  }

  if (pos >= queue.length) {
    const right = results.filter(Boolean).length;
    return (
      <div className="card complete-box fade-in">
        <div className="eyebrow">Session complete</div>
        <h2 style={{ margin: '.3em 0' }}>{right} / {queue.length} correct</h2>
        <p className="muted">
          {right === queue.length ? 'Everything held up. These will come back at longer intervals.' :
            'The ones you missed will come back tomorrow, then at growing intervals until they stick.'}
        </p>
        {onDone && <button className="btn primary" onClick={onDone}>Done</button>}
      </div>
    );
  }

  const id = queue[pos];
  const entry = questionById.get(id)!;
  const lesson = lessonById.get(entry.lesson.id)!;
  return (
    <div>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span className="small muted">Question {pos + 1} of {queue.length} · from <a href={`#/lesson/${lesson.id}`}>W{lesson.week} D{lesson.day}: {lesson.title}</a></span>
        <div className="progressbar" style={{ width: 160 }}><div style={{ width: `${(pos / queue.length) * 100}%` }} /></div>
      </div>
      <QuestionCard
        key={id}
        q={entry.q}
        mode="review"
        onAnswered={(ok) => {
          if (kind !== 'mixed' || getState().cards[id]) recordReview(id, ok);
          setResults((r) => [...r, ok]);
          setAnswered(true);
        }}
      />
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <button className="btn primary" disabled={!answered} onClick={() => { setAnswered(false); setPos((p) => p + 1); }}>
          {pos + 1 === queue.length ? 'Finish' : 'Next question →'}
        </button>
      </div>
    </div>
  );
}

export function ReviewPage() {
  const st = useStore();
  const due = useDueCount();
  const [session, setSession] = useState<SessionKind | null>(null);
  const [n, setN] = useState(0);
  const struggling = Object.entries(st.cards).filter(([id, c]) => isStruggling(c) && questionById.has(id));
  const strugglingLessons = [...new Set(struggling.map(([id]) => id.split(':')[0]))].map((id) => lessonById.get(id)!).filter(Boolean);
  const answeredCount = Object.keys(st.answers).length;

  if (session) {
    return (
      <div className="narrow">
        <button className="btn ghost sm" onClick={() => setSession(null)}>← Back to Review</button>
        <h1 style={{ fontSize: '1.6rem' }}>{session === 'due' ? 'Today’s revision' : session === 'struggling' ? 'Struggling topics' : 'Mixed quiz'}</h1>
        <ReviewSession key={n} kind={session} onDone={() => { setSession(null); setN(n + 1); }} />
      </div>
    );
  }

  return (
    <div className="narrow">
      <div className="eyebrow">Review</div>
      <h1>Keep it in your head</h1>
      <div className="card" style={{ marginBottom: 14 }}>
        {due > 0 ? (
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <div>
              <h2 style={{ margin: 0 }}>Today: {minutesFor(Math.min(due, SESSION_SIZE))} minutes of revision — {Math.min(due, SESSION_SIZE)} questions</h2>
              <div className="muted small">{due > SESSION_SIZE ? `${due} due in total; you can do another round afterwards.` : 'Questions picked from what you studied, at the moment you are about to forget them.'}</div>
            </div>
            <button className="btn primary big" onClick={() => setSession('due')}>Start revision</button>
          </div>
        ) : (
          <div>
            <h2 style={{ margin: 0 }}>Nothing due today</h2>
            <div className="muted small">Questions you answer in lessons come back here automatically — sooner if you got them wrong.</div>
          </div>
        )}
      </div>
      <div className="grid2">
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Struggling topics</h3>
          {strugglingLessons.length === 0 ? <p className="muted small">None right now.</p> : (
            <ul className="small" style={{ paddingLeft: '1.1em' }}>
              {strugglingLessons.map((l) => <li key={l.id}><a href={`#/lesson/${l.id}`}>W{l.week} D{l.day}: {l.title}</a></li>)}
            </ul>
          )}
          <button className="btn" disabled={struggling.length === 0} onClick={() => setSession('struggling')}>Practise these ({struggling.length})</button>
        </div>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Mixed quiz</h3>
          <p className="muted small">8 random questions from everything you have covered, mixed across chapters. Mixing topics is harder — and better for long-term memory.</p>
          <button className="btn" disabled={answeredCount === 0} onClick={() => setSession('mixed')}>Start mixed quiz</button>
        </div>
      </div>
    </div>
  );
}
