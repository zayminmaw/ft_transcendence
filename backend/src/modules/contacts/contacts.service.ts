import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { TenantContext } from '../../common/types/authenticated-request';
import { AuditService } from '../audit';
import type { RequestMeta } from '../auth';
import { canAdd } from './contact-rules';
import { type ContactRow, ContactsRepository } from './contacts.repository';

export type ContactStatus = 'online' | 'offline' | 'suspended';
export type PublicContact = {
  userId: string;
  username: string;
  displayName: string | null;
  role: { code: string; name: string };
  status: ContactStatus;
};

// One neutral answer for a person outside the company, a suspended one or a disallowed pairing, so it never reveals
// whether the person exists in another company.
const NOT_ELIGIBLE = { message: "You can't add this person as a contact.", code: 'CONTACT_NOT_ELIGIBLE' };
const SELF = { message: "You can't add yourself as a contact.", code: 'CONTACT_SELF' };
const EXISTS = { message: 'This person is already in your contacts.', code: 'CONTACT_EXISTS' };
const NOT_FOUND = { message: "This person isn't in your contacts.", code: 'CONTACT_NOT_FOUND' };

// Suspended (the account or the membership is off) wins over any connection; otherwise it is the live connection.
export function contactStatus(row: ContactRow, online: boolean): ContactStatus {
  if (!row.accountActive || !row.memberActive) return 'suspended';
  return online ? 'online' : 'offline';
}

const publicContact = (row: ContactRow, online: boolean): PublicContact => ({
  userId: row.userId,
  username: row.username,
  displayName: row.displayName,
  role: row.role,
  status: contactStatus(row, online),
});

// Your own contacts in the company of the request. The company and the person always come from the verified tenant
// context and token, never from the request body. Presence arrives later; until then nobody is online.
@Injectable()
export class ContactsService {
  constructor(
    private readonly contacts: ContactsRepository,
    private readonly audit: AuditService,
  ) {}

  async list(tenant: TenantContext, userId: string): Promise<PublicContact[]> {
    return (await this.contacts.list(tenant.organizationId, userId)).map((row) => publicContact(row, false));
  }

  // Who you could add: the role rules applied to the active, not yet saved colleagues.
  async candidates(tenant: TenantContext, userId: string): Promise<PublicContact[]> {
    const me = await this.contacts.findMember(tenant.organizationId, userId);
    if (!me) return [];
    const rows = await this.contacts.candidates(tenant.organizationId, userId);
    return rows.filter((row) => canAdd(me.role.code, row.role.code)).map((row) => publicContact(row, false));
  }

  // Checked again here, not only when the list was shown: roles and suspensions change in between.
  async add(tenant: TenantContext, userId: string, targetUserId: string, meta: RequestMeta): Promise<PublicContact> {
    if (targetUserId === userId) throw new BadRequestException(SELF);
    const [me, target] = await Promise.all([
      this.contacts.findMember(tenant.organizationId, userId),
      this.contacts.findMember(tenant.organizationId, targetUserId),
    ]);
    const active = (row: ContactRow | null): row is ContactRow => !!row && row.accountActive && row.memberActive;
    if (!active(me) || !active(target) || !canAdd(me.role.code, target.role.code)) throw new ForbiddenException(NOT_ELIGIBLE);
    const saved = await this.contacts.add(tenant.organizationId, userId, targetUserId, (manager) =>
      this.audit.record(manager, {
        module: 'contacts',
        action: 'create',
        resourceType: 'contact',
        recordId: target.userId,
        resourceLabel: target.username,
        organizationId: tenant.organizationId,
        actorId: userId,
        before: null,
        after: { contactUserId: target.userId },
        meta,
      }),
    );
    if (!saved) throw new ConflictException(EXISTS);
    return publicContact(target, false);
  }

  async remove(tenant: TenantContext, userId: string, targetUserId: string, meta: RequestMeta): Promise<void> {
    // A contact leaves with its membership, so someone with no membership here cannot be one.
    const target = await this.contacts.findMember(tenant.organizationId, targetUserId);
    if (!target) throw new NotFoundException(NOT_FOUND);
    const removed = await this.contacts.remove(tenant.organizationId, userId, target.userId, (manager) =>
      this.audit.record(manager, {
        module: 'contacts',
        action: 'delete',
        resourceType: 'contact',
        recordId: target.userId,
        resourceLabel: target.username,
        organizationId: tenant.organizationId,
        actorId: userId,
        before: { contactUserId: target.userId },
        after: null,
        meta,
      }),
    );
    if (!removed) throw new NotFoundException(NOT_FOUND);
  }
}
