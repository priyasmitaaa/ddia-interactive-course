import { useEffect, useMemo, useRef, useState } from 'react';
import { CHAPTERS, exerciseById, lessonById, lessons } from '../lib/content';
import { bookHrefPrinted } from '../lib/pdf';
import { completeLesson, openLesson, uncompleteLesson, useStore } from '../lib/store';
import type { Lesson, Section } from '../lib/types';
import { VIZ } from '../viz';
import { KIND_LABEL } from './Home';
import { Markdown } from './Markdown';
import { ExerciseBody } from './Practice';
import { QuizSection } from './Quiz';
import { ReviewSession } from './Review';

const STAGES = ['Learn', 'Visualize', 'Practice', 'Quiz', 'Complete'] as const;
type Stage = typeof STAGES[number];

const stageOf = (s: Section): Stage => {
  switch (s.type) {
    case 'visual': return 'Visualize';
    case 'practice': case 'task': return 'Practice';
    case 'quiz': case 'review': return 'Quiz';
    default: return 'Learn';
  }
};

const LABEL: Record<string, string> = {
  problem: 'The problem', intuition: 'Intuition', details: 'How it really works', visual: 'See it',
  practice: 'Hands-on', quiz: 'Check your understanding', connect: 'Connect the dots', note: 'Note',
  extra: 'Beyond the book', review: 'Spaced review', task: 'Task',
};

export function LessonView({ id }: { id: string }) {
  const lesson = lessonById.get(id);
  const st = useStore();
  useEffect(() => { if (lesson) openLesson(lesson.id); }, [lesson?.id]);
  if (!lesson) return <div className="empty">Lesson not found. <a href="#/">Back to course</a></div>;

  const idx = lessons.indexOf(lesson);
  const prev = lessons[idx - 1];
  const next = lessons[idx + 1];
  const done = !!st.completed[lesson.id];
  const answered = lesson.questions.filter((q) => st.answers[q.id]).length;

  return (
    <div className="narrow">
      <LessonHeader lesson={lesson} />
      <StageBar lesson={lesson} />
      {lesson.sections.map((s, i) => <SectionView key={i} s={s} i={i} lessonId={lesson.id} />)}

      <div id="stage-Complete" className="section card complete-box">
        <div className="eyebrow">Complete</div>
        {done ? (
          <>
            <div className="done-banner" style={{ display: 'inline-block', margin: '10px 0 16px' }}>✓ Completed</div>
            <div className="row" style={{ justifyContent: 'center' }}>
              {next ? <a className="btn primary big" href={`#/lesson/${next.id}`}>Next: {next.title} →</a> : <a className="btn primary big" href="#/">Back to course</a>}
            </div>
            <button className="btn ghost sm" style={{ marginTop: 12 }} onClick={() => uncompleteLesson(lesson.id)}>Mark as not done</button>
          </>
        ) : (
          <>
            <h2 style={{ margin: '.3em 0' }}>Ready to finish today?</h2>
            {lesson.complete.length > 0 && (
              <>
                <div className="small muted">You are done when you can honestly tick these off:</div>
                <ul>{lesson.complete.map((c, i) => <li key={i}>{c}</li>)}</ul>
              </>
            )}
            {lesson.questions.length > 0 && answered < lesson.questions.length && (
              <p className="small" style={{ color: 'var(--warn)' }}>
                You have answered {answered} of {lesson.questions.length} questions. Unanswered ones won’t be scheduled for review.
              </p>
            )}
            <div>
              <button
                className="btn primary big"
                data-testid="complete"
                onClick={() => {
                  completeLesson(lesson.id);
                  window.location.hash = next ? `#/lesson/${next.id}` : '#/';
                }}
              >
                Complete lesson{next ? ' & continue' : ''} →
              </button>
            </div>
            <div className="small muted" style={{ marginTop: 10 }}>Tomorrow, “Continue Learning” picks up right after this.</div>
          </>
        )}
      </div>

      <div className="footer-nav">
        {prev ? <a className="btn ghost" href={`#/lesson/${prev.id}`}>← W{prev.week} D{prev.day}</a> : <span />}
        <a className="btn ghost" href="#/">Course map</a>
        {next ? <a className="btn ghost" href={`#/lesson/${next.id}`}>W{next.week} D{next.day} →</a> : <span />}
      </div>
    </div>
  );
}

