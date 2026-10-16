import path from 'node:path';
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

// Resolve aliases and relative imports so cross-module internals cannot bypass the index barrier.
const indexBarrier = {
	meta: {
		type: 'problem',
		schema: [],
		messages: { internal: 'Import other modules through their root index.ts.' },
	},
	create(context) {
		const source = context.filename.replaceAll('\\', '/');
		const current = /\/src\/modules\/([^/]+)\//.exec(source)?.[1];
		function check(node) {
			const value = node.source?.value;
			if (typeof value !== 'string') return;
			const target = value.startsWith('@modules/')
				? path.posix.normalize(`/src/modules/${value.slice('@modules/'.length)}`)
				: value.startsWith('.')
					? path.resolve(path.dirname(source), value).replaceAll('\\', '/')
					: value;
			const match = /\/src\/modules\/([^/]+)(?:\/(.*))?$/.exec(target);
			if (match && match[1] !== current && match[2] && !/^index(?:\.ts)?$/.test(match[2])) {
				context.report({ node, messageId: 'internal' });
			}
		}
		return {
			ImportDeclaration: check,
			ImportExpression: check,
			ExportNamedDeclaration: check,
			ExportAllDeclaration: check,
		};
	},
};

// Physical left/right classes don't flip for Arabic; suggest the start/end class instead.
const logicalReplacements = [
	[/^(-?)(scroll-[mp]|[mp])l(-.+)$/, '$1$2s$3'],
	[/^(-?)(scroll-[mp]|[mp])r(-.+)$/, '$1$2e$3'],
	[/^(-?)left(-.+)$/, '$1inset-s$2'],
	[/^(-?)right(-.+)$/, '$1inset-e$2'],
	[/^border-l(-.+)?$/, 'border-s$1'],
	[/^border-r(-.+)?$/, 'border-e$1'],
	[/^rounded-l(-.+)?$/, 'rounded-s$1'],
	[/^rounded-r(-.+)?$/, 'rounded-e$1'],
	[/^rounded-tl(-.+)?$/, 'rounded-ss$1'],
	[/^rounded-tr(-.+)?$/, 'rounded-se$1'],
	[/^rounded-bl(-.+)?$/, 'rounded-es$1'],
	[/^rounded-br(-.+)?$/, 'rounded-ee$1'],
	[/^(text|float|clear)-left$/, '$1-start'],
	[/^(text|float|clear)-right$/, '$1-end'],
];

const logicalClasses = {
	meta: {
		type: 'suggestion',
		schema: [],
		messages: {
			physical: 'Use `{{logical}}` instead of `{{physical}}` so the layout flips for Arabic.',
		},
	},
	create(context) {
		function check(node, text) {
			const attribute = context.sourceCode
				.getAncestors(node)
				.findLast((ancestor) => ancestor.type === 'JSXAttribute');
			if (attribute?.name.name !== 'className') return;
			for (const physical of text.split(/\s+/)) {
				// Keep variants (md:, [&>svg]:) and the ! marker, and rewrite only the utility itself.
				const [, prefix, utility, important] =
					/^((?:(?:\[[^\]]*\]|[^:[\]])+:)*!?)(.*?)(!?)$/.exec(physical);
				const match = logicalReplacements.find(([pattern]) => pattern.test(utility));
				if (!match) continue;
				const logical = prefix + utility.replace(...match) + important;
				context.report({ node, messageId: 'physical', data: { physical, logical } });
			}
		}
		return {
			Literal: (node) => typeof node.value === 'string' && check(node, node.value),
			TemplateElement: (node) => check(node, node.value.cooked ?? ''),
		};
	},
};

export default tseslint.config(
	{ ignores: ['dist/**', 'node_modules/**'] },
	js.configs.recommended,
	...tseslint.configs.recommended,
	{
		files: ['**/*.{js,ts,tsx}'],
		languageOptions: { globals: { ...globals.browser, ...globals.node } },
	},
	{
		files: ['src/**/*.{ts,tsx}'],
		plugins: {
			'react-hooks': reactHooks,
			'react-refresh': reactRefresh,
			architecture: { rules: { 'index-barrier': indexBarrier } },
			rtl: { rules: { 'logical-classes': logicalClasses } },
		},
		rules: {
			...reactHooks.configs.recommended.rules,
			'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
			'architecture/index-barrier': 'error',
			'rtl/logical-classes': 'warn',
		},
	},
);
