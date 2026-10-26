import type {
  ChoiceLabel, Exercise, FreeLabel, Lesson, LessonKind, Question, Reading, Section, SectionType, Week,
} from './types';

/** PDF page = printed page + 22 in the Sixth Early Release PDF (verified). */
export const PDF_OFFSET = 22;

type FM = Record<string, string | string[]>;

/** Tiny frontmatter parser: `key: value` scalars and `key:` followed by `- item` lists. */
export function parseFrontmatter(src: string): { fm: FM; body: string } {
  const text = src.replace(/\r\n/g, '\n');
  if (!text.startsWith('---\n')) return { fm: {}, body: text };
  const end = text.indexOf('\n---', 4);
  if (end < 0) throw new Error('Unclosed frontmatter');
  const head = text.slice(4, end);
  const body = text.slice(end + 4).replace(/^\n/, '');
  const fm: FM = {};
  let listKey: string | null = null;
  for (const raw of head.split('\n')) {
    if (!raw.trim()) continue;
    const item = raw.match(/^\s*-\s+(.*)$/);
    if (item && listKey) {
      (fm[listKey] as string[]).push(item[1].trim());
      continue;
    }
    const kv = raw.match(/^([A-Za-z_]+):\s*(.*)$/);
    if (!kv) throw new Error(`Bad frontmatter line: ${raw}`);
    if (kv[2] === '') { fm[kv[1]] = []; listKey = kv[1]; }
    else { fm[kv[1]] = kv[2].trim(); listKey = null; }
  }
  return { fm, body };
}

const str = (v: FM[string] | undefined, d = '') => (typeof v === 'string' ? v : d);
const list = (v: FM[string] | undefined) => (Array.isArray(v) ? v : v ? [v] : []);

export function parseReading(s: string): Reading {
  const [section, pages] = s.split('|').map((x) => x.trim());
  if (!section || !pages) throw new Error(`Bad reading entry "${s}" (want "Section | 70-74")`);
  const m = pages.match(/^(\d+)(?:-(\d+))?$/);
  if (!m) throw new Error(`Bad page range "${pages}"`);
  const from = Number(m[1]);
  const to = Number(m[2] ?? m[1]);
  return { section, pages, from, to };
}

const SECTION_TYPES: SectionType[] = [
  'problem', 'intuition', 'details', 'visual', 'practice', 'quiz', 'connect', 'note', 'extra', 'review', 'task',
];
const CHOICE_LABELS: ChoiceLabel[] = ['mcq', 'predict', 'tradeoff'];
const FREE_LABELS: FreeLabel[] = ['short', 'explain', 'scenario', 'design'];

