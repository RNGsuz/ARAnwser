import AsyncStorage from '@react-native-async-storage/async-storage';
import type { DocumentAnswer, HistoryEntry } from './types';

const key = 'ar-answer-history-v1';

export async function loadHistory(): Promise<HistoryEntry[]> {
  const value = await AsyncStorage.getItem(key);
  return value ? (JSON.parse(value) as HistoryEntry[]) : [];
}

export async function saveAnswer(answer: DocumentAnswer): Promise<void> {
  const current = await loadHistory();
  const entry: HistoryEntry = {
    question: answer.question,
    shortAnswer: answer.shortAnswer,
    glassesSummary: answer.glassesSummary,
    glassesExercises: answer.glassesExercises,
    recognizedItems: answer.recognizedItems,
    glassesCodeUnits: answer.glassesCodeUnits,
    solution: answer.solution,
    spokenAnswer: answer.spokenAnswer,
    confidence: answer.confidence,
    blocks: answer.blocks,
    createdAt: new Date().toISOString(),
  };
  await AsyncStorage.setItem(key, JSON.stringify([entry, ...current].slice(0, 30)));
}

export async function clearHistory(): Promise<void> {
  await AsyncStorage.removeItem(key);
}

export async function deleteHistoryEntry(createdAt: string): Promise<void> {
  const current = await loadHistory();
  await AsyncStorage.setItem(key, JSON.stringify(current.filter((entry) => entry.createdAt !== createdAt)));
}
