import { useState } from 'react';
import type { ChoiceQuestion, FreeQuestion, Question } from '../lib/types';
import { recordLessonAnswer, saveDraft, useStore } from '../lib/store';
import { InlineMd, Markdown } from './Markdown';

const LABELS: Record<string, string> = {
  mcq: 'Multiple choice',
  predict: 'Predict the outcome',
  tradeoff: 'Trade-off',
  short: 'Short answer',
  explain: 'Explain in your own words',
  scenario: 'Scenario',
  design: 'Design question',
};

type Mode = 'lesson' | 'review';

interface Props {
  q: Question;
  mode?: Mode;
  /** called once when the learner has an answer (review mode uses this to grade) */
  onAnswered?: (correct: boolean) => void;
  index?: number;
}

export function QuestionCard({ q, mode = 'lesson', onAnswered, index }: Props) {
  return q.type === 'choice'
    ? <Choice q={q} mode={mode} onAnswered={onAnswered} index={index} />
    : <Free q={q} mode={mode} onAnswered={onAnswered} index={index} />;
}

function Choice({ q, mode, onAnswered, index }: { q: ChoiceQuestion } & Omit<Props, 'q'>) {
  const st = useStore();
  const saved = mode === 'lesson' ? st.answers[q.id] : undefined;
  const [picked, setPicked] = useState<number | null>(saved?.chosen ?? null);
  const answered = picked !== null;
  const pick = (i: number) => {
    if (answered) return;
    setPicked(i);
    const correct = i === q.answer;
    if (mode === 'lesson') recordLessonAnswer(q.id, correct, { chosen: i });
    onAnswered?.(correct);
  };
  const correct = picked === q.answer;
  return (
    <div className="q fade-in" data-qid={q.id}>
      <div className="q-label">{index !== undefined ? `Q${index + 1} · ` : ''}{LABELS[q.label]}</div>
      <Markdown src={q.prompt} className="q-prompt" />
      {q.options.map((o, i) => {
        let cls = 'opt';
        if (answered) {
          if (i === q.answer) cls += ' correct';
          else if (i === picked) cls += ' wrong';
          else cls += ' dim';
        }
        return (
          <button key={i} className={cls} disabled={answered} onClick={() => pick(i)}>
            <InlineMd src={o} />
          </button>
        );
      })}
      {answered && (
        <div className={`feedback ${correct ? 'good' : 'bad'} fade-in`}>
          <strong className="verdict">{correct ? 'Correct.' : 'Not quite.'}</strong>
          <Markdown src={q.explain} />
          {mode === 'lesson' && (
            <button className="btn sm ghost" onClick={() => setPicked(null)}>Try again (for practice)</button>
          )}
        </div>
      )}
    </div>
  );
}

function Free({ q, mode, onAnswered, index }: { q: FreeQuestion } & Omit<Props, 'q'>) {
  const st = useStore();
  const saved = mode === 'lesson' ? st.answers[q.id] : undefined;
  const draftKey = mode === 'lesson' ? q.id : `review:${q.id}`;
  const [text, setText] = useState(st.drafts[draftKey] ?? '');
  const [shown, setShown] = useState(!!saved);
  const [graded, setGraded] = useState<boolean | null>(saved ? saved.correct : null);
  const grade = (ok: boolean) => {
    setGraded(ok);
    if (mode === 'lesson') recordLessonAnswer(q.id, ok, { text });
    onAnswered?.(ok);
  };
  return (
    <div className="q fade-in" data-qid={q.id}>
      <div className="q-label">{index !== undefined ? `Q${index + 1} · ` : ''}{LABELS[q.label]}</div>
      <Markdown src={q.prompt} className="q-prompt" />
      <textarea
        className="answer"
        placeholder="Write your answer first — even a rough one. Retrieval is what makes it stick."
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => saveDraft(draftKey, text)}
      />
      <div className="row" style={{ marginTop: 10 }}>
        {!shown && (
          <button className="btn" onClick={() => { saveDraft(draftKey, text); setShown(true); }}>
            {text.trim() ? 'Compare with model answer' : 'Show model answer'}
          </button>
        )}
      </div>
      {shown && (
        <div className="model fade-in">
          <strong>Model answer</strong>
          <Markdown src={q.model} />
          {graded === null ? (
            <div className="row">
              <span className="small muted">Be honest — this decides when you see it again:</span>
              <button className="btn sm good" onClick={() => grade(true)}>I had the key points</button>
              <button className="btn sm" onClick={() => grade(false)}>I missed something</button>
            </div>
          ) : (
            <div className={`small ${graded ? 'ok' : ''}`} style={{ color: graded ? 'var(--good)' : 'var(--warn)', fontWeight: 600 }}>
              {graded ? 'Marked as understood.' : 'Marked for extra review — it will come back soon.'}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function QuizSection({ questions }: { questions: Question[] }) {
  return <>{questions.map((q, i) => <QuestionCard key={q.id} q={q} index={i} />)}</>;
}
