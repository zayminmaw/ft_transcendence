import type { ParseKeys } from 'i18next';
import { errorKey } from '@services/api-client';

// The API's codes for platform administration, as translation keys. Anything else gets the general message.
const MESSAGES = {
	TENANT_SLUG_TAKEN: 'errors.slugTaken',
	USERNAME_TAKEN: 'errors.usernameTaken',
	EMAIL_TAKEN: 'errors.emailTaken',
	PASSWORD_TOO_WEAK: 'errors.passwordRule',
	TENANT_NOT_FOUND: 'errors.tenantNotFound',
	TENANT_ALREADY_ACTIVE: 'errors.alreadyActive',
	TENANT_ALREADY_SUSPENDED: 'errors.alreadySuspended',
	TENANT_HAS_NO_ADMINISTRATOR: 'errors.noAdministrator',
	MEMBER_NOT_FOUND: 'errors.memberNotFound',
	ALREADY_ADMINISTRATOR: 'errors.alreadyAdministrator',
	ADMINISTRATOR_NOT_FOUND: 'errors.administratorNotFound',
	LAST_ADMINISTRATOR: 'errors.lastAdministrator',
	ROLE_NOT_AVAILABLE: 'errors.roleNotAvailable',
	NOT_LAST_ADMINISTRATOR: 'errors.notLastAdministrator',
} as const satisfies Record<string, ParseKeys<'platform'>>;

export const platformErrorKey = (error: unknown) => errorKey(MESSAGES, error);
