import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { requestMeta } from '../../common/context/request-meta';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import type { AuthenticatedRequest } from '../../common/types/authenticated-request';
import { type ClientsActor, ClientsService } from './clients.service';
import { CreateClientDto, ListClientsQueryDto, UpdateClientDto } from './dto/client.dto';

const actor = (request: AuthenticatedRequest): ClientsActor => ({
  tenant: request.tenant!,
  userId: request.user!.id,
  meta: requestMeta(request),
});

// The merchants of the company named by X-Organization-Id (checked by RolesGuard). Reading needs clients.view; each
// change has its own permission, which replaces it.
@Controller('clients')
@RequirePermission('clients.view')
export class ClientsController {
  constructor(private readonly clients: ClientsService) {}

  @Get()
  list(@Query() query: ListClientsQueryDto, @Req() request: AuthenticatedRequest) {
    return this.clients.list(request.tenant!, query);
  }

  @Get(':clientId')
  get(@Param('clientId') id: string, @Req() request: AuthenticatedRequest) {
    return this.clients.get(request.tenant!, id);
  }

  @Post()
  @RequirePermission('clients.create')
  create(@Body() body: CreateClientDto, @Req() request: AuthenticatedRequest) {
    return this.clients.create(actor(request), body);
  }

  @Patch(':clientId')
  @RequirePermission('clients.edit')
  update(@Param('clientId') id: string, @Body() body: UpdateClientDto, @Req() request: AuthenticatedRequest) {
    return this.clients.update(actor(request), id, body);
  }

  @Post(':clientId/archive')
  @HttpCode(200)
  @RequirePermission('clients.delete')
  archive(@Param('clientId') id: string, @Req() request: AuthenticatedRequest) {
    return this.clients.setActive(actor(request), id, false);
  }

  @Post(':clientId/reactivate')
  @HttpCode(200)
  @RequirePermission('clients.delete')
  reactivate(@Param('clientId') id: string, @Req() request: AuthenticatedRequest) {
    return this.clients.setActive(actor(request), id, true);
  }
}
