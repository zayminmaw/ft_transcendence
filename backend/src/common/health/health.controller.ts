import { Controller, Get } from '@nestjs/common';
import { Public } from '../decorators/public.decorator';
import { HealthService } from './health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Public()
  @Get()
  liveness() { return { status: 'ok', service: 'transcend-api' }; }

  @Public()
  @Get('ready')
  readiness() { return this.health.readiness(); }
}
