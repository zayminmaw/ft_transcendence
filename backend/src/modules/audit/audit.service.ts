import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { EntityManager, Repository } from 'typeorm';
import { type AuditListener, auditPublisher, AuditTransactionSubscriber } from './audit-publisher';
import { recordAudit } from './audit-writer';
import type { AuditEntry } from './audit.types';
import { AuditLog } from './entities/audit-log.entity';

// The one way to write the audit trail.
//   Inside a change:  await audit.record(manager, { module, action, resourceType, recordId, before, after })
//   Anything else:    await audit.recordStandalone({ ... })   (failed logins, reads, denials)
@Injectable()
export class AuditService {
	constructor(@InjectRepository(AuditLog) private readonly auditLogs: Repository<AuditLog>) {
		// Listeners hear about rows written in a transaction only once it commits.
		const subscribers = auditLogs.manager.connection.subscribers;
		if (!subscribers.some((subscriber) => subscriber instanceof AuditTransactionSubscriber)) {
			subscribers.push(new AuditTransactionSubscriber());
		}
	}

	// Same transaction as the change: both are saved, or neither.
	record(manager: EntityManager, entry: AuditEntry): Promise<void> {
		return recordAudit(manager, entry);
	}

	recordStandalone(entry: AuditEntry): Promise<void> {
		return recordAudit(this.auditLogs.manager, entry);
	}

	// For alerts and notifications: called with each committed row. Returns the unsubscribe function.
	subscribe(listener: AuditListener): () => void {
		return auditPublisher.subscribe(listener);
	}
}
