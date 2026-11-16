import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CompanyActivityDay } from './entities/company-activity-day.entity';

// Which members had a company open on which days. Days are UTC dates written as YYYY-MM-DD. Each write is one
// statement, so two tabs or two servers cannot race.
@Injectable()
export class InsightsRepository {
  constructor(@InjectRepository(CompanyActivityDay) private readonly days: Repository<CompanyActivityDay>) {}

  // The member had the company open that day. Creates the row with no visits; changes nothing if it exists.
  async markActive(organizationId: string, userId: string, day: string): Promise<void> {
    await this.days.query(
      'INSERT INTO company_activity_days (organization_id, user_id, day, visits) VALUES (?, ?, ?, 0) ON DUPLICATE KEY UPDATE visits = visits',
      [organizationId, userId, day],
    );
  }

  // The member opened the company again. Creates the row with one visit, or adds one.
  async addVisit(organizationId: string, userId: string, day: string): Promise<void> {
    await this.days.query(
      'INSERT INTO company_activity_days (organization_id, user_id, day, visits) VALUES (?, ?, ?, 1) ON DUPLICATE KEY UPDATE visits = visits + 1',
      [organizationId, userId, day],
    );
  }

  // Deletes every row for a day before `day`, in any company. Returns how many it deleted.
  async purgeBefore(day: string): Promise<number> {
    const result = await this.days
      .createQueryBuilder()
      .delete()
      .where('day < :day', { day })
      .execute();
    return result.affected ?? 0;
  }
}
