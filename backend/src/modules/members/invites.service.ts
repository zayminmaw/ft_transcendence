import { createHash, randomBytes } from 'node:crypto';
import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { TenantContext } from '../../common/types/authenticated-request';
import { AuditService } from '../audit';
import { type RequestMeta, SessionsService } from '../auth';
import type { IssuedSession } from '../auth/sessions.service';
import { AccountError, type User } from '../users';
import type { CreateInviteDto } from './dto/create-invite.dto';
import type { SignupDto } from './dto/signup.dto';
import { type InviteRecord, InvitesRepository } from './invites.repository';
import { MembersRepository } from './members.repository';

// 7 days for an invited user to register.
const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
// Same printable-ASCII email rule as users/accounts.ts so invited emails can always log in.
const EMAIL_PATTERN = /^[\x21-\x3F\x41-\x7E]+@[\x21-\x3F\x41-\x7E]+\.[\x21-\x3F\x41-\x7E]+$/;
const POSITIVE_ID = /^[1-9]\d*$/;
// Base64url 32-byte token (43 chars); reject malformed strings before hashing/querying.
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{20,256}$/;

const ROLE_NOT_ASSIGNABLE = { message: "You can't give this role.", code: 'ROLE_NOT_ASSIGNABLE' };
const INVALID_EMAIL = { message: 'Enter a valid email address without spaces or accented letters.', code: 'INVALID_EMAIL' };
const INVITE_EMAIL_TAKEN = { message: 'An account with that email already exists.', code: 'INVITE_EMAIL_TAKEN' };
const INVITE_NOT_FOUND = { message: 'That invite could not be found.', code: 'INVITE_NOT_FOUND' };
const INVITE_ALREADY_USED = { message: 'That invite has already been used.', code: 'INVITE_ALREADY_USED' };
const INVITE_INVALID = { message: 'This invite link is invalid or has expired.', code: 'INVITE_INVALID' };
const INVITE_EMAIL_MISMATCH = { message: 'This invite link is reserved for a different email address.', code: 'INVITE_EMAIL_MISMATCH' };
const ACCOUNT_CODES = { username: 'INVALID_USERNAME', email: 'INVALID_EMAIL', password: 'PASSWORD_RULE' } as const;

export type InviteStatus = 'pending' | 'used' | 'expired' | 'revoked';

export function hashInviteToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function inviteStatus(invite: Pick<InviteRecord, 'usedAt' | 'revokedAt' | 'expiresAt'>, now: Date): InviteStatus {
  if (invite.usedAt) return 'used';
  if (invite.revokedAt) return 'revoked';
  return new Date(invite.expiresAt).getTime() <= now.getTime() ? 'expired' : 'pending';
}

export function publicInvite(invite: InviteRecord, now: Date) {
  return {
    id: invite.id,
    email: invite.email,
    role: { code: invite.role.code, name: invite.role.name },
    status: inviteStatus(invite, now),
    invitedBy: invite.invitedBy,
    usedBy: invite.usedBy,
    expiresAt: invite.expiresAt,
    usedAt: invite.usedAt,
    revokedAt: invite.revokedAt,
    createdAt: invite.createdAt,
  };
}

function publicSignedUpUser(user: User) {
  return {
    id: String(user.id),
    username: user.username,
    email: user.email,
    displayName: user.displayName ?? null,
    avatarUrl: null,
    createdAt: user.createdAt,
  };
}

@Injectable()
export class InvitesService {
  constructor(
    private readonly invites: InvitesRepository,
    private readonly members: MembersRepository,
    private readonly sessions: SessionsService,
    private readonly audit: AuditService,
  ) {}

  async list(tenant: TenantContext) {
    const now = new Date();
    return (await this.invites.list(tenant.organizationId)).map((invite) => publicInvite(invite, now));
  }