/** Parses quiz bodies. Each question begins with `### <label>`. */
export function parseQuiz(body: string, idPrefix: string, startIndex: number): Question[] {
  const blocks = body.split(/^###\s+/m).slice(1);
  return blocks.map((block, i) => {
    const nl = block.indexOf('\n');
    const label = block.slice(0, nl).trim().toLowerCase();
    const rest = block.slice(nl + 1);
    const id = `${idPrefix}:q${startIndex + i + 1}`;
    const sep = rest.search(/^>>>\s*$/m);
    if (sep < 0) throw new Error(`${id}: question has no ">>>" explanation separator`);
    const before = rest.slice(0, sep);
    const after = rest.slice(sep).replace(/^>>>\s*\n?/, '').trim();
    if ((CHOICE_LABELS as string[]).includes(label)) {
      const lines = before.split('\n');
      const promptLines: string[] = [];
      const options: string[] = [];
      let answer = -1;
      let correctCount = 0;
      for (const line of lines) {
        const m = line.match(/^- \[( |x)\]\s+(.*)$/);
        if (m) {
          if (m[1] === 'x') { answer = options.length; correctCount++; }
          options.push(m[2].trim());
        } else if (options.length === 0) promptLines.push(line);
        else if (line.trim()) throw new Error(`${id}: text after options: "${line}"`);
      }
      if (correctCount !== 1) throw new Error(`${id}: needs exactly one [x] option (has ${correctCount})`);
      if (options.length < 2) throw new Error(`${id}: needs at least 2 options`);
      return {
        type: 'choice', id, label: label as ChoiceLabel,
        prompt: promptLines.join('\n').trim(), options, answer, explain: after,
      };
    }
    if ((FREE_LABELS as string[]).includes(label)) {
      return { type: 'free', id, label: label as FreeLabel, prompt: before.trim(), model: after };
    }
    throw new Error(`${id}: unknown question label "${label}"`);
  });
}

/** Splits a lesson body into `:::type Ref | Title` ... `:::` sections. */
export function parseSections(body: string, lessonId: string): Section[] {
  const lines = body.split('\n');
  const sections: Section[] = [];
  let cur: { type: SectionType; head: string; lines: string[] } | null = null;
  let qCount = 0;
  const flush = () => {
    if (!cur) return;
    let ref: string | undefined;
    let title = cur.head;
    if (cur.type === 'visual' || cur.type === 'practice') {
      const [r, ...t] = cur.head.split('|');
      ref = r.trim();
      title = t.join('|').trim();
    }
    let text = cur.lines.join('\n');
    let props: Record<string, unknown> | undefined;
    const pm = text.match(/^\s*@props\s+(\{.*\})\s*$/m);
    if (pm) {
      props = JSON.parse(pm[1]);
      text = text.replace(pm[0], '');
    }
    const s: Section = { type: cur.type, title, body: text.trim(), ref, props };
    if (cur.type === 'quiz') {
      s.questions = parseQuiz(text, lessonId, qCount);
      qCount += s.questions.length;
    }
    sections.push(s);
    cur = null;
  };
  for (const line of lines) {
    const open = line.match(/^:::([a-z]+)\s*(.*)$/);
    if (open && !cur) {
      const t = open[1] as SectionType;
      if (!SECTION_TYPES.includes(t)) throw new Error(`${lessonId}: unknown section type ":::${t}"`);
      cur = { type: t, head: open[2].trim(), lines: [] };
      continue;
    }
    if (line.trim() === ':::' && cur) { flush(); continue; }
    if (cur) cur.lines.push(line);
    else if (line.trim()) throw new Error(`${lessonId}: text outside a section: "${line.slice(0, 60)}"`);
  }
  if (cur) throw new Error(`${lessonId}: unclosed section`);
  return sections;
}

export function parseLesson(path: string, src: string): Lesson {
  const m = path.match(/w(\d+)\/d(\d+)[^/]*\.md$/);
  if (!m) throw new Error(`Bad lesson path ${path}`);
  const week = Number(m[1]);
  const day = Number(m[2]);
  const id = `w${String(week).padStart(2, '0')}d${day}`;
  const { fm, body } = parseFrontmatter(src);
  const sections = parseSections(body, id);
  const chapter = str(fm.chapter) ? Number(str(fm.chapter)) : null;
  return {
    id, week, day, file: path,
    title: str(fm.title, id),
    kind: (str(fm.kind, 'lesson') as LessonKind),
    minutes: Number(str(fm.minutes, '90')),
    chapter: chapter !== null && Number.isFinite(chapter) ? chapter : null,
    objectives: list(fm.objectives),
    reading: list(fm.reading).map(parseReading),
    complete: list(fm.complete),
    sections,
    questions: sections.flatMap((s) => s.questions ?? []),
  };
}

export function parseWeekMeta(src: string) {
  const { fm, body } = parseFrontmatter(src);
  return {
    title: str(fm.title),
    part: str(fm.part),
    chapters: list(fm.chapters).flatMap((c) => c.split(',')).map((c) => Number(c.trim())).filter((n) => n > 0),
    summary: body.trim(),
  };
}

export function parseExercise(path: string, src: string): Exercise {
  const m = path.match(/practice\/([^/]+)\/README\.md$/);
  if (!m) throw new Error(`Bad exercise path ${path}`);
  const { fm, body } = parseFrontmatter(src);
  const ch = str(fm.chapter);
  return {
    id: m[1],
    title: str(fm.title, m[1]),
    chapter: ch ? Number(ch) : null,
    topic: str(fm.topic, ''),
    minutes: Number(str(fm.minutes, '45')),
    body: body.trim(),
    folder: `practice/${m[1]}`,
  };
}

export function buildWeeks(
  lessonFiles: Record<string, string>,
  weekFiles: Record<string, string>,
): Week[] {
  const byWeek = new Map<number, Lesson[]>();
  for (const [path, src] of Object.entries(lessonFiles)) {
    const l = parseLesson(path, src);
    if (!byWeek.has(l.week)) byWeek.set(l.week, []);
    byWeek.get(l.week)!.push(l);
  }
  const weeks: Week[] = [];
  for (const [w, lessons] of [...byWeek.entries()].sort((a, b) => a[0] - b[0])) {
    const metaPath = Object.keys(weekFiles).find((p) => p.match(new RegExp(`w${String(w).padStart(2, '0')}/week\\.md$`)));
    const meta = metaPath ? parseWeekMeta(weekFiles[metaPath]) : { title: `Week ${w}`, part: '', chapters: [], summary: '' };
    weeks.push({ week: w, ...meta, lessons: lessons.sort((a, b) => a.day - b.day) });
  }
  return weeks;
}

export const pdfPage = (printed: number) => printed + PDF_OFFSET;
