import { Inject, Injectable, Logger, type OnModuleDestroy, Optional } from '@nestjs/common';
import type { Server } from 'socket.io';
import { ContactsRepository } from '../contacts/contacts.repository';
import { type ContactStatus } from '../contacts/contacts.service';
import { OrganizationMembersService } from '../organizations';
import { PresenceRegistry } from './presence.registry';
import { organizationRoom, userRoom } from './rooms';

// How long a person stays online after their last connection closes. A test sets a short one.
export const PRESENCE_GRACE_MS = Symbol('PRESENCE_GRACE_MS');

// Who is online, per company, and who hears about it. Presence is only in memory; the status a viewer sees is
// suspended first (the account or the membership is off), then whether the person has a live socket in that company.
@Injectable()
export class PresenceService implements OnModuleDestroy {
  private readonly logger = new Logger(PresenceService.name);
  private readonly registry: PresenceRegistry;
  private server?: Server;

  constructor(
    private readonly contacts: ContactsRepository,
    private readonly memberships: OrganizationMembersService,
    @Optional() @Inject(PRESENCE_GRACE_MS) graceMs?: number,
  ) {
    this.registry = new PresenceRegistry((organizationId, userId) => this.announce(organizationId, userId), graceMs);
  }

  // The gateway hands over its socket.io server once it exists; the service never imports the gateway.
  attach(server: Server): void {
    this.server = server;
  }

  connect(organizationId: string, userId: string, socketId: string): void {
    this.registry.connect(organizationId, userId, socketId);
  }

  disconnect(organizationId: string, userId: string, socketId: string): void {
    this.registry.disconnect(organizationId, userId, socketId);
  }

  isOnline(organizationId: string, userId: string): boolean {
    return this.registry.isOnline(organizationId, userId);
  }

  async statusOf(organizationId: string, userId: string): Promise<ContactStatus> {
    if (!(await this.memberships.isActiveMember(userId, organizationId))) return 'suspended';
    return this.isOnline(organizationId, userId) ? 'online' : 'offline';
  }

  // Call after anything that changes someone's access to a company. Recomputes their status, ends their sockets in that
  // company when they are suspended, and tells the people who saved them. Only a refresh can announce a reactivation,
  // because a person who reconnects inside the grace period is not a change to the registry.
  async refresh(organizationId: string, userId: string): Promise<void> {
    const status = await this.statusOf(organizationId, userId);
    if (status === 'suspended') this.server?.in(userRoom(organizationId, userId)).disconnectSockets(true);
    await this.tell(organizationId, userId, status);
  }

  // The company was suspended: end every connection to it.
  async closeCompany(organizationId: string): Promise<void> {
    this.server?.in(organizationRoom(organizationId)).disconnectSockets(true);
  }

  onModuleDestroy(): void {
    this.registry.dispose();
  }

  // A real transition from the registry. The status is recomputed, so a person who is suspended is never shown Online.
  private async announce(organizationId: string, userId: string): Promise<void> {
    await this.tell(organizationId, userId, await this.statusOf(organizationId, userId));
  }

  // Only the people who saved this person, in their own room of this company. Ids and status only, no names. Best
  // effort like notifications: a failed delivery is logged, never thrown.
  private async tell(organizationId: string, userId: string, status: ContactStatus): Promise<void> {
    try {
      const viewers = await this.contacts.viewersOf(organizationId, userId);
      const payload = { organizationId, userId, status, timestamp: new Date().toISOString() };
      for (const viewer of viewers) this.server?.to(userRoom(organizationId, viewer)).emit('presence', payload);
    } catch (error) {
      this.logger.warn(`Presence delivery failed: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
  }
}
