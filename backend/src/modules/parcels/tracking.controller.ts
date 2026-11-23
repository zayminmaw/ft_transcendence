import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { ParcelsService } from './parcels.service';
import { TrackingThrottlerGuard } from './tracking.throttler';

// GET /tracking/:trackingNumber, for the public tracking page: no account and no company, only the number on the
// waybill. It answers the status and its times (ParcelTracking), never who the parcel is for.
@Controller('tracking')
@Public()
@UseGuards(TrackingThrottlerGuard)
export class TrackingController {
  constructor(private readonly parcels: ParcelsService) {}

  @Get(':trackingNumber')
  track(@Param('trackingNumber') trackingNumber: string) {
    return this.parcels.track(trackingNumber);
  }
}
