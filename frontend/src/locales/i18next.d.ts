// Types every t('…') key from the English files: a wrong or missing English key fails the build.
// Add one line here for each new namespace file in locales/en/.
import type auth from './en/auth.json';
import type common from './en/common.json';

declare module 'i18next' {
	interface CustomTypeOptions {
		defaultNS: 'common';
		resources: {
			auth: typeof auth;
			common: typeof common;
		};
	}
}
