import { Inject, Injectable, Optional } from '@nestjs/common';
import { ACTIVITY_NOW } from './activity-recorder';
import { InsightsRepository } from './insights.repository';
import type { ActivityInsights, InsightsRange } from './types/insights';

const DAY_MS = 86_400_000;

// Puts a company's activity and change counts together for one range. The company comes from the verified
// membership, and the days are UTC dates ending today.
@Injectable()
export class InsightsService {
  constructor(
    private readonly repository: InsightsRepository,
    @Optional() @Inject(ACTIVITY_NOW) private readonly now: () => Date = () => new Date(),
  ) {}

  async read(organizationId: string, range: InsightsRange): Promise<ActivityInsights> {
    const today = this.now();
    const to = today.toISOString().slice(0, 10);
    // The range counts today, so 7 days is today and the six before it.
    const from = new Date(Date.parse(`${to}T00:00:00Z`) - (range - 1) * DAY_MS).toISOString().slice(0, 10);
    const [activity, changes] = await Promise.all([
      this.repository.activity(organizationId, from, to),
      this.repository.changes(organizationId, from, to),
    ]);
    // Field by field, so a field a repository adds later cannot reach the page without being listed here.
    return {
      range,
      from,
      to,
      hasHistory: activity.hasHistory,
      members: activity.members,
      visits: activity.visits,
      activeByDay: activity.activeByDay,
      activeByRole: activity.activeByRole,
      changes: changes.changes,
      security: changes.security,
    };
  }
}
