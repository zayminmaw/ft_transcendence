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
		},
		rules: {
			...reactHooks.configs.recommended.rules,
			'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
			'architecture/index-barrier': 'error',
		},
	},
);
