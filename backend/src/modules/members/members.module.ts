import { Module } from '@nestjs/common';
import { AuditModule } from '../audit';
import { AuthModule } from '../auth';
import { NotificationsModule } from '../notifications';
import { UsersModule } from '../users';
import { InviteSignupController } from './invite-signup.controller';
import { InvitesRepository } from './invites.repository';
import { InvitesService } from './invites.service';
import { MembersAuditRepository } from './members-audit.repository';
import { MembersController } from './members.controller';
import { MembersRepository } from './members.repository';
import { MembersService } from './members.service';

// Its own module: it needs users, organizations (through the repository's entities) and rbac, and rbac already
// imports the first two.
@Module({
  imports: [AuthModule, UsersModule, AuditModule, NotificationsModule],
  controllers: [MembersController, InviteSignupController],
  providers: [MembersRepository, MembersAuditRepository, MembersService, InvitesRepository, InvitesService],
})
export class MembersModule {}
