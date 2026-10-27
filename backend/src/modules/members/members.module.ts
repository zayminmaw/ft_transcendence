import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLog } from '../audit';
import { AuthModule } from '../auth';
import { UsersModule } from '../users';
import { MembersAuditRepository } from './members-audit.repository';
import { MembersController } from './members.controller';
import { MembersRepository } from './members.repository';
import { MembersService } from './members.service';

// Its own module: it needs users, organizations (through the repository's entities) and rbac, and rbac already
// imports the first two.
@Module({
  imports: [AuthModule, UsersModule, TypeOrmModule.forFeature([AuditLog])],
  controllers: [MembersController],
  providers: [MembersRepository, MembersAuditRepository, MembersService],
})
export class MembersModule {}
