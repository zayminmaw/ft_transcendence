const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { join } = require('node:path');
const { Logger } = require('@nestjs/common');
const { PresenceRegistry } = require('../dist/modules/notifications/presence.registry');

// A registry that records every change it announces, on a clock the test moves by hand.
function registry(t, graceMs) {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const events = [];
  const presence = new PresenceRegistry((organizationId, userId, online) => events.push([organizationId, userId, online]), graceMs);
  t.after(() => presence.dispose());
  return { presence, events };
}

test('the first socket makes a person online, once', (t) => {
  const { presence, events } = registry(t);
  assert.equal(presence.isOnline('1', '10'), false);
  presence.connect('1', '10', 'a');
  presence.connect('1', '10', 'a');
  assert.equal(presence.isOnline('1', '10'), true);
  assert.deepEqual(events, [['1', '10', true]]);
});

test('two sockets count as one person: closing one keeps them online', (t) => {
  const { presence, events } = registry(t);
  presence.connect('1', '10', 'a');
  presence.connect('1', '10', 'b');
  presence.disconnect('1', '10', 'a');
  t.mock.timers.tick(60_000);
  assert.equal(presence.isOnline('1', '10'), true);
  assert.deepEqual(events, [['1', '10', true]]);
  // A socket that was never connected changes nothing.
  presence.disconnect('1', '10', 'never-seen');
  t.mock.timers.tick(60_000);
  assert.equal(presence.isOnline('1', '10'), true);
});

test('closing the last socket keeps them online for 30 seconds, then offline', (t) => {
  const { presence, events } = registry(t);
  presence.connect('1', '10', 'a');
  presence.disconnect('1', '10', 'a');
  t.mock.timers.tick(29_999);
  assert.equal(presence.isOnline('1', '10'), true);
  assert.deepEqual(events, [['1', '10', true]]);
  t.mock.timers.tick(1);
  assert.equal(presence.isOnline('1', '10'), false);
  assert.deepEqual(events, [['1', '10', true], ['1', '10', false]]);
  // Back later is a real transition again.
  presence.connect('1', '10', 'c');
  assert.deepEqual(events.at(-1), ['1', '10', true]);
  assert.equal(events.length, 3);
});

test('a socket that comes back inside the grace sends no events', (t) => {
  const { presence, events } = registry(t);
  presence.connect('1', '10', 'a');
  presence.disconnect('1', '10', 'a');
  t.mock.timers.tick(20_000);
  // The token expiry reconnect: a new socket id, well inside the grace.
  presence.connect('1', '10', 'b');
  t.mock.timers.tick(60_000);
  assert.equal(presence.isOnline('1', '10'), true);
  assert.deepEqual(events, [['1', '10', true]]);
  // And the grace starts over when that one closes.
  presence.disconnect('1', '10', 'b');
  t.mock.timers.tick(30_000);
  assert.equal(presence.isOnline('1', '10'), false);
});

test('people are tracked per company', (t) => {
  const { presence, events } = registry(t);
  presence.connect('2', '10', 'a');
  assert.equal(presence.isOnline('2', '10'), true);
  assert.equal(presence.isOnline('1', '10'), false);
  presence.disconnect('2', '10', 'a');
  presence.connect('1', '10', 'b');
  t.mock.timers.tick(30_000);
  // Company 2 went offline on its own; company 1 stays online.
  assert.deepEqual(events, [['2', '10', true], ['1', '10', true], ['2', '10', false]]);
  assert.equal(presence.isOnline('1', '10'), true);
});

test('dispose clears pending timers', (t) => {
  const { presence, events } = registry(t);
  presence.connect('1', '10', 'a');
  presence.disconnect('1', '10', 'a');
  presence.dispose();
  t.mock.timers.tick(60_000);
  assert.deepEqual(events, [['1', '10', true]]);
  assert.equal(presence.isOnline('1', '10'), false);
});

test('a custom grace period is used', (t) => {
  const { presence, events } = registry(t, 1_000);
  presence.connect('1', '10', 'a');
  presence.disconnect('1', '10', 'a');
  t.mock.timers.tick(1_000);
  assert.deepEqual(events.at(-1), ['1', '10', false]);
});

test('a pending offline timer does not keep the process alive', () => {
  // A person loses their last socket, and the process is left with nothing else to do: it must exit at once, not 30 s later.
  const script = `const { PresenceRegistry } = require(${JSON.stringify(join(__dirname, '../dist/modules/notifications/presence.registry'))});
    const presence = new PresenceRegistry(() => {});
    presence.connect('1', '10', 'a');
    presence.disconnect('1', '10', 'a');`;
  const started = Date.now();
  const result = spawnSync(process.execPath, ['-e', script], { timeout: 10_000 });
  assert.equal(result.status, 0, 'the process did not exit by itself');
  assert.ok(Date.now() - started < 10_000);
});

test('a listener that throws or rejects never breaks the registry or crashes the process', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const logged = t.mock.method(Logger.prototype, 'error', () => {});
  const unhandled = [];
  const record = (reason) => unhandled.push(reason);
  process.on('unhandledRejection', record);
  t.after(() => process.off('unhandledRejection', record));
  const modes = ['throw', 'reject'];
  const fail = (mode) => (mode === 'throw' ? () => { throw new Error('listener failed'); } : async () => { throw new Error('listener failed'); });
  for (const mode of modes) {
    const presence = new PresenceRegistry(fail(mode));
    t.after(() => presence.dispose());
    // Going online: the failure is logged, the person is still online.
    presence.connect('1', '10', 'a');
    assert.equal(presence.isOnline('1', '10'), true);
    // Going offline, inside the timer callback: the person is still forgotten.
    presence.disconnect('1', '10', 'a');
    t.mock.timers.tick(30_000);
    assert.equal(presence.isOnline('1', '10'), false);
  }
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(logged.mock.callCount(), 4);
  assert.deepEqual(unhandled, []);
});
