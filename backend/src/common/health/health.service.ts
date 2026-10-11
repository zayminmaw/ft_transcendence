import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class HealthService {
  constructor(private readonly database: DataSource) {}

  async readiness() {
    try {
      await this.database.query('SELECT 1 FROM organizations LIMIT 1');
      return { status: 'ok', database: 'up' };
    } catch {
      throw new ServiceUnavailableException('The database schema is not ready.');
    }
  }
}
