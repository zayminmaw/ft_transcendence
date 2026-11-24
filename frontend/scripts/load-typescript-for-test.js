import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import ts from 'typescript';

// Run the actual TypeScript module with explicit browser/hook dependencies supplied by a test.
export function loadTypeScript(url, mocks, globals = {}) {
	const { outputText } = ts.transpileModule(readFileSync(url, 'utf8'), {
		fileName: fileURLToPath(url),
		compilerOptions: {
			target: ts.ScriptTarget.ES2022,
			module: ts.ModuleKind.CommonJS,
			jsx: ts.JsxEmit.ReactJSX,
		},
	});
	const exports = {};
	const actualRequire = createRequire(url);
	vm.runInNewContext(
		outputText,
		{
			...globals,
			exports,
			require: (name) => (Object.hasOwn(mocks, name) ? mocks[name] : actualRequire(name)),
		},
		{ filename: fileURLToPath(url) },
	);
	return exports;
}
