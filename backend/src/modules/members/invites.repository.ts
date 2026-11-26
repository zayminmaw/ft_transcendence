import { Injectable } from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';
import { Organization, OrganizationMember } from '../organizations';
import { Role } from '../rbac';
import { createAccount, User } from '../users';
import { MemberInvite } from './entities/member-invite.entity';

export interface InviteRecord {
  id: string;
  organizationId: string;
  email: string | null;
  role: { id: number; code: string; name: string };
  invitedBy: { userId: string; username: string; displayName: string | null };
  usedBy: { userId: string; username: string; displayName: string | null } | null;
  expiresAt: Date;
  usedAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
}

export interface ActiveInvitePreview {
  id: string;
  organization: { id: string; name: string; slug: string };
  role: { id: number; code: string; name: string };
  email: string | null;
  expiresAt: Date;
}

export interface AcceptInviteInput {
  tokenHash: string;
  now: Date;
  username: string;
  email: string | null;
  displayName: string | null;
  password: string;
}

export type AcceptInviteResult =
  | { status: 'invalid' | 'email_required' | 'email_mismatch' }
  | {
    status: 'created';
    user: User;
    organizationId: string;
    organizationSlug: string;
    roleCode: string;
    inviteId: string;
  };

export type RevokeInviteResult = 'revoked' | 'not_found' | 'already_used' | 'already_revoked';

export type InviteAuditStep = (
  manager: EntityManager,
  created: { organizationId: string; userId: string; username: string; roleCode: string; inviteId: string },
) => Promise<void>;

interface InviteRow {
  id: string;
  organizationId: string;
  email: string | null;
  roleId: number;
  roleCode: string;
  roleName: string;
  invitedByUserId: string;
  invitedByUsername: string;
  invitedByDisplayName: string | null;
  usedByUserId: string | null;
  usedByUsername: string | null;
  usedByDisplayName: string | null;
  expiresAt: Date;
  usedAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
}

interface LockedInviteRow {
  id: string;
  organizationId: string;
  organizationSlug: string;
  organizationActive: number | boolean;
  roleId: number;
  roleCode: string;
  email: string | null;
  expiresAt: Date;
  usedAt: Date | null;
  revokedAt: Date | null;
}

function toInviteRecord(row: InviteRow): InviteRecord {
  return {
    id: String(row.id),
    organizationId: String(row.organizationId),
    email: row.email,
    role: { id: Number(row.roleId), code: row.roleCode, name: row.roleName },
    invitedBy: {
      userId: String(row.invitedByUserId),
      username: row.invitedByUsername,
      displayName: row.invitedByDisplayName,
    },
    usedBy: row.usedByUserId
      ? { userId: String(row.usedByUserId), username: row.usedByUsername!, displayName: row.usedByDisplayName }
      : null,
    expiresAt: row.expiresAt,
    usedAt: row.usedAt,
    revokedAt: row.revokedAt,
    createdAt: row.createdAt,
  };
}

// Single-use member invitations scoped to one organization. Accepting an invite locks its row with FOR UPDATE so two
// concurrent sign-ups with the same link can never both succeed.
@Injectable()
export class InvitesRepository {
  constructor(private readonly database: DataSource) {}

  list(organizationId: string): Promise<InviteRecord[]> {
    return this.query(organizationId);
  }

  async find(organizationId: string, id: string): Promise<InviteRecord | undefined> {
    return (await this.query(organizationId, id))[0];
  }

  async emailTaken(email: string): Promise<boolean> {
    return this.database.getRepository(User).existsBy({ email: email.trim() });
  }

  async create(input: {
    organizationId: string;
    roleId: number;
    invitedByUserId: string;
    email: string | null;
    tokenHash: string;
    expiresAt: Date;
  }, auditStep: (manager: EntityManager, record: InviteRecord) => Promise<void>): Promise<InviteRecord> {
    return this.database.transaction(async (manager) => {
      const repository = manager.getRepository(MemberInvite);
      const saved = await repository.save(repository.create(input));
      const record = (await this.query(input.organizationId, String(saved.id), manager))[0];
      if (!record) throw new Error('The new invite could not be read back.');
      await auditStep(manager, record);
      return record;
    });
  }

  async revoke(organizationId: string, id: string, at: Date, auditStep: (manager: EntityManager) => Promise<void>): Promise<RevokeInviteResult> {
    return this.database.transaction('READ COMMITTED', async (manager) => {
      const invite = await manager
        .createQueryBuilder(MemberInvite, 'i')
        .setLock('pessimistic_write')
        .where('i.organizationId = :organizationId AND i.id = :id', { organizationId, id })
        .getOne();
      if (!invite) return 'not_found';
      if (invite.usedAt) return 'already_used';
      if (invite.revokedAt) return 'already_revoked';
      await manager.update(MemberInvite, { id: invite.id, organizationId }, { revokedAt: at });
      await auditStep(manager);
      return 'revoked';
    });
  }

