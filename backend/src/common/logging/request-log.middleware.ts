import { Logger } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

const logger = new Logger('HTTP');

// One line per finished request. Headers, bodies and query strings never reach the log:
// they carry tokens, cookies and personal data.
export function requestLogMiddleware(request: Request, response: Response, next: NextFunction) {
	const startedAt = process.hrtime.bigint();
	response.on('finish', () => {
		const durationMs = Number((process.hrtime.bigint() - startedAt) / 1_000_000n);
		// Prefer the matched route pattern (/api/tenants/:id) so ids do not fan out into separate entries.
		const routePath = (request.route as { path?: unknown } | undefined)?.path;
		const path = (typeof routePath === 'string' ? `${request.baseUrl}${routePath}` : request.originalUrl.split('?')[0])
			// An unmatched path is whatever the client sent; keep log lines bounded.
			.slice(0, 200);
		const fields = { method: request.method, path, status: response.statusCode, durationMs };
		if (response.statusCode >= 500) logger.error('request completed', fields);
		else if (path.startsWith('/api/health')) logger.debug('request completed', fields);
		else logger.log('request completed', fields);
	});
	next();
}
