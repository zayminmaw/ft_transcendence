import { Module } from '@nestjs/common';
import { AuditModule } from '../audit';
import { AssetsController } from './assets.controller';
import { AssetsRepository } from './assets.repository';
import { AssetsService } from './assets.service';

// Fleet and equipment: assets, who has them (asset_assignments) and their services (asset_maintenance_logs). Every
// change is audited, which also tells the people viewing assets to refresh (notifications module).
@Module({
  imports: [AuditModule],
  controllers: [AssetsController],
  providers: [AssetsRepository, AssetsService],
})
export class AssetsModule {}
