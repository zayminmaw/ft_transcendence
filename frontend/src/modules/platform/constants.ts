import type { CreateTenantValues } from './api';

// The create tenant form starts empty.
export const CREATE_TENANT_DEFAULT_VALUES: CreateTenantValues = {
	organization: { name: '', slug: '', contactEmail: '', contactPhone: '', address: '' },
	administrator: { username: '', email: '', password: '' },
};

// API conflicts on tenant creation that belong to one form field.
export const CREATE_TENANT_FIELD_ERRORS = {
	TENANT_SLUG_TAKEN: 'organization.slug',
	USERNAME_TAKEN: 'administrator.username',
	EMAIL_TAKEN: 'administrator.email',
	PASSWORD_TOO_WEAK: 'administrator.password',
} as const;

export const NEW_ADMINISTRATOR_DEFAULT_VALUES = CREATE_TENANT_DEFAULT_VALUES.administrator;

// API conflicts on a new administrator account that belong to one form field.
export const NEW_ADMINISTRATOR_FIELD_ERRORS = {
	USERNAME_TAKEN: 'username',
	EMAIL_TAKEN: 'email',
	PASSWORD_TOO_WEAK: 'password',
} as const;
