import { Logger } from '@nestjs/common';

type Entry = { sockets: Set<string>; timer?: NodeJS.Timeout };

// Who is connected, per company, in memory only (presence is never stored). A person is one entry however many
// sockets they have, so two tabs count as one. When the last socket closes they stay online for a grace period, so a
// reconnect (every socket reconnects when its token expires, about every 15 minutes) never flickers their contacts'
// screens. `onChange` fires only when someone really goes online or offline. A listener that throws or rejects is
// logged and ignored: it must never break the registry, and inside a timer an uncaught error would crash the server.
export class PresenceRegistry {
  private readonly entries = new Map<string, Entry>();
  private readonly logger = new Logger(PresenceRegistry.name);

  constructor(
    private readonly onChange: (organizationId: string, userId: string, online: boolean) => void | Promise<void>,
    private readonly graceMs = 30_000,
  ) {}

  connect(organizationId: string, userId: string, socketId: string): void {
    const key = this.key(organizationId, userId);
    const entry = this.entries.get(key);
    if (!entry) {
      this.entries.set(key, { sockets: new Set([socketId]) });
      this.announce(organizationId, userId, true);
      return;
    }
    // Back inside the grace: still online, so nothing is announced.
    clearTimeout(entry.timer);
    entry.timer = undefined;
    entry.sockets.add(socketId);
  }

  disconnect(organizationId: string, userId: string, socketId: string): void {
    const key = this.key(organizationId, userId);
    const entry = this.entries.get(key);
    if (!entry?.sockets.delete(socketId) || entry.sockets.size > 0) return;
    entry.timer = setTimeout(() => {
      this.entries.delete(key);
      this.announce(organizationId, userId, false);
    }, this.graceMs);
    // A waiting timer must not hold the process open when the server shuts down.
    entry.timer.unref();
  }

  // Still online during the grace period.
  isOnline(organizationId: string, userId: string): boolean {
    return this.entries.has(this.key(organizationId, userId));
  }

  // Forgets everyone and cancels the pending timers, without announcing anything.
  dispose(): void {
    for (const entry of this.entries.values()) clearTimeout(entry.timer);
    this.entries.clear();
  }

  private announce(organizationId: string, userId: string, online: boolean): void {
    const failed = (error: unknown) => this.logger.error(`Presence listener failed: ${error instanceof Error ? error.message : String(error)}`);
    // The async wrapper runs the listener at once and turns a throw or a rejection into the same rejected promise.
    void (async () => this.onChange(organizationId, userId, online))().catch(failed);
  }

  private key(organizationId: string, userId: string): string {
    return `${organizationId}:${userId}`;
  }
}
