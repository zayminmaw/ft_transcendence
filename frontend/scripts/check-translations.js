// Compares every language in src/locales with English and lists what is missing or out of date.
// It only warns, so teammates are never blocked by a language they can't write; --strict fails instead.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const PLURAL_FORMS = ['zero', 'one', 'two', 'few', 'many', 'other'];
const PLURAL_SUFFIX = new RegExp(`_(${PLURAL_FORMS.join('|')})$`);

function flatten(value, prefix = '', keys = new Map()) {
	for (const [key, child] of Object.entries(value)) {
		const path = prefix ? `${prefix}.${key}` : key;
		if (child && typeof child === 'object') flatten(child, path, keys);
		else keys.set(path, String(child));
	}
	return keys;
}

function readKeys(file) {
	const text = readFileSync(file, 'utf8');
	let value;
	try {
		value = JSON.parse(text);
	} catch (error) {
		throw new Error(`${file} is not valid JSON: ${error.message}`, { cause: error });
	}
	return flatten(value);
}

function placeholders(text) {
	return [...new Set([...text.matchAll(/{{\s*([\w.]+)/g)].map((match) => match[1]))].sort();
}

function describe(names) {
	return names.length ? names.map((name) => `{{${name}}}`).join(', ') : 'none';
}

// English plural keys (items_one, items_other) become the forms this language uses: Thai needs
// only items_other, Arabic needs all six. A plural form is compared with English's _other text.
function expectedKeys(english, language) {
	const forms = new Intl.PluralRules(language).resolvedOptions().pluralCategories;
	const expected = new Map();
	for (const [key, text] of english) {
		const base = key.replace(PLURAL_SUFFIX, '');
		if (base === key) {
			expected.set(key, { text, plural: false });
			continue;
		}
		const other = english.get(`${base}_other`) ?? text;
		for (const form of PLURAL_FORMS.filter((name) => forms.includes(name))) {
			expected.set(`${base}_${form}`, { text: other, plural: true });
		}
	}
	return expected;
}

function compareFile(english, translated, language, where) {
	const warnings = [];
	const expected = expectedKeys(english, language);
	for (const [key, { text: englishText, plural }] of expected) {
		const text = translated.get(key);
		if (text === undefined || text.trim() === '') {
			warnings.push(`${where}: missing "${key}"`);
			continue;
		}
		const want = placeholders(englishText);
		const have = placeholders(text);
		// A plural form may leave {{count}} out ("one item"), but may not invent a placeholder.
		const differs = plural
			? have.some((name) => !want.includes(name))
			: have.join() !== want.join();
		if (differs) {
			warnings.push(
				`${where}: "${key}" has ${describe(have)} but English has ${describe(want)}`,
			);
		}
	}
	for (const key of translated.keys()) {
		if (!expected.has(key)) warnings.push(`${where}: "${key}" is not in English`);
	}
	return warnings;
}

export function checkTranslations(localesDir) {
	const jsonFiles = (language) =>
		readdirSync(join(localesDir, language))
			.filter((file) => file.endsWith('.json'))
			.sort();
	const namespaces = jsonFiles('en');
	const languages = readdirSync(localesDir, { withFileTypes: true })
		.filter((entry) => entry.isDirectory() && entry.name !== 'en')
		.map((entry) => entry.name)
		.sort();

	const warnings = [];
	for (const language of languages) {
		for (const file of namespaces) {
			const where = `${language}/${file}`;
			const path = join(localesDir, language, file);
			if (!existsSync(path)) {
				warnings.push(`${where}: file missing`);
				continue;
			}
			const english = readKeys(join(localesDir, 'en', file));
			warnings.push(...compareFile(english, readKeys(path), language, where));
		}
		for (const file of jsonFiles(language)) {
			if (!namespaces.includes(file))
				warnings.push(`${language}/${file}: file is not in English`);
		}
	}
	return warnings;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	const warnings = checkTranslations(fileURLToPath(new URL('../src/locales/', import.meta.url)));
	for (const warning of warnings) console.warn(`translation warning: ${warning}`);
	console.log(
		warnings.length
			? `${warnings.length} translation warning(s); pages show English where text is missing.`
			: 'Translations: every language matches English.',
	);
	if (process.argv.includes('--strict') && warnings.length) process.exitCode = 1;
}