  async create(tenant: TenantContext, actorId: string, input: CreateInviteDto, meta: RequestMeta) {
    const role = (await this.members.companyRoles()).find(({ code }) => code === input.roleCode);
    if (!role) throw new ForbiddenException(ROLE_NOT_ASSIGNABLE);

    const email = input.email ? input.email.trim() : null;
    if (email !== null) {
      if (email.length > 191 || !EMAIL_PATTERN.test(email)) throw new BadRequestException(INVALID_EMAIL);
      if (await this.invites.emailTaken(email)) throw new ConflictException(INVITE_EMAIL_TAKEN);
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + INVITE_TTL_MS);
    const token = randomBytes(32).toString('base64url');
    const record = await this.invites.create({
      organizationId: tenant.organizationId,
      roleId: role.id,
      invitedByUserId: actorId,
      email,
      tokenHash: hashInviteToken(token),
      expiresAt,
    }, async (manager, record) => this.audit.record(manager, {
      module: 'members',
      action: 'create',
      resourceType: 'member_invite',
      recordId: record.id,
      resourceLabel: email ?? role.name,
      organizationId: tenant.organizationId,
      actorId,
      after: { email, role: role.code, expiresAt: expiresAt.toISOString() },
      meta,
    }));

    return { invite: publicInvite(record, now), token };
  }

  async revoke(tenant: TenantContext, actorId: string, inviteId: string, meta: RequestMeta): Promise<void> {
    if (!POSITIVE_ID.test(inviteId)) throw new NotFoundException(INVITE_NOT_FOUND);
    const existing = await this.invites.find(tenant.organizationId, inviteId);
    if (!existing) throw new NotFoundException(INVITE_NOT_FOUND);

    const outcome = await this.invites.revoke(tenant.organizationId, inviteId, new Date(), async (manager) => this.audit.record(manager, {
      module: 'members',
      action: 'revoke',
      resourceType: 'member_invite',
      recordId: existing.id,
      resourceLabel: existing.email ?? existing.role.name,
      organizationId: tenant.organizationId,
      actorId,
      before: { email: existing.email, role: existing.role.code },
      meta,
    }));
    if (outcome === 'not_found') throw new NotFoundException(INVITE_NOT_FOUND);
    if (outcome === 'already_used') throw new ConflictException(INVITE_ALREADY_USED);
  }

  async inspect(token: string) {
    if (!TOKEN_PATTERN.test(token)) throw new NotFoundException(INVITE_INVALID);
    const preview = await this.invites.findActiveByTokenHash(hashInviteToken(token), new Date());
    if (!preview) throw new NotFoundException(INVITE_INVALID);
    return {
      organization: { name: preview.organization.name, slug: preview.organization.slug },
      role: { code: preview.role.code, name: preview.role.name },
      email: preview.email,
      expiresAt: preview.expiresAt,
    };
  }

  async signup(input: SignupDto, meta: RequestMeta) {
    if (!TOKEN_PATTERN.test(input.token)) throw new NotFoundException(INVITE_INVALID);
    let outcome;
    let session: IssuedSession | undefined;
    try {
      outcome = await this.invites.acceptInvite(
        {
          tokenHash: hashInviteToken(input.token),
          now: new Date(),
          username: input.username,
          email: input.email ?? null,
          displayName: input.displayName ?? null,
          password: input.password,
        },
        async (manager, created) => {
          await this.audit.record(manager, {
            module: 'members',
            action: 'create',
            resourceType: 'member',
            recordId: created.userId,
            resourceLabel: created.username,
            organizationId: created.organizationId,
            actorId: created.userId,
            after: { role: created.roleCode, isActive: true },
            meta,
          });
          // The account, membership, consumed invite and session commit together. The user lookup and session
          // insert must use this manager, including when every pool connection is already in a signup transaction.
          session = await this.sessions.start(created.userId, meta, new Date(), manager);
        },
      );
    } catch (error) {
      if (!(error instanceof AccountError)) throw error;
      if (error.problem === 'taken') throw new ConflictException({ message: error.message, code: 'SIGNUP_TAKEN' });
      throw new BadRequestException({ message: error.message, code: ACCOUNT_CODES[error.problem] });
    }

    if (outcome.status === 'invalid') throw new NotFoundException(INVITE_INVALID);
    if (outcome.status === 'email_required') throw new BadRequestException(INVALID_EMAIL);
    if (outcome.status === 'email_mismatch') throw new BadRequestException(INVITE_EMAIL_MISMATCH);
    if (outcome.status !== 'created') throw new NotFoundException(INVITE_INVALID);

    if (!session) throw new Error('The signup transaction did not create its session.');
    return {
      session,
      user: publicSignedUpUser(outcome.user),
      organizationSlug: outcome.organizationSlug,
    };
  }
}

