import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrganizationMember } from './entities/organization-member.entity';
import { OrganizationMembersRepository } from './organization-members.repository';
import { OrganizationMembersService } from './organization-members.service';

@Module({
  imports: [TypeOrmModule.forFeature([OrganizationMember])],
  providers: [OrganizationMembersRepository, OrganizationMembersService],
  exports: [OrganizationMembersService],
})
export class OrganizationsModule {}
