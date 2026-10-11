import { Module } from '@nestjs/common';
import { OrganizationMembersRepository } from './organization-members.repository';
import { OrganizationMembersService } from './organization-members.service';

@Module({ providers: [OrganizationMembersRepository, OrganizationMembersService], exports: [OrganizationMembersService] })
export class OrganizationsModule {}