function LessonHeader({ lesson }: { lesson: Lesson }) {
  return (
    <div className="lesson-head">
      <div className="eyebrow">
        Week {lesson.week} · Day {lesson.day}
        {lesson.chapter ? ` · Chapter ${lesson.chapter}: ${CHAPTERS[lesson.chapter]}` : ''}
      </div>
      <h1>{lesson.title}</h1>
      <div className="meta">
        <span>⏱ about {lesson.minutes} min</span>
        {KIND_LABEL[lesson.kind] && <span className={`kind-tag ${lesson.kind}`}>{KIND_LABEL[lesson.kind]}</span>}
      </div>
      {lesson.objectives.length > 0 && (
        <div className="box">
          <h4>By the end of today you will be able to</h4>
          <ul>{lesson.objectives.map((o, i) => <li key={i}>{o}</li>)}</ul>
        </div>
      )}
      {lesson.reading.length > 0 && (
        <div className="box">
          <h4>Read in the book</h4>
          <ul className="reading-list">
            {lesson.reading.map((r, i) => (
              <li key={i}>
                <span>{r.section}</span>
                <a className="pp" href={bookHrefPrinted(r.from)} target="_blank" rel="noreferrer">
                  pp. {r.from}{r.to !== r.from ? `–${r.to}` : ''} ↗
                </a>
              </li>
            ))}
          </ul>
          <div className="small muted" style={{ marginTop: 8 }}>
            Page numbers are the ones printed in your PDF. Suggested rhythm: skim the lesson’s first section, read the pages, then come back.
          </div>
        </div>
      )}
    </div>
  );
}

function StageBar({ lesson }: { lesson: Lesson }) {
  const present = useMemo(() => {
    const set = new Set(lesson.sections.map(stageOf));
    return STAGES.filter((s) => s === 'Complete' || set.has(s));
  }, [lesson]);
  const [active, setActive] = useState<Stage>('Learn');
  const ref = useRef(active);
  useEffect(() => {
    const els = present.map((s) => document.getElementById(`stage-${s}`)).filter(Boolean) as HTMLElement[];
    const on = () => {
      let cur: Stage = present[0];
      for (const el of els) if (el.getBoundingClientRect().top < 160) cur = el.id.replace('stage-', '') as Stage;
      if (cur !== ref.current) { ref.current = cur; setActive(cur); }
    };
    window.addEventListener('scroll', on, { passive: true });
    on();
    return () => window.removeEventListener('scroll', on);
  }, [present, lesson.id]);
  const ai = present.indexOf(active);
  return (
    <div className="stages">
      {present.map((s, i) => (
        <button
          key={s}
          className={`stage ${s === active ? 'active' : i < ai ? 'done' : ''}`}
          onClick={() => document.getElementById(`stage-${s}`)?.scrollIntoView({ behavior: 'smooth' })}
        >
          {s}
        </button>
      ))}
    </div>
  );
}

function SectionView({ s, i, lessonId }: { s: Section; i: number; lessonId: string }) {
  const lesson = lessonById.get(lessonId)!;
  const stage = stageOf(s);
  const firstOfStage = lesson.sections.findIndex((x) => stageOf(x) === stage) === i;
  const anchor = firstOfStage ? `stage-${stage}` : undefined;
  const title = s.title || '';
  return (
    <section className={`section ${s.type}`} id={anchor}>
      <div className="section-label">{LABEL[s.type]}</div>
      {title && <h2>{title}</h2>}
      <SectionBody s={s} />
    </section>
  );
}

function SectionBody({ s }: { s: Section }) {
  switch (s.type) {
    case 'visual': {
      const C = s.ref ? VIZ[s.ref] : undefined;
      return (
        <>
          {s.body && <Markdown src={s.body} />}
          {C ? <div className="viz"><C {...(s.props ?? {})} /></div> : <div className="viz err">Missing visualization “{s.ref}”.</div>}
        </>
      );
    }
    case 'practice': {
      const ex = s.ref ? exerciseById.get(s.ref) : undefined;
      return (
        <>
          {s.body && <Markdown src={s.body} />}
          {ex ? <ExerciseBody ex={ex} inline /> : <div className="err">Missing exercise “{s.ref}”.</div>}
        </>
      );
    }
    case 'quiz':
      return (
        <>
          {s.body.split(/^###/m)[0].trim() && <Markdown src={s.body.split(/^###/m)[0]} />}
          <QuizSection questions={s.questions ?? []} />
        </>
      );
    case 'review':
      return (
        <>
          {s.body && <Markdown src={s.body} />}
          <ReviewSession kind="due" />
        </>
      );
    default:
      return <div className="md-wrap"><Markdown src={s.body} /></div>;
  }
}
