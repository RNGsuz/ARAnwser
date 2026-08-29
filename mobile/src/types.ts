export type AssistantState =
  | 'idle'
  | 'capturing'
  | 'captured'
  | 'listening'
  | 'reviewing'
  | 'processing'
  | 'answer'
  | 'error';

export interface DocumentAnswer {
  queryId: string;
  sessionId: string;
  question: string;
  shortAnswer: string;
  spokenAnswer: string;
  evidence: string[];
  confidence: number;
  needsRetake: boolean;
  retakeHint: string | null;
}

export interface HistoryEntry {
  question: string;
  shortAnswer: string;
  spokenAnswer: string;
  confidence: number;
  createdAt: string;
}
