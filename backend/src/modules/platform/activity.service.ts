import { Injectable } from '@nestjs/common';
import { ActivityRepository } from './activity.repository';
import type { ListActivityQueryDto } from './dto/activity.dto';

@Injectable()
export class ActivityService {
  constructor(private readonly activity: ActivityRepository) {}

  async list(query: ListActivityQueryDto) {
    const [page, counts] = await Promise.all([this.activity.list(query), this.activity.counts(query.tenantId)]);
    return { ...page, page: query.page, pageSize: query.pageSize, counts };
  }
}
