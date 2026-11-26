// Types every t('…') key from the English files: a wrong or missing English key fails the build.
// Add one line here for each new namespace file in locales/en/.
import type assets from './en/assets.json';
import type audit from './en/audit.json';
import type auth from './en/auth.json';
import type billing from './en/billing.json';
import type clients from './en/clients.json';
import type common from './en/common.json';
import type contacts from './en/contacts.json';
import type dashboard from './en/dashboard.json';
import type drivers from './en/drivers.json';
import type insights from './en/insights.json';
import type platform from './en/platform.json';
import type marketing from './en/marketing.json';
import type parcels from './en/parcels.json';
import type rbac from './en/rbac.json';

declare module 'i18next' {
	interface CustomTypeOptions {
		defaultNS: 'common';
		resources: {
			assets: typeof assets;
			audit: typeof audit;
			auth: typeof auth;
			billing: typeof billing;
			clients: typeof clients;
			common: typeof common;
			contacts: typeof contacts;
			dashboard: typeof dashboard;
			drivers: typeof drivers;
			insights: typeof insights;
			platform: typeof platform;
			marketing: typeof marketing;
			parcels: typeof parcels;
			rbac: typeof rbac;
		};
	}
}
