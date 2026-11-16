import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { InsightsRepository } from './insights.repository';

// A test swaps in a clock to cross UTC midnight.
export const ACTIVITY_NOW = Symbol('ACTIVITY_NOW');

// Rows older than this many days are deleted.
export const ACTIVITY_RETENTION_DAYS = 90;

const DAY_MS = 86_400_000;

// Writes the activity rows when a member connects. It must never get in the way of the connection, so every failure is
// logged and swallowed. Days are UTC dates (YYYY-MM-DD).
@Injectable()
export class ActivityRecorder {
  private readonly logger = new Logger(ActivityRecorder.name);
  // Who has already been written today, so a reconnect does not write again. Emptied when the UTC day changes.
  private seenDay?: string;
  private readonly seen = new Set<string>();

  constructor(
    private readonly repository: InsightsRepository,
    @Optional() @Inject(ACTIVITY_NOW) private readonly now: () => Date = () => new Date(),
  ) {}

  // The member connected to the company today. One write per member, company and UTC day for this process. The first
  // call of a new day also deletes rows past the retention.
  async markActive(organizationId: string, userId: string): Promise<void> {
    const today = this.today();
    const newDay = this.seenDay !== today;
    if (newDay) {
      this.seenDay = today;
      this.seen.clear();
    }
    const key = `${organizationId}:${userId}`;
    if (this.seen.has(key)) return;
    // Added before the write, so two sockets connecting together make one write.
    this.seen.add(key);
    try {
      await this.repository.markActive(organizationId, userId, today);
    } catch (error) {
      // Allow a retry on the next connect.
      this.seen.delete(key);
      this.warn('Recording activity failed', error);
    }
    if (newDay) await this.purge(today);
  }

  // The member came online in the company (a real offline to online change, not a reconnect inside the grace).
  async recordVisit(organizationId: string, userId: string): Promise<void> {
    try {
      await this.repository.addVisit(organizationId, userId, this.today());
    } catch (error) {
      this.warn('Recording a visit failed', error);
    }
  }

  private async purge(today: string): Promise<void> {
    const cutoff = new Date(Date.parse(`${today}T00:00:00Z`) - ACTIVITY_RETENTION_DAYS * DAY_MS).toISOString().slice(0, 10);
    try {
      await this.repository.purgeBefore(cutoff);
    } catch (error) {
      this.warn('Deleting old activity failed', error);
    }
  }

  private today(): string {
    return this.now().toISOString().slice(0, 10);
  }

  private warn(message: string, error: unknown): void {
    this.logger.warn(`${message}: ${error instanceof Error ? error.message : 'unknown error'}`);
  }
}
