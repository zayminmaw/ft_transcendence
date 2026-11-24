import { Module } from '@nestjs/common';
import { AuditModule } from '../audit';
import { BillingModule } from '../billing';
import { StorageModule } from '../storage';
import { RbacModule } from '../rbac';
import { OrganizationsModule } from '../organizations';
import { ParcelAccessGuard } from './parcel-access.guard';
import { ParcelsController } from './parcels.controller';
import { ParcelsRepository } from './parcels.repository';
import { ParcelsService } from './parcels.service';
import { TrackingController } from './tracking.controller';
import { TrackingThrottlerGuard } from './tracking.throttler';

// Parcels from pickup to dispatch: waybills, their status history, and assigning them to a driver's run. Every change
// is audited, which also tells the people viewing parcels to refresh (notifications module). Sending a parcel out with
// cash to collect, and taking it back, also move the merchant's pending COD (billing module). Proof of delivery keeps
// its files in storage; anyone with a waybill can follow its public status (TrackingController).
@Module({
  imports: [AuditModule, BillingModule, StorageModule, RbacModule, OrganizationsModule],
  controllers: [ParcelsController, TrackingController],
  providers: [ParcelsRepository, ParcelsService, TrackingThrottlerGuard, ParcelAccessGuard],
})
export class ParcelsModule {}