  async findActiveByTokenHash(tokenHash: string, now: Date): Promise<ActiveInvitePreview | undefined> {
    const row = await this.database
      .createQueryBuilder(MemberInvite, 'i')
      .innerJoin(Organization, 'o', 'o.id = i.organizationId')
      .innerJoin(Role, 'r', 'r.id = i.roleId')
      .select('i.id', 'id')
      .addSelect('o.id', 'organizationId')
      .addSelect('o.name', 'organizationName')
      .addSelect('o.slug', 'organizationSlug')
      .addSelect('r.id', 'roleId')
      .addSelect('r.code', 'roleCode')
      .addSelect('r.name', 'roleName')
      .addSelect('i.email', 'email')
      .addSelect('i.expiresAt', 'expiresAt')
      .where('i.tokenHash = :tokenHash', { tokenHash })
      .andWhere('i.usedAt IS NULL')
      .andWhere('i.revokedAt IS NULL')
      .andWhere('i.expiresAt > :now', { now })
      .andWhere('o.isActive = :active', { active: true })
      .getRawOne<{
        id: string;
        organizationId: string;
        organizationName: string;
        organizationSlug: string;
        roleId: number;
        roleCode: string;
        roleName: string;
        email: string | null;
        expiresAt: Date;
      }>();
    if (!row) return undefined;
    return {
      id: String(row.id),
      organization: { id: String(row.organizationId), name: row.organizationName, slug: row.organizationSlug },
      role: { id: Number(row.roleId), code: row.roleCode, name: row.roleName },
      email: row.email,
      expiresAt: row.expiresAt,
    };
  }

  // Consumes a valid invite, creates the user (with mustChangePassword = false) and active company membership, and
  // writes the audit entry inside one transaction.
  async acceptInvite(input: AcceptInviteInput, auditStep: InviteAuditStep): Promise<AcceptInviteResult> {
    return this.database.transaction('READ COMMITTED', async (manager) => {
      const rows = await manager.query<LockedInviteRow[]>(
        `SELECT i.id AS id, i.organization_id AS organizationId, o.slug AS organizationSlug,
                o.is_active AS organizationActive, i.role_id AS roleId, r.code AS roleCode,
                i.email AS email, i.expires_at AS expiresAt, i.used_at AS usedAt, i.revoked_at AS revokedAt
           FROM member_invites i
           JOIN organizations o ON o.id = i.organization_id
           JOIN roles r ON r.id = i.role_id
          WHERE i.token_hash = ?
          FOR UPDATE`,
        [input.tokenHash],
      );
      const invite = rows[0];
      if (!invite || invite.usedAt || invite.revokedAt || !Number(invite.organizationActive)) {
        return { status: 'invalid' };
      }
      if (new Date(invite.expiresAt).getTime() <= input.now.getTime()) {
        return { status: 'invalid' };
      }

      const boundEmail = invite.email ? invite.email.trim() : null;
      const providedEmail = input.email ? input.email.trim() : null;
      if (boundEmail && providedEmail && boundEmail.toLowerCase() !== providedEmail.toLowerCase()) {
        return { status: 'email_mismatch' };
      }
      const email = boundEmail ?? providedEmail;
      if (!email) return { status: 'email_required' };

      const userId = await createAccount(manager, {
        username: input.username,
        email,
        password: input.password,
        mustChangePassword: false,
      });
      if (input.displayName) {
        await manager.update(User, { id: userId }, { displayName: input.displayName });
      }
      const organizationId = String(invite.organizationId);
      await manager.insert(OrganizationMember, {
        organizationId,
        userId,
        roleId: Number(invite.roleId),
        isActive: true,
      });
      await manager.update(
        MemberInvite,
        { id: String(invite.id), organizationId },
        { usedAt: input.now, usedByUserId: userId },
      );
      const user = await manager.findOneBy(User, { id: userId });
      if (!user) throw new Error('The signed-up account could not be read back.');
      await auditStep(manager, {
        organizationId,
        userId: String(user.id),
        username: user.username,
        roleCode: invite.roleCode,
        inviteId: String(invite.id),
      });
      return {
        status: 'created',
        user,
        organizationId,
        organizationSlug: invite.organizationSlug,
        roleCode: invite.roleCode,
        inviteId: String(invite.id),
      };
    });
  }

  private async query(organizationId: string, id?: string, manager = this.database.manager): Promise<InviteRecord[]> {
    const query = manager
      .createQueryBuilder(MemberInvite, 'i')
      .innerJoin(Role, 'r', 'r.id = i.roleId')
      .innerJoin(User, 'inviter', 'inviter.id = i.invitedByUserId')
      .leftJoin(User, 'usedBy', 'usedBy.id = i.usedByUserId')
      .select('i.id', 'id')
      .addSelect('i.organizationId', 'organizationId')
      .addSelect('i.email', 'email')
      .addSelect('r.id', 'roleId')
      .addSelect('r.code', 'roleCode')
      .addSelect('r.name', 'roleName')
      .addSelect('inviter.id', 'invitedByUserId')
      .addSelect('inviter.username', 'invitedByUsername')
      .addSelect('inviter.displayName', 'invitedByDisplayName')
      .addSelect('usedBy.id', 'usedByUserId')
      .addSelect('usedBy.username', 'usedByUsername')
      .addSelect('usedBy.displayName', 'usedByDisplayName')
      .addSelect('i.expiresAt', 'expiresAt')
      .addSelect('i.usedAt', 'usedAt')
      .addSelect('i.revokedAt', 'revokedAt')
      .addSelect('i.createdAt', 'createdAt')
      .where('i.organizationId = :organizationId', { organizationId })
      .orderBy('i.createdAt', 'DESC')
      .addOrderBy('i.id', 'DESC');
    if (id) query.andWhere('i.id = :id', { id });
    return (await query.getRawMany<InviteRow>()).map(toInviteRecord);
  }
}
