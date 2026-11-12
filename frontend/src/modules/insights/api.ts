import { ApiError } from '@services/api-client';

export const RANGES = [7, 30, 90] as const;
export type InsightsRange = (typeof RANGES)[number];
export const DEFAULT_RANGE: InsightsRange = 30;

// What GET /api/activity-insights returns for the open company. Counts only: no names, addresses or changed values.
// Days are UTC dates written as YYYY-MM-DD, the first is the start of the range and the last is today.
export type ActivityInsights = {
	range: InsightsRange;
	from: string;
	to: string;
	// False until the company has any activity on record.
	hasHistory: boolean;
	members: { active: number; total: number };
	visits: number;
	activeByDay: { day: string; members: number }[];
	activeByRole: { roleCode: string; roleName: string; members: number }[];
	// Only the busiest modules are listed, but total counts every module.
	changes: { total: number; byModule: { module: string; count: number }[] };
	security: {
		passwordResets: number;
		accountsSwitchedOff: number;
		roleChanges: number;
		deniedAttempts: number;
	};
};

export function isForbidden(error: unknown): boolean {
	return error instanceof ApiError && error.status === 403;
}
