export type SigninsRange = 7 | 30 | 90;

// One UTC day of sign-in counts, `day` as YYYY-MM-DD.
export interface SigninDayCounts {
  day: string;
  signIns: number;
  failedSignIns: number;
  sessionReuse: number;
}

// What the platform Sign-ins page shows. Counts only: it never holds a name, an id of a person, an address or a company.
export interface PlatformSignins {
  range: SigninsRange;
  // YYYY-MM-DD, UTC. `from` is the first day of the range and `to` is today.
  from: string;
  to: string;
  totals: { signIns: number; failedSignIns: number; failureRate: number; sessionReuse: number };
  // One entry for every day in the range, zeros included.
  days: SigninDayCounts[];
}
