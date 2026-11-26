import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AuditLog } from '../audit';
import type { SigninDayCounts } from './types/signins';

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;

// Aggregate columns come back as strings (bigNumberStrings), so every one goes through this.
const count = (value: unknown): number => Number(value ?? 0);

// Reads the auth rows of audit_logs that are written before anyone has picked a company, so they carry none. Counts
// only: nothing here selects a user, an address or a name.
@Injectable()
export class SigninsRepository {
  constructor(private readonly database: DataSource) {}

  // `from` and `to` are inclusive UTC days (YYYY-MM-DD). The window is explicit UTC bounds, and the connection stores
  // and reads UTC (timezone 'Z'), so DATE_FORMAT gives the UTC day whatever the database session's time zone is.
  // Only days with at least one of the three actions come back, oldest first.
  async countByDay(from: string, to: string): Promise<SigninDayCounts[]> {
    if (!DAY.test(from) || !DAY.test(to) || from > to) throw new Error('A range needs two UTC days, the first not after the second.');
    const start = new Date(`${from}T00:00:00Z`);
    const end = new Date(new Date(`${to}T00:00:00Z`).getTime() + DAY_MS);
    const rows = await this.database
      .getRepository(AuditLog)
      .createQueryBuilder('log')
      .select("DATE_FORMAT(log.occurredAt, '%Y-%m-%d')", 'day')
      .addSelect("SUM(log.action = 'login')", 'signIns')
      .addSelect("SUM(log.action = 'login_failed')", 'failedSignIns')
      .addSelect("SUM(log.action = 'session_reuse')", 'sessionReuse')
      .where("log.module = 'auth'")
      .andWhere("log.action IN ('login', 'login_failed', 'session_reuse')")
      .andWhere('log.occurredAt >= :start AND log.occurredAt < :end', { start, end })
      .groupBy('day')
      .orderBy('day')
      .getRawMany<{ day: string; signIns: string; failedSignIns: string; sessionReuse: string }>();
    return rows.map((row) => ({
      day: row.day,
      signIns: count(row.signIns),
      failedSignIns: count(row.failedSignIns),
      sessionReuse: count(row.sessionReuse),
    }));
  }
}
