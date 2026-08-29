import AsyncStorage from '@react-native-async-storage/async-storage';

export interface AppSettings {
  showChoiceAfterPhoto: boolean;
  voiceQuestionByDefault: boolean;
  speakAnswers: boolean;
  explainSteps: boolean;
  saveHistory: boolean;
}

export const defaultSettings: AppSettings = {
  showChoiceAfterPhoto: true,
  voiceQuestionByDefault: false,
  speakAnswers: true,
  explainSteps: true,
  saveHistory: true,
};

const key = 'ar-answer-settings-v1';

export async function loadSettings(): Promise<AppSettings> {
  const stored = await AsyncStorage.getItem(key);
  return stored ? { ...defaultSettings, ...(JSON.parse(stored) as Partial<AppSettings>) } : defaultSettings;
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(settings));
}
