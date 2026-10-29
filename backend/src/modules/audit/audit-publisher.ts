import { Logger } from '@nestjs/common';
import type {
	EntityManager, EntitySubscriberInterface, QueryRunner, TransactionCommitEvent, TransactionRollbackEvent,
} from 'typeorm';
import type { AuditEvent } from './audit.types';

export type AuditListener = (event: AuditEvent) => void | Promise<void>;

const logger = new Logger('AuditPublisher');

// Where alerts and real-time notifications will plug in. Listeners only hear about committed rows, and a failing
// listener never affects the change that was audited.
class AuditPublisher {
	private readonly listeners = new Set<AuditListener>();
	private readonly pending = new WeakMap<QueryRunner, AuditEvent[]>();

	subscribe(listener: AuditListener): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}

	// Inside a transaction the event waits for the commit, so nobody hears about a change that was rolled back.
	enqueue(manager: EntityManager, event: AuditEvent) {
		const runner = manager.queryRunner;
		if (!runner?.isTransactionActive) return this.publish(event);
		const queued = this.pending.get(runner) ?? [];
		queued.push(event);
		this.pending.set(runner, queued);
	}

	committed(runner: QueryRunner) {
		const queued = this.pending.get(runner);
		this.pending.delete(runner);
		queued?.forEach((event) => this.publish(event));
	}

	rolledBack(runner: QueryRunner) {
		this.pending.delete(runner);
	}

	private publish(event: AuditEvent) {
		for (const listener of this.listeners) {
			Promise.resolve()
				.then(() => listener(event))
				.catch((error: unknown) => logger.error('audit listener failed', error instanceof Error ? error : String(error)));
		}
	}
}

export const auditPublisher = new AuditPublisher();

// Registered on the DataSource by AuditService.
export class AuditTransactionSubscriber implements EntitySubscriberInterface {
	afterTransactionCommit(event: TransactionCommitEvent) {
		auditPublisher.committed(event.queryRunner);
	}

	afterTransactionRollback(event: TransactionRollbackEvent) {
		auditPublisher.rolledBack(event.queryRunner);
	}
}
