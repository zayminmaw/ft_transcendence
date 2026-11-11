import { Module } from '@nestjs/common';
import { AuditModule } from '../audit';
import { RbacModule } from '../rbac';
import { DriversController } from './drivers.controller';
import { DriversRepository } from './drivers.repository';
import { DriversService } from './drivers.service';

// Couriers: an employee with a delivery_drivers row. Rbac decides which field groups a role sees; every change is
// audited, which also tells the people viewing drivers to refresh (notifications module).
@Module({
  imports: [AuditModule, RbacModule],
  controllers: [DriversController],
  providers: [DriversRepository, DriversService],
})
export class DriversModule {}
