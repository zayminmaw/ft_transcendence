import { Injectable, Optional } from '@nestjs/common';
import { SigninsRepository } from './signins.repository';
import type { PlatformSignins, SigninDayCounts, SigninsRange } from './types/signins';

const DAY_MS = 86_400_000;

// Puts the platform's sign-in counts together for one range. The days are UTC dates ending today, and every day is in
// the answer, with zeros where nothing happened, so the page never has gaps to fill.
@Injectable()
export class SigninsService {
  // `now` is only here so a test can fix today.
  constructor(
    private readonly repository: SigninsRepository,
    @Optional() private readonly now: () => Date = () => new Date(),
  ) {}

  async read(range: SigninsRange): Promise<PlatformSignins> {
    const to = this.now().toISOString().slice(0, 10);
    // The range counts today, so 7 days is today and the six before it.
    const from = new Date(Date.parse(`${to}T00:00:00Z`) - (range - 1) * DAY_MS).toISOString().slice(0, 10);
    const rows = await this.repository.countByDay(from, to);
    const byDay = new Map(rows.map((row) => [row.day, row]));

    // Field by field, so a field a repository adds later cannot reach the page without being listed here.
    const days: SigninDayCounts[] = [];
    for (let time = Date.parse(`${from}T00:00:00Z`); time <= Date.parse(`${to}T00:00:00Z`); time += DAY_MS) {
      const day = new Date(time).toISOString().slice(0, 10);
      const row = byDay.get(day);
      days.push({ day, signIns: row?.signIns ?? 0, failedSignIns: row?.failedSignIns ?? 0, sessionReuse: row?.sessionReuse ?? 0 });
    }

    const signIns = days.reduce((sum, entry) => sum + entry.signIns, 0);
    const failedSignIns = days.reduce((sum, entry) => sum + entry.failedSignIns, 0);
    const sessionReuse = days.reduce((sum, entry) => sum + entry.sessionReuse, 0);
    const attempts = signIns + failedSignIns;
    // A percentage to one decimal. No attempts is 0, not a division by zero.
    const failureRate = attempts === 0 ? 0 : Math.round((failedSignIns / attempts) * 1000) / 10;
    return { range, from, to, totals: { signIns, failedSignIns, failureRate, sessionReuse }, days };
  }
}
