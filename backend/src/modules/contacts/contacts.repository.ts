import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { type EntityManager, In, type SelectQueryBuilder, Repository } from 'typeorm';
import { OrganizationMember } from '../organizations/entities/organization-member.entity';
import { Role } from '../rbac/entities/role.entity';
import { User } from '../users/entities/user.entity';
import { Contact } from './entities/contact.entity';

// One person of a company as the contacts list shows them. The two flags feed the Suspended status.
export type ContactRow = {
  userId: string;
  username: string;
  displayName: string | null;
  role: { code: string; name: string };
  accountActive: boolean;
  memberActive: boolean;
};

type RawRow = {
  userId: string | number;
  username: string;
  displayName: string | null;
  roleCode: string;
  roleName: string;
  accountActive: number | boolean;
  memberActive: number | boolean;
};

const toRow = (row: RawRow): ContactRow => ({
  userId: String(row.userId),
  username: row.username,
  displayName: row.displayName,
  role: { code: row.roleCode, name: row.roleName },
  accountActive: Boolean(row.accountActive),
  memberActive: Boolean(row.memberActive),
});

// What every people query selects, from the membership `m` it joins to its account `u` and role `r`, by role then name.
const selectPeople = <T extends object>(query: SelectQueryBuilder<T>): SelectQueryBuilder<T> =>
  query
    .select('u.id', 'userId')
    .addSelect('u.username', 'username')
    .addSelect('u.displayName', 'displayName')
    .addSelect('r.code', 'roleCode')
    .addSelect('r.name', 'roleName')
    .addSelect('u.isActive', 'accountActive')
    .addSelect('m.isActive', 'memberActive')
    .orderBy('r.name', 'ASC')
    .addOrderBy('u.username', 'ASC');

const isDuplicate = (error: unknown): boolean => {
  const failure = error as { code?: string; errno?: number; driverError?: { code?: string; errno?: number } };
  const driver = failure.driverError ?? failure;
  return driver.errno === 1062 || driver.code === 'ER_DUP_ENTRY';
};

// Callers pass user ids; the table holds membership ids, so every query resolves them inside the company given.
@Injectable()
export class ContactsRepository {
  constructor(@InjectRepository(Contact) private readonly contacts: Repository<Contact>) {}

  // The owner's saved contacts in this company, by role name then username.
  async list(organizationId: string, ownerUserId: string): Promise<ContactRow[]> {
    const query = this.contacts
      .createQueryBuilder('c')
      .innerJoin(OrganizationMember, 'o', 'o.id = c.ownerMemberId')
      .innerJoin(OrganizationMember, 'm', 'm.id = c.contactMemberId')
      .innerJoin(User, 'u', 'u.id = m.userId')
      .innerJoin(Role, 'r', 'r.id = m.roleId')
      .where('c.organizationId = :organizationId AND o.userId = :ownerUserId', { organizationId, ownerUserId });
    return (await selectPeople(query).getRawMany<RawRow>()).map(toRow);
  }

  // Who the owner could still add: active members (account and membership), not themselves, not already saved.
  async candidates(organizationId: string, ownerUserId: string): Promise<ContactRow[]> {
    const query = this.members()
      .where('m.organizationId = :organizationId', { organizationId })
      .andWhere('m.isActive = true AND u.isActive = true AND m.userId <> :ownerUserId', { ownerUserId })
      .andWhere((outer) => {
        const saved = outer
          .subQuery()
          .select('1')
          .from(Contact, 'c')
          .innerJoin(OrganizationMember, 'o', 'o.id = c.ownerMemberId')
          .where('c.contactMemberId = m.id AND o.userId = :ownerUserId')
          .getQuery();
        return `NOT EXISTS ${saved}`;
      });
    return (await selectPeople(query).getRawMany<RawRow>()).map(toRow);
  }

  // Anyone with a membership row in the company, active or not; null for someone from elsewhere.
  async findMember(organizationId: string, userId: string): Promise<ContactRow | null> {
    const query = this.members().where('m.organizationId = :organizationId AND m.userId = :userId', { organizationId, userId });
    const row = await selectPeople(query).getRawOne<RawRow>();
    return row ? toRow(row) : null;
  }

  // One transaction with `alsoSave` (the audit row). false when the pair is already saved, or either person has no
  // membership in the company; `alsoSave` has not run then.
  async add(
    organizationId: string,
    ownerUserId: string,
    contactUserId: string,
    alsoSave: (manager: EntityManager) => Promise<void>,
  ): Promise<boolean> {
    return this.contacts.manager.transaction(async (manager) => {
      const pair = await this.memberIds(manager, organizationId, ownerUserId, contactUserId);
      if (!pair) return false;
      try {
        await manager.insert(Contact, { organizationId, ...pair });
      } catch (error) {
        if (isDuplicate(error)) return false;
        throw error;
      }
      await alsoSave(manager);
      return true;
    });
  }

  // false when there was nothing to remove; `alsoSave` has not run then.
  async remove(
    organizationId: string,
    ownerUserId: string,
    contactUserId: string,
    alsoSave: (manager: EntityManager) => Promise<void>,
  ): Promise<boolean> {
    return this.contacts.manager.transaction(async (manager) => {
      const pair = await this.memberIds(manager, organizationId, ownerUserId, contactUserId);
      if (!pair) return false;
      const result = await manager.delete(Contact, { organizationId, ...pair });
      if (!result.affected) return false;
      await alsoSave(manager);
      return true;
    });
  }

  // The active owners in this company who saved this person: the ones who must hear about their status.
  async viewersOf(organizationId: string, contactUserId: string): Promise<string[]> {
    const rows = await this.contacts
      .createQueryBuilder('c')
      .innerJoin(OrganizationMember, 'o', 'o.id = c.ownerMemberId')
      .innerJoin(OrganizationMember, 't', 't.id = c.contactMemberId')
      .innerJoin(User, 'u', 'u.id = o.userId')
      .select('o.userId', 'userId')
      .where('c.organizationId = :organizationId AND t.userId = :contactUserId', { organizationId, contactUserId })
      .andWhere('o.isActive = true AND u.isActive = true')
      .getRawMany<{ userId: string | number }>();
    return rows.map((row) => String(row.userId));
  }

  // The people queries all start from a membership `m`, its account `u` and its role `r`.
  private members(): SelectQueryBuilder<OrganizationMember> {
    return this.contacts.manager
      .createQueryBuilder(OrganizationMember, 'm')
      .innerJoin(User, 'u', 'u.id = m.userId')
      .innerJoin(Role, 'r', 'r.id = m.roleId');
  }

  // The two membership ids of one company, or null when either person is not in it.
  private async memberIds(
    manager: EntityManager,
    organizationId: string,
    ownerUserId: string,
    contactUserId: string,
  ): Promise<{ ownerMemberId: string; contactMemberId: string } | null> {
    const found = await manager.find(OrganizationMember, { where: { organizationId, userId: In([ownerUserId, contactUserId]) } });
    const owner = found.find((member) => member.userId === ownerUserId);
    const contact = found.find((member) => member.userId === contactUserId);
    return owner && contact ? { ownerMemberId: owner.id, contactMemberId: contact.id } : null;
  }
}
