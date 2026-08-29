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
    this.sessions.set(id, { ...input, image: Buffer.from(input.image), expiresAt: Date.now() + this.ttlMs });
  }

  get(id: string): QueryInput | undefined {
    const session = this.sessions.get(id);
    if (!session || session.expiresAt <= Date.now()) {
      this.delete(id);
      return undefined;
    }
    session.expiresAt = Date.now() + this.ttlMs;
    return session;
  }

  delete(id: string): boolean {
    const session = this.sessions.get(id);
    if (session) session.image.fill(0);
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

