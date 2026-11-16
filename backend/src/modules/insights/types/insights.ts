export type InsightsRange = 7 | 30 | 90;

// What the dashboard shows for one company. Counts only: it never holds a name, an id of a person, an address or a
// changed value.
export interface ActivityInsights {
  range: InsightsRange;
  // YYYY-MM-DD, UTC. `from` is the first day of the range and `to` is today.
  from: string;
  to: string;
  // False until any activity row exists for the company.
  hasHistory: boolean;
  members: { active: number; total: number };
  visits: number;
  // One entry for every day in the range, zeros included.
  activeByDay: { day: string; members: number }[];
  activeByRole: { roleCode: string; roleName: string; members: number }[];
  // The busiest six modules, but `total` counts every module.
  changes: { total: number; byModule: { module: string; count: number }[] };
  security: { passwordResets: number; accountsSwitchedOff: number; roleChanges: number; deniedAttempts: number };
}

export type ActivityCounts = Pick<ActivityInsights, 'hasHistory' | 'members' | 'visits' | 'activeByDay' | 'activeByRole'>;
export type ChangeCounts = Pick<ActivityInsights, 'changes' | 'security'>;
