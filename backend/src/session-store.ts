import type { QueryInput } from "./types.js";

interface Session extends QueryInput {
  expiresAt: number;
}

export class SessionStore {
  private readonly sessions = new Map<string, Session>();
  private readonly timer: NodeJS.Timeout;

  constructor(private readonly ttlMs: number) {
    this.timer = setInterval(() => this.sweep(), Math.min(ttlMs, 30_000));
    this.timer.unref();
  }

  set(id: string, input: QueryInput): void {
    this.delete(id);
    this.sessions.set(id, {
      ...input,
      ...(input.image ? { image: Buffer.from(input.image) } : {}),
      expiresAt: Date.now() + this.ttlMs,
    });
  }

  get(id: string): QueryInput | undefined {
    const session = this.sessions.get(id);
    if (!session || session.expiresAt <= Date.now()) {
      this.delete(id);
      return undefined;
    }
    session.expiresAt = Date.now() + this.ttlMs;
    return {
      ...(session.image ? { image: session.image } : {}),
      ...(session.imageMimeType ? { imageMimeType: session.imageMimeType } : {}),
      ...(session.ocrText ? { ocrText: session.ocrText } : {}),
      ...(session.previousQuestion ? { previousQuestion: session.previousQuestion } : {}),
      ...(session.previousAnswer ? { previousAnswer: session.previousAnswer } : {}),
      ...(session.includeSteps !== undefined ? { includeSteps: session.includeSteps } : {}),
      ...(session.intent ? { intent: session.intent } : {}),
      question: session.question,
      locale: session.locale,
    };
  }

  delete(id: string): boolean {
    const session = this.sessions.get(id);
    if (session?.image) session.image.fill(0);
    return this.sessions.delete(id);
  }

  close(): void {
    clearInterval(this.timer);
    for (const id of this.sessions.keys()) this.delete(id);
  }

  private sweep(): void {
    const now = Date.now();
    for (const [id, session] of this.sessions) {
      if (session.expiresAt <= now) this.delete(id);
    }
  }
}
