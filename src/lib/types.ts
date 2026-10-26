export type LessonKind = 'lesson' | 'lab' | 'review' | 'assessment' | 'project' | 'supplement';

export interface Reading {
  section: string;
  /** Printed page numbers as they appear in the PDF, e.g. "70-74". */
  pages: string;
  from: number;
  to: number;
}

export type ChoiceLabel = 'mcq' | 'predict' | 'tradeoff';
export type FreeLabel = 'short' | 'explain' | 'scenario' | 'design';

export interface ChoiceQuestion {
  type: 'choice';
  id: string;
  label: ChoiceLabel;
  prompt: string;
  options: string[];
  answer: number;
  explain: string;
}

export interface FreeQuestion {
  type: 'free';
  id: string;
  label: FreeLabel;
  prompt: string;
  model: string;
}

export type Question = ChoiceQuestion | FreeQuestion;

export type SectionType =
  | 'problem' | 'intuition' | 'details' | 'visual' | 'practice'
  | 'quiz' | 'connect' | 'note' | 'extra' | 'review' | 'task';

export interface Section {
  type: SectionType;
  title: string;
  body: string;
  /** visual: component name; practice: exercise id */
  ref?: string;
  props?: Record<string, unknown>;
  questions?: Question[];
}

export interface Lesson {
  id: string;           // "w03d1"
  week: number;
  day: number;
  file: string;
  title: string;
  kind: LessonKind;
  minutes: number;
  chapter: number | null;
  objectives: string[];
  reading: Reading[];
  complete: string[];
  sections: Section[];
  questions: Question[];
}

export interface Week {
  week: number;
  title: string;
  part: string;
  summary: string;
  chapters: number[];
  lessons: Lesson[];
}

export interface Exercise {
  id: string;
  title: string;
  chapter: number | null;
  topic: string;
  minutes: number;
  body: string;
  folder: string;
}
