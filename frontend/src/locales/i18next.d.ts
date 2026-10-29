// Types every t('…') key from the English files: a wrong or missing English key fails the build.
// Add one line here for each new namespace file in locales/en/.
import type auth from './en/auth.json';
import type clients from './en/clients.json';
import type common from './en/common.json';
import type drivers from './en/drivers.json';
import type rbac from './en/rbac.json';

declare module 'i18next' {
	interface CustomTypeOptions {
		defaultNS: 'common';
		resources: {
			auth: typeof auth;
			clients: typeof clients;
			common: typeof common;
			drivers: typeof drivers;
			rbac: typeof rbac;
		};
	}
}
