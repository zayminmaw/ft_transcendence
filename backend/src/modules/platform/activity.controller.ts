import { Controller, Get, Query } from '@nestjs/common';
import { PlatformAdmin } from '../../common/decorators/platform-admin.decorator';
import { ActivityService } from './activity.service';
import { ListActivityQueryDto } from './dto/activity.dto';

// The audited tenant management changes. Platform administrators only, like the tenant routes.
@PlatformAdmin()
@Controller('platform/activity')
export class ActivityController {
  constructor(private readonly activity: ActivityService) {}

  @Get()
  list(@Query() query: ListActivityQueryDto) {
    return this.activity.list(query);
  }
}
