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

export interface DocumentAnswer {
  queryId: string;
  sessionId: string;
  question: string;
  shortAnswer: string;
  glassesSummary?: { format: 'text' | 'output'; lines: string[] };
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
  spokenAnswer: string;
  confidence: number;
  blocks?: AnswerBlock[];
  createdAt: string;
}
