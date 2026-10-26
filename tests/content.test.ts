import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { exerciseById, exercises, lessons, weeks } from '../src/lib/content';
import { VIZ } from '../src/viz';

/**
 * Chapter body pages in the PDF (printed numbers), from chapter start to the page where
 * the chapter's References begin. Verified against the PDF's headings.
 * Part intros are attached to the chapter that follows them.
 */
const CHAPTER_PAGES: Record<number, [number, number][]> = {
  1: [[1, 20]],
  2: [[25, 62]],
  3: [[67, 100]],
  4: [[107, 135]],
  5: [[141, 143], [145, 186]],
  6: [[191, 208]],
  7: [[213, 258]],
  8: [[265, 302]],
  9: [[311, 365]],
  10: [[375, 376], [377, 417]],
  11: [[425, 463]],
};
const chapterRange = (c: number) => {
  const r = CHAPTER_PAGES[c];
  return [r[0][0], r[r.length - 1][1] + 2] as const; // allow references/summary spill-over
};

describe('course structure', () => {
  it('has 24 weeks of 6 days each', () => {
    expect(weeks.map((w) => w.week)).toEqual(Array.from({ length: 24 }, (_, i) => i + 1));
    for (const w of weeks) {
      expect(w.lessons.map((l) => l.day), `week ${w.week}`).toEqual([1, 2, 3, 4, 5, 6]);
      expect(w.title, `week ${w.week} title`).not.toBe('');
      expect(w.summary.length, `week ${w.week} summary`).toBeGreaterThan(20);
    }
  });

  it('makes day 6 a lighter review day', () => {
    for (const w of weeks) {
      const d6 = w.lessons[5];
      expect(['review', 'assessment'], `${d6.id} kind`).toContain(d6.kind);
      expect(d6.minutes, `${d6.id} minutes`).toBeLessThanOrEqual(75);
    }
  });
});

describe('every lesson', () => {
  for (const l of lessons) {
    it(`${l.id} ${l.title}`, () => {
      expect(l.title.length).toBeGreaterThan(3);
      expect(l.minutes).toBeGreaterThanOrEqual(30);
      expect(l.minutes).toBeLessThanOrEqual(120);
      expect(l.objectives.length, 'objectives').toBeGreaterThanOrEqual(2);
      expect(l.complete.length, 'completion criteria').toBeGreaterThanOrEqual(1);
      expect(l.sections.length, 'sections').toBeGreaterThanOrEqual(3);
      // Real teaching content, not placeholders.
      const text = l.sections.map((s) => s.body).join('\n');
      expect(text).not.toMatch(/coming soon|\bTBD\b|lorem ipsum|\bFIXME\b|^\s*TODO\b/im);
      const words = text.split(/\s+/).length;
      expect(words, 'lesson words').toBeGreaterThan(l.kind === 'review' ? 120 : 400);
      // Questions.
      const minQ = l.kind === 'lesson' || l.kind === 'supplement' ? 4 : 3;
      expect(l.questions.length, 'questions').toBeGreaterThanOrEqual(minQ);
      for (const q of l.questions) {
        expect(q.prompt.length, `${q.id} prompt`).toBeGreaterThan(10);
        if (q.type === 'choice') {
          expect(q.answer).toBeGreaterThanOrEqual(0);
          expect(q.answer).toBeLessThan(q.options.length);
          expect(q.explain.length, `${q.id} explanation`).toBeGreaterThan(30);
          expect(new Set(q.options).size, `${q.id} duplicate options`).toBe(q.options.length);
        } else {
          expect(q.model.length, `${q.id} model answer`).toBeGreaterThan(40);
        }
      }
      // References into the book.
      for (const r of l.reading) {
        expect(r.from).toBeLessThanOrEqual(r.to);
        expect(r.from).toBeGreaterThanOrEqual(1);
        expect(r.to).toBeLessThanOrEqual(469);
        if (l.chapter) {
          const [a, b] = chapterRange(l.chapter);
          expect(r.from, `${l.id} reading "${r.section}" outside chapter ${l.chapter}`).toBeGreaterThanOrEqual(a);
          expect(r.to, `${l.id} reading "${r.section}" outside chapter ${l.chapter}`).toBeLessThanOrEqual(b);
        }
      }
      if (l.kind === 'lesson' && l.chapter) expect(l.reading.length, 'lesson reading').toBeGreaterThanOrEqual(1);
      // Visuals and exercises resolve.
      for (const s of l.sections) {
        if (s.type === 'visual') expect(VIZ[s.ref!], `visual ${s.ref}`).toBeTruthy();
        if (s.type === 'practice') expect(exerciseById.get(s.ref!), `exercise ${s.ref}`).toBeTruthy();
      }
    });
  }
});

describe('book coverage', () => {
  it('assigns every page of every chapter as reading', () => {
    const covered = new Set<number>();
    for (const l of lessons) for (const r of l.reading) for (let p = r.from; p <= r.to; p++) covered.add(p);
    const missing: string[] = [];
    for (const [c, ranges] of Object.entries(CHAPTER_PAGES)) {
      for (const [a, b] of ranges) for (let p = a; p <= b; p++) if (!covered.has(p)) missing.push(`ch${c}:p${p}`);
    }
    expect(missing).toEqual([]);
  });

  it('has lessons for all 11 chapters', () => {
    for (let c = 1; c <= 11; c++) expect(lessons.some((l) => l.chapter === c), `chapter ${c}`).toBe(true);
  });
});

describe('exercises', () => {
  const root = path.resolve(__dirname, '..');
  for (const e of exercises) {
    it(`${e.id}`, () => {
      expect(e.title.length).toBeGreaterThan(3);
      for (const h of ['Objective', 'Setup', 'Predict', 'Run', 'Observe', 'Questions']) {
        expect(e.body, `${e.id} missing "## ${h}..." heading`).toMatch(new RegExp(`^## ${h}`, 'm'));
      }
      const files = fs.readdirSync(path.join(root, e.folder));
      expect(files.some((f) => f.endsWith('.py') || f.endsWith('.sql') || f.endsWith('.sh')), `${e.id} has code`).toBe(true);
      const used = lessons.some((l) => l.sections.some((s) => s.type === 'practice' && s.ref === e.id));
      expect(used, `${e.id} is used in a lesson`).toBe(true);
    });
  }
});
