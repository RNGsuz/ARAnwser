export type AssistantState =
  | 'idle'
  | 'camera'
  | 'capturing'
  | 'captured'
  | 'listening'
  | 'reviewing'
  | 'processing'
  | 'answer'
  | 'error';

export type AnswerBlock =
  | { type: 'text'; markdown: string }
  | { type: 'code'; language: string; code: string }
  | { type: 'math'; latex: string; displayMode: boolean };

export interface SolutionStep {
  title: string;
  explanation: string;
  contentType: 'text' | 'math' | 'code';
  content: string;
  language: string | null;
}

export interface GuidedSolution {
  kind: 'math' | 'code' | 'document' | 'concept' | 'direct' | 'selection';
  title: string;
  steps: SolutionStep[];
}

export interface GlassesExercise {
  label: string;
  labelSource: 'document' | 'generated';
  sourceLatex: string;
  resultLatex: string;
  transformations: Array<{ latex: string; operation: string | null }>;
}

export interface RecognizedItem {
  label: string;
  labelSource: 'document' | 'generated';
  sourceLatex: string;
}

export interface GlassesCodeUnit {
  label: string;
  language: string;
  code: string;
  explanation: string;
}

export interface DocumentAnswer {
  queryId: string;
  sessionId: string;
  question: string;
  shortAnswer: string;
  glassesSummary?: { format: 'text' | 'output'; lines: string[] };
  glassesExercises?: GlassesExercise[];
  recognizedItems?: RecognizedItem[];
  glassesCodeUnits?: GlassesCodeUnit[];
  solution?: GuidedSolution;
  spokenAnswer: string;
  evidence: string[];
  confidence: number;
  needsRetake: boolean;
  retakeHint: string | null;
  blocks?: AnswerBlock[];
}

export interface HistoryEntry {
  question: string;
  shortAnswer: string;
  glassesSummary?: { format: 'text' | 'output'; lines: string[] };
  glassesExercises?: GlassesExercise[];
  recognizedItems?: RecognizedItem[];
  glassesCodeUnits?: GlassesCodeUnit[];
  solution?: GuidedSolution;
  spokenAnswer: string;
  confidence: number;
  blocks?: AnswerBlock[];
  createdAt: string;
}
