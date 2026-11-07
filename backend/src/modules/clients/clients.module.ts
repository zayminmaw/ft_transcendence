import { Module } from '@nestjs/common';
import { AuditModule } from '../audit';
import { RbacModule } from '../rbac';
import { ClientsController } from './clients.controller';
import { ClientsRepository } from './clients.repository';
import { ClientsService } from './clients.service';

// Merchant accounts. Rbac decides who sees the financial fields; every change is audited, which also tells the
// people viewing clients to refresh (notifications module).
@Module({
  imports: [AuditModule, RbacModule],
  controllers: [ClientsController],
  providers: [ClientsRepository, ClientsService],
})
export class ClientsModule {}
