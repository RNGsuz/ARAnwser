import AsyncStorage from '@react-native-async-storage/async-storage';

export type CodeScrollMode = 'line' | 'smoothSnap' | 'continuous';

export interface AppSettings {
  speakAnswers: boolean;
  explainSteps: boolean;
  saveHistory: boolean;
  codeScrollMode: CodeScrollMode;
}

export const defaultSettings: AppSettings = {
  speakAnswers: true,
  explainSteps: true,
  saveHistory: true,
  codeScrollMode: 'smoothSnap',
};

const key = 'ar-answer-settings-v1';

export async function loadSettings(): Promise<AppSettings> {
  const stored = await AsyncStorage.getItem(key);
  return stored ? { ...defaultSettings, ...(JSON.parse(stored) as Partial<AppSettings>) } : defaultSettings;
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(settings));
}
