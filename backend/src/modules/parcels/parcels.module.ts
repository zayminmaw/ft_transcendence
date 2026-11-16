import { Module } from '@nestjs/common';
import { AuditModule } from '../audit';
import { ParcelsController } from './parcels.controller';
import { ParcelsRepository } from './parcels.repository';
import { ParcelsService } from './parcels.service';

// Parcels from pickup to dispatch: waybills, their status history, and assigning them to a driver's run. Every change
// is audited, which also tells the people viewing parcels to refresh (notifications module).
@Module({
  imports: [AuditModule],
  controllers: [ParcelsController],
  providers: [ParcelsRepository, ParcelsService],
})
export class ParcelsModule {}
