import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { StorageService } from './storage.service';

// The only storage route: opening a signed link (from StorageService.signedUrl). No login or company header, so an
// <img src> works; the signature and expiry are the whole check.
@Controller('storage/files')
@Public()
export class StorageController {
  constructor(private readonly storage: StorageService) {}

  @Get(':id')
  async signed(
    @Param('id') id: string,
    @Query('exp') exp: unknown,
    @Query('sig') sig: unknown,
    @Res({ passthrough: true }) response: Response,
  ) {
    const { file, secondsLeft } = await this.storage.downloadSigned(id, exp, sig);
    // Replaces the API-wide no-store: this browser may keep the image while the link is valid, but no shared cache.
    response.setHeader('Cache-Control', `private, max-age=${secondsLeft}`);
    return file;
  }
}
