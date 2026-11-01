import { isDeniedKey } from '../../common/logging/redaction';
import type { AuditCategory } from './audit.types';

// How a field is shown outside the company, i.e. to platform administrators. Values are stored as they are: a company
// sees all of its own data. plain: shown. maskEmail / maskPhone: shown masked (personal data). redact: only "it
// changed" is shown. A nested object of rules describes a nested value (e.g. the administrator inside a tenant change).
export type FieldRule = 'plain' | 'maskEmail' | 'maskPhone' | 'redact';
export interface FieldRules {
	[field: string]: FieldRule | FieldRules;
}

export interface AuditResource {
	category: AuditCategory;
	fields: FieldRules;
}

// The allowlist. A field that is not listed is never stored, so a new column cannot leak into the trail by accident.
// Each module adds its resources here when it starts auditing, marking personal data (people's emails, phones,
// national ids, ...) so the platform never sees it.
export const AUDIT_RESOURCES: Record<string, AuditResource> = {
	// A person's own account: what they change on their profile.
	user: { category: 'security', fields: { displayName: 'plain' } },
	session: { category: 'security', fields: {} },
	member: {
		category: 'data',
		fields: { role: 'plain', isActive: 'plain' },
	},
	tenant: {
		category: 'platform',
		fields: {
			name: 'plain',
			slug: 'plain',
			// The company's own contact details are business data the platform already manages.
			contactEmail: 'plain',
			contactPhone: 'plain',
			address: 'plain',
			isActive: 'plain',
			reason: 'plain',
			cause: 'plain',
			administrator: { id: 'plain', username: 'plain', email: 'maskEmail' },
		},
	},
	tenant_administrator: {
		category: 'platform',
		fields: {
			administrator: { id: 'plain', username: 'plain', email: 'maskEmail' },
			account: 'plain',
			role: 'plain',
			membershipActive: 'plain',
			reason: 'plain',
		},
	},
	audit_log: { category: 'access', fields: {} },
};

export function auditResource(resourceType: string): AuditResource {
	const resource = AUDIT_RESOURCES[resourceType];
	if (!resource) throw new Error(`Unknown audit resource "${resourceType}": add it to AUDIT_RESOURCES.`);
	return resource;
}

// A denied key (password, token, …) can never be allowlisted, so a typo in this file fails at startup, not in production.
function assertNoDeniedFields(rules: FieldRules, path: string) {
	for (const [field, rule] of Object.entries(rules)) {
		if (isDeniedKey(field)) throw new Error(`Audit field "${path}${field}" can never be stored.`);
		if (typeof rule === 'object') assertNoDeniedFields(rule, `${path}${field}.`);
	}
}
for (const [type, resource] of Object.entries(AUDIT_RESOURCES)) assertNoDeniedFields(resource.fields, `${type}.`);
