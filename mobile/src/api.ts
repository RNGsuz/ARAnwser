import type { AssistantMode, DocumentAnswer, VisualMode, VisualModeClassification } from './types';

function normalizeBaseUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const withProtocol = /^https?:\/\//i.test(value) ? value : `http://${value}`;
  return withProtocol.replace(/\/$/, '');
}

const baseUrl = normalizeBaseUrl(process.env.EXPO_PUBLIC_API_BASE_URL);
const token = process.env.EXPO_PUBLIC_CLIENT_TOKEN ?? '';
const requestTimeoutMs = 25_000;
const answerTimeoutMs = 60_000;

function headers(json = false): Record<string, string> {
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(json ? { 'Content-Type': 'application/json' } : {}),
  };
}

async function readResponse<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => ({}));
  if (response.ok) return body as T;
  const messages: Record<string, string> = {
    daily_limit_reached: 'Das tägliche Testlimit ist erreicht.',
    session_expired: 'Das Foto ist abgelaufen. Bitte fotografiere es erneut.',
    ai_service_unavailable: 'Der KI-Dienst ist gerade nicht erreichbar.',
    ai_response_incomplete: 'Die KI-Antwort war zu lang und wurde abgeschnitten. Bitte versuche es erneut oder frage nach einem kleineren Ausschnitt.',
    ai_response_invalid: 'Die KI-Antwort hatte ein ungültiges Format. Bitte versuche es erneut.',
    unauthorized: 'Client-Token und Backend-Konfiguration stimmen nicht überein.',
    valid_image_required: 'Das Foto konnte nicht gelesen werden. Bitte nimm es erneut auf.',
    image_too_large: 'Das Foto ist zu groß. Bitte nimm es erneut auf.',
    audio_too_large: 'Die Sprachaufnahme ist zu lang. Bitte stelle die Frage kürzer.',
    invalid_follow_up: 'Die Folgefrage war leer oder ungültig.',
    question_or_audio_required: 'Es wurde keine Frage erkannt.',
    audio_required: 'Es wurde keine Sprachaufnahme übertragen.',
    speech_not_recognized: 'Die Sprache wurde nicht sicher erkannt. Bitte sprich die Frage erneut.',
    invalid_question: 'Die Frage war leer oder ungültig.',
    invalid_classified_answer: 'Der erkannte Modus konnte nicht gestartet werden.',
  };
  const serverDetail = typeof body.error === 'string' && body.error.length <= 500 ? body.error : null;
  throw new Error(messages[body.error] ?? serverDetail ?? `Anfrage fehlgeschlagen (${response.status}).`);
}

export async function classifyImage(imageUri: string, sessionId: string): Promise<VisualModeClassification> {
  if (!baseUrl) throw new Error('EXPO_PUBLIC_API_BASE_URL fehlt in mobile/.env.');
  const form = new FormData();
  form.append('image', { uri: imageUri, name: 'automatic.jpg', type: 'image/jpeg' } as unknown as Blob);
  form.append('sessionId', sessionId);
  form.append('locale', 'de-DE');
  const response = await request(`${baseUrl}/v1/classifications`, { method: 'POST', headers: headers(), body: form }, answerTimeoutMs);
  return readResponse(response);
}

export async function createClassifiedQuery(
  sessionId: string,
  intent: VisualMode,
  question: string,
  includeSteps = true,
): Promise<DocumentAnswer> {
  if (!baseUrl) throw new Error('EXPO_PUBLIC_API_BASE_URL fehlt in mobile/.env.');
  const response = await request(`${baseUrl}/v1/classifications/${encodeURIComponent(sessionId)}/answer`, {
    method: 'POST', headers: headers(true), body: JSON.stringify({ intent, question, includeSteps, locale: 'de-DE' }),
  }, answerTimeoutMs);
  return readResponse(response);
}

