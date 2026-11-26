import { Controller, Get, Query } from '@nestjs/common';
import { PlatformAdmin } from '../../common/decorators/platform-admin.decorator';
import { SigninsQueryDto } from './dto/signins.dto';
import { SigninsService } from './signins.service';
import type { PlatformSignins } from './types/signins';

// Sign-in counts for the whole platform. Platform administrators only, like the tenant routes. Counts only, so the
// platform learns how many people sign in and fail, never who they are or which company they belong to.
@PlatformAdmin()
@Controller('platform/signins')
export class SigninsController {
  constructor(private readonly signins: SigninsService) {}

  @Get()
  read(@Query() query: SigninsQueryDto): Promise<PlatformSignins> {
    return this.signins.read(query.range);
  }
}
