import { Module } from '@nestjs/common';
import { StorageController } from './storage.controller';
import { StorageRepository } from './storage.repository';
import { StorageService } from './storage.service';

// Modules that own uploads import this and use StorageService. Its only route opens signed links.
@Module({
  controllers: [StorageController],
  providers: [StorageRepository, StorageService],
  exports: [StorageService],
})
export class StorageModule {}
