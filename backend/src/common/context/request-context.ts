import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import type { NextFunction, Response } from 'express';
import type { AuthenticatedRequest } from '../types/authenticated-request';

export const REQUEST_ID_HEADER = 'X-Request-Id';

interface RequestContext {
	requestId: string;
	// The request itself, not a copy: guards set user and tenant after this middleware runs.
	request: AuthenticatedRequest;
}

const storage = new AsyncLocalStorage<RequestContext>();

// Accept a caller's id so a trace can cross the proxy, but only in a shape that is safe to log and store.
const REQUEST_ID_PATTERN = /^[A-Za-z0-9-]{8,64}$/;

export function resolveRequestId(incoming: unknown): string {
	return typeof incoming === 'string' && REQUEST_ID_PATTERN.test(incoming) ? incoming : randomUUID();
}

export function requestContextMiddleware(request: AuthenticatedRequest, response: Response, next: NextFunction) {
	const requestId = resolveRequestId(request.headers['x-request-id']);
	response.setHeader(REQUEST_ID_HEADER, requestId);
	storage.run({ requestId, request }, next);
}

export function currentRequestId(): string | null {
	return storage.getStore()?.requestId ?? null;
}

export function currentRequest(): AuthenticatedRequest | null {
	return storage.getStore()?.request ?? null;
}

export interface RequestActor {
	userId: string | null;
	organizationId: string | null;
	roleId: string | null;
}

export function currentActor(): RequestActor {
	const request = currentRequest();
	return {
		userId: request?.user?.id ?? null,
		organizationId: request?.tenant?.organizationId ?? null,
		roleId: request?.tenant?.roleId ?? null,
	};
}
