import { Body, Controller, Delete, Get, HttpCode, Param, Post, Req } from '@nestjs/common';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import type { AuthenticatedRequest } from '../../common/types/authenticated-request';
import { requestMeta } from '../auth';
import { ContactsService } from './contacts.service';
import { AddContactDto } from './dto/add-contact.dto';

// Every route needs contacts.manage_own in the company named by X-Organization-Id (checked by RolesGuard). The list is
// always the caller's own.
@Controller('contacts')
@RequirePermission('contacts.manage_own')
export class ContactsController {
  constructor(private readonly contacts: ContactsService) {}

  @Get()
  list(@Req() request: AuthenticatedRequest) {
    return this.contacts.list(request.tenant!, request.user!.id);
  }

  @Get('candidates')
  candidates(@Req() request: AuthenticatedRequest) {
    return this.contacts.candidates(request.tenant!, request.user!.id);
  }

  @Post()
  add(@Body() body: AddContactDto, @Req() request: AuthenticatedRequest) {
    return this.contacts.add(request.tenant!, request.user!.id, body.userId, requestMeta(request));
  }

  @Delete(':userId')
  @HttpCode(204)
  async remove(@Param('userId') userId: string, @Req() request: AuthenticatedRequest) {
    await this.contacts.remove(request.tenant!, request.user!.id, userId, requestMeta(request));
  }
}
