import type { LoggerService } from '@nestjs/common';
import { currentActor, currentRequestId } from '../context/request-context';
import { redact } from './redaction';

export const LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'verbose'] as const;
export type LogLevel = (typeof LOG_LEVELS)[number];
export type LogFormat = 'json' | 'pretty';

export interface AppLoggerOptions {
	level: LogLevel;
	format: LogFormat;
	// Stack traces can name files and libraries; keep them out of production logs.
	includeStack: boolean;
	write?: (line: string) => void;
}

const STACK_LINE = /\n\s+at /;

// Technical logs only (errors, latency, lifecycle): one JSON object per line on stdout.
// Business accountability goes to the audit trail, never here.
export class AppLogger implements LoggerService {
	private readonly threshold: number;
	private readonly write: (line: string) => void;

	constructor(private readonly options: AppLoggerOptions) {
		this.threshold = LOG_LEVELS.indexOf(options.level);
		this.write = options.write ?? ((line) => process.stdout.write(line));
	}

	fatal(message: unknown, ...params: unknown[]) { this.emit('fatal', message, params); }
	error(message: unknown, ...params: unknown[]) { this.emit('error', message, params); }
	warn(message: unknown, ...params: unknown[]) { this.emit('warn', message, params); }
	log(message: unknown, ...params: unknown[]) { this.emit('info', message, params); }
	debug(message: unknown, ...params: unknown[]) { this.emit('debug', message, params); }
	verbose(message: unknown, ...params: unknown[]) { this.emit('verbose', message, params); }

	private emit(level: LogLevel, message: unknown, params: unknown[]) {
		if (LOG_LEVELS.indexOf(level) > this.threshold) return;
		const rest = [...params];
		// A Nest Logger created with a context passes that context as the last argument.
		const context = rest.length > 0 && typeof rest[rest.length - 1] === 'string' ? (rest.pop() as string) : undefined;
		const entry: Record<string, unknown> = {
			ts: new Date().toISOString(),
			level,
			...(context ? { context } : {}),
		};
		Object.assign(entry, this.describe(message, 'msg'));
		for (const param of rest) Object.assign(entry, this.describe(param, 'detail'));
		const requestId = currentRequestId();
		if (requestId) entry.requestId = requestId;
		const { userId } = currentActor();
		if (userId) entry.userId = userId;
		this.write(this.format(entry) + '\n');
	}

	private describe(value: unknown, key: 'msg' | 'detail'): Record<string, unknown> {
		if (value instanceof Error) {
			return { err: { name: value.name, message: value.message, ...(this.options.includeStack ? { stack: value.stack } : {}) } };
		}
		if (typeof value === 'string') {
			if (STACK_LINE.test(value)) return this.options.includeStack ? { stack: value } : {};
			return { [key]: value };
		}
		if (value !== null && typeof value === 'object') return redact(value) as Record<string, unknown>;
		return value === undefined ? {} : { [key]: String(value) };
	}

	private format(entry: Record<string, unknown>): string {
		if (this.options.format === 'json') return JSON.stringify(entry);
		const { ts, level, context, msg, ...fields } = entry;
		const extra = Object.keys(fields).length > 0 ? ` ${JSON.stringify(fields)}` : '';
		return `${ts} ${String(level).toUpperCase().padEnd(7)} ${context ? `[${context}] ` : ''}${msg ?? ''}${extra}`;
	}
}
