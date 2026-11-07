require('reflect-metadata');
const { test } = require('node:test');
const assert = require('node:assert/strict');

// Most tests replace modules with fakes, so an import cycle between real files (a module that imports another through
// an index file that is still loading) only shows when the whole app starts, as an `undefined` entry in `imports`.
// This walks the real module graph from AppModule and fails on any such entry.
test('every module the app imports resolves, with no file-level import cycles', () => {
  // Loading AppModule starts ConfigModule.forRoot, which validates the environment asynchronously; on a machine whose
  // backend/.env lacks the database and JWT settings, that rejects after the test ends and fails the file. Only the
  // module graph is read here (nothing connects), so placeholders that pass validation are enough.
  Object.assign(process.env, {
    NODE_ENV: 'test', DB_HOST: 'localhost', DB_USER: 'module-graph', DB_PASS: 'module-graph', DB_NAME: 'module_graph',
    JWT_SECRET: 'module-graph-test-secret-at-least-32-characters',
  });
  const { AppModule } = require('../dist/app.module');
  const seen = new Set();
  const problems = [];
  const walk = (module, path) => {
    if (seen.has(module)) return;
    seen.add(module);
    const imports = Reflect.getMetadata('imports', module) ?? [];
    imports.forEach((imported, index) => {
      const target = imported?.module ?? imported;
      if (!target) problems.push(`${path} imports[${index}] is undefined`);
      else walk(target, target.name);
    });
  };
  walk(AppModule, 'AppModule');
  assert.deepEqual(problems, []);
  assert.ok(seen.size > 10);
});