export async function transcribeAudio(audioUri: string): Promise<string> {
  if (!baseUrl) throw new Error('EXPO_PUBLIC_API_BASE_URL fehlt in mobile/.env.');
  const form = new FormData();
  form.append('audio', { uri: audioUri, name: 'question.m4a', type: 'audio/mp4' } as unknown as Blob);
  const response = await request(`${baseUrl}/v1/transcriptions`, { method: 'POST', headers: headers(), body: form });
  const result = await readResponse<{ transcript: string }>(response);
  return result.transcript;
}

async function request(url: string, init: RequestInit, timeoutMs = requestTimeoutMs): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (cause) {
    if (cause instanceof Error && cause.name === 'AbortError') {
      throw new Error('Die Anfrage hat zu lange gedauert. Bitte versuche es erneut.');
    }
    throw new Error('Keine Verbindung zum Backend. Prüfe WLAN und Server und versuche es erneut.');
  } finally {
    clearTimeout(timeout);
  }
}

export async function createQuery(
  imageUri: string,
  sessionId: string,
  options: { audioUri?: string; question?: string; includeSteps?: boolean; intent?: Exclude<AssistantMode, 'question'> },
): Promise<DocumentAnswer> {
  if (!baseUrl) throw new Error('EXPO_PUBLIC_API_BASE_URL fehlt in mobile/.env.');
  const form = new FormData();
  form.append('image', { uri: imageUri, name: 'document.jpg', type: 'image/jpeg' } as unknown as Blob);
  if (options.audioUri) {
    form.append('audio', { uri: options.audioUri, name: 'question.m4a', type: 'audio/mp4' } as unknown as Blob);
  }
  if (options.question) form.append('question', options.question);
  form.append('sessionId', sessionId);
  form.append('locale', 'de-DE');
  form.append('includeSteps', String(options.includeSteps ?? true));
  form.append('intent', options.intent ?? 'solve');
  const response = await request(`${baseUrl}/v1/queries`, { method: 'POST', headers: headers(), body: form }, answerTimeoutMs);
  return readResponse(response);
}

export async function createFollowUp(sessionId: string, question: string, includeSteps = true): Promise<DocumentAnswer> {
  if (!baseUrl) throw new Error('EXPO_PUBLIC_API_BASE_URL fehlt in mobile/.env.');
  const response = await request(`${baseUrl}/v1/queries/${encodeURIComponent(sessionId)}/follow-ups`, {
    method: 'POST',
    headers: headers(true),
    body: JSON.stringify({ question, locale: 'de-DE', includeSteps }),
  }, answerTimeoutMs);
  return readResponse(response);
}

export async function createGeneralQuestion(sessionId: string, question: string, includeSteps = true): Promise<DocumentAnswer> {
  if (!baseUrl) throw new Error('EXPO_PUBLIC_API_BASE_URL fehlt in mobile/.env.');
  const response = await request(`${baseUrl}/v1/questions`, {
    method: 'POST',
    headers: headers(true),
    body: JSON.stringify({ question, sessionId, locale: 'de-DE', includeSteps }),
  }, answerTimeoutMs);
  return readResponse(response);
}

export async function createVoiceFollowUp(sessionId: string, audioUri: string, includeSteps = true): Promise<DocumentAnswer> {
  if (!baseUrl) throw new Error('EXPO_PUBLIC_API_BASE_URL fehlt in mobile/.env.');
  const form = new FormData();
  form.append('audio', { uri: audioUri, name: 'follow-up.m4a', type: 'audio/mp4' } as unknown as Blob);
  form.append('locale', 'de-DE');
  form.append('includeSteps', String(includeSteps));
  const response = await request(`${baseUrl}/v1/queries/${encodeURIComponent(sessionId)}/follow-ups`, {
    method: 'POST', headers: headers(), body: form,
  }, answerTimeoutMs);
  return readResponse(response);
}

export async function deleteSession(sessionId: string): Promise<void> {
  if (!baseUrl) return;
  await request(`${baseUrl}/v1/sessions/${encodeURIComponent(sessionId)}`, { method: 'DELETE', headers: headers() });
}
