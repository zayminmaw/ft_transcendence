import i18n from 'i18next';
import type { Resource, ResourceKey } from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';

// Every locales/<language>/<namespace>.json file is bundled, so adding a file needs no edit here.
const files = import.meta.glob<ResourceKey>('../locales/*/*.json', {
	eager: true,
	import: 'default',
});

const resources: Resource = {};
for (const [path, content] of Object.entries(files)) {
	const [, language, namespace] = /\/locales\/([^/]+)\/([^/]+)\.json$/.exec(path)!;
	(resources[language] ??= {})[namespace] = content;
}

// The page language and direction follow the switcher, so Arabic lays out right to left.
i18n.on('languageChanged', () => {
	const language = i18n.resolvedLanguage ?? 'en';
	document.documentElement.lang = language;
	document.documentElement.dir = i18n.dir(language);
});

void i18n
	.use(LanguageDetector)
	.use(initReactI18next)
	.init({
		resources,
		supportedLngs: ['en', 'ar', 'th'],
		fallbackLng: 'en',
		ns: Object.keys(resources.en),
		defaultNS: 'common',
		interpolation: { escapeValue: false },
		// An empty Arabic or Thai text shows the English one, the same as a missing key.
		returnEmptyString: false,
		initAsync: false,
		detection: {
			order: ['localStorage', 'navigator'],
			lookupLocalStorage: 'transcend.language',
			caches: ['localStorage'],
			// A th-TH browser means Thai; the saved choice is always en, ar or th.
			convertDetectedLanguage: (language) => language.split('-')[0],
		},
	});

export default i18n;
