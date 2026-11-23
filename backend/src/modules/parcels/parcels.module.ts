import { Module } from '@nestjs/common';
import { AuditModule } from '../audit';
import { BillingModule } from '../billing';
import { ParcelsController } from './parcels.controller';
import { ParcelsRepository } from './parcels.repository';
import { ParcelsService } from './parcels.service';

// Parcels from pickup to dispatch: waybills, their status history, and assigning them to a driver's run. Every change
// is audited, which also tells the people viewing parcels to refresh (notifications module). Sending a parcel out with
// cash to collect, and taking it back, also move the merchant's pending COD (billing module).
@Module({
  imports: [AuditModule, BillingModule],
  controllers: [ParcelsController],
  providers: [ParcelsRepository, ParcelsService],
})
export class ParcelsModule {}
