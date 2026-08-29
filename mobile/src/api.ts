import type { DocumentAnswer } from './types';

function normalizeBaseUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const withProtocol = /^https?:\/\//i.test(value) ? value : `http://${value}`;
  return withProtocol.replace(/\/$/, '');
}

const baseUrl = normalizeBaseUrl(process.env.EXPO_PUBLIC_API_BASE_URL);
const token = process.env.EXPO_PUBLIC_CLIENT_TOKEN ?? '';

function headers(json = false): Record<string, string> {
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(json ? { 'Content-Type': 'application/json' } : {}),
  };
}

async function readResponse(response: Response): Promise<DocumentAnswer> {
  const body = await response.json().catch(() => ({}));
  if (response.ok) return body as DocumentAnswer;
  const messages: Record<string, string> = {
    daily_limit_reached: 'Das tägliche Testlimit ist erreicht.',
    session_expired: 'Das Foto ist abgelaufen. Bitte fotografiere es erneut.',
    ai_service_unavailable: 'Der KI-Dienst ist gerade nicht erreichbar.',
    unauthorized: 'Client-Token und Backend-Konfiguration stimmen nicht überein.',
  };
  const serverDetail = typeof body.error === 'string' && body.error.length <= 500 ? body.error : null;
  throw new Error(messages[body.error] ?? serverDetail ?? `Anfrage fehlgeschlagen (${response.status}).`);
}

export async function createQuery(
  imageUri: string,
  sessionId: string,
  options: { audioUri?: string; question?: string },
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
  const response = await fetch(`${baseUrl}/v1/queries`, { method: 'POST', headers: headers(), body: form });
  return readResponse(response);
}

export async function createFollowUp(sessionId: string, question: string): Promise<DocumentAnswer> {
  if (!baseUrl) throw new Error('EXPO_PUBLIC_API_BASE_URL fehlt in mobile/.env.');
  const response = await fetch(`${baseUrl}/v1/queries/${encodeURIComponent(sessionId)}/follow-ups`, {
    method: 'POST',
    headers: headers(true),
    body: JSON.stringify({ question, locale: 'de-DE' }),
  });
  return readResponse(response);
}

export async function deleteSession(sessionId: string): Promise<void> {
  if (!baseUrl) return;
  await fetch(`${baseUrl}/v1/sessions/${encodeURIComponent(sessionId)}`, { method: 'DELETE', headers: headers() });
}
