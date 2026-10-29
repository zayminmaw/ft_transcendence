export const REDACTED = '[REDACTED]';

// Keys that never reach a log line or an audit row, whatever a caller passes in.
const DENIED_KEY = /pass(word)?|token|secret|cookie|authorization|session|otp|api[_-]?key/i;

const MAX_DEPTH = 6;

export function isDeniedKey(key: string): boolean {
	return DENIED_KEY.test(key);
}

// Deep-copies plain data, replacing the value of every denied key.
export function redact(value: unknown, depth = 0): unknown {
	if (value === null || typeof value !== 'object') return value;
	if (depth >= MAX_DEPTH) return '[Truncated]';
	if (value instanceof Date) return value.toISOString();
	if (Array.isArray(value)) return value.map((item) => redact(item, depth + 1));
	const result: Record<string, unknown> = {};
	for (const [key, item] of Object.entries(value)) {
		result[key] = isDeniedKey(key) ? REDACTED : redact(item, depth + 1);
	}
	return result;
}

// j***@e***.com: enough to tell two addresses apart without storing either one.
export function maskEmail(value: string): string {
	const [local, domain] = value.split('@');
	if (!domain) return REDACTED;
	const dot = domain.lastIndexOf('.');
	const host = dot > 0 ? domain.slice(0, dot) : domain;
	const tld = dot > 0 ? domain.slice(dot) : '';
	return `${local.slice(0, 1)}***@${host.slice(0, 1)}***${tld}`;
}

export function maskPhone(value: string): string {
	const digits = value.replace(/\D/g, '');
	return digits.length < 4 ? REDACTED : `***${digits.slice(-2)}`;
}
