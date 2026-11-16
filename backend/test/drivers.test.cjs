const { test } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { DriversModule } = require('../dist/modules/drivers');
const { DriversRepository } = require('../dist/modules/drivers/drivers.repository');
const { hashPassword } = require('../dist/modules/users/password');
const { PASSWORD, as, createAuthApp, createFakeStore, tokenFor } = require('./helpers/auth-app.cjs');
const { createFakeDrivers } = require('./helpers/fake-drivers.cjs');

process.env.NODE_ENV = 'test';

const PERSONAL = ['nationalId', 'dateOfBirth', 'residentialAddress', 'emergencyContactName', 'emergencyContactPhone'];
const PAYROLL = ['baseSalary', 'bankName', 'bankAccountIban'];
const COMPLIANCE = [
  'licenseNumber', 'licenseClass', 'licenseExpiryDate', 'backgroundCheckPassed', 'backgroundCheckDate', 'transitInsurancePolicy',
  'transitInsuranceExpiry',
];
const EARNINGS = ['commissionPerDrop'];
const day = (offset) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);

function driverRow(id, organizationId, values = {}) {
  return {
    id, organizationId, employeeCode: `DRV-00${id}`, firstName: `First${id}`, lastName: `Last${id}`,
    personalMobile: `+962 7 9555 2${id}01`, personalEmail: `driver${id}@example.test`, nationalId: `NID-${id}`,
    dateOfBirth: '1990-01-01', residentialAddress: 'Home street', emergencyContactName: 'Contact', emergencyContactPhone: '+962 7 9555 9999',
    employmentClassification: 'full_time', compensationType: 'hybrid', employmentStatus: 'active', hireDate: `2025-0${id}-01`,
    terminationDate: null, baseSalary: '300.00', bankName: 'Arab Bank', bankAccountIban: `JO00${id}`, driverCategory: 'van',
    fleetArrangement: 'company_vehicle', assignedZone: 'East', maxWeightCapacityKg: '800.00', maxVolumeCapacityM3: '6.00',
    commissionPerDrop: '0.75', licenseNumber: `LIC-${id}`, licenseClass: 'C', licenseExpiryDate: day(400), backgroundCheckPassed: true,
    backgroundCheckDate: '2025-01-01', transitInsurancePolicy: null, transitInsuranceExpiry: null, dispatchStatus: 'available',
    lastLocationPing: null, account: null, createdAt: new Date('2025-01-01T00:00:00Z'), updatedAt: new Date('2026-10-01T00:00:00Z'),
    ...values,
  };
}

const newDriver = (values = {}) => ({
  employeeCode: ' drv-100 ', firstName: ' Hala ', lastName: 'Aziz', personalMobile: '+962 7 9000 1111', personalEmail: 'hala@mail.example.test',
  nationalId: '9900112233', dateOfBirth: '1995-04-02', residentialAddress: '1 Rainbow Street, Amman', emergencyContactName: 'Sami Aziz',
  emergencyContactPhone: '+962 7 9000 2222', employmentClassification: 'contractor', compensationType: 'commission_only',
  employmentStatus: 'active', hireDate: '2026-11-01', terminationDate: null, driverCategory: 'motorcycle', fleetArrangement: 'owner_operator',
  assignedZone: '', maxWeightCapacityKg: '40', maxVolumeCapacityM3: '0.2', commissionPerDrop: '1.5', licenseNumber: 'LIC-NEW',
  licenseClass: 'A', licenseExpiryDate: '2028-01-01', backgroundCheckPassed: false, backgroundCheckDate: '', transitInsurancePolicy: null,
  transitInsuranceExpiry: null, ...values,
});

// Meridian (company 1): yusuf is HR (everything), dana a dispatcher (drivers.view only), maya a fleet lead (compliance),
// rania finance (payroll and earnings, no drivers.manage), ivan manages drivers without payroll, omar sees no drivers.
// Harbor (company 2): karim is HR there.
async function driversApp(t) {
  const passwordHash = await hashPassword(PASSWORD);
  const store = createFakeStore();
  const drivers = createFakeDrivers();
  store.rolePermissions.set('1', new Set(['drivers.view', 'drivers.manage', 'drivers.view_compliance', 'drivers.view_earnings', 'staff.view_payroll']));
  store.rolePermissions.set('2', new Set(['drivers.view']));
  store.rolePermissions.set('3', new Set(['parcels.view']));
  store.rolePermissions.set('4', new Set(['drivers.view', 'drivers.view_compliance']));
  store.rolePermissions.set('5', new Set(['drivers.view', 'drivers.view_earnings', 'staff.view_payroll']));
  store.rolePermissions.set('6', new Set(['drivers.view', 'drivers.manage', 'drivers.view_compliance']));
  const people = [
    ['10', 'yusuf', '1', '1'], ['12', 'dana', '1', '2'], ['13', 'omar', '1', '3'], ['14', 'maya', '1', '4'], ['16', 'rania', '1', '5'],
    ['17', 'ivan', '1', '6'], ['15', 'karim', '2', '1'],
  ];
  for (const [id, username, organizationId, roleId] of people) {
    store.users.push({ id, username, email: `${username}@demo.example.test`, passwordHash, isActive: true, lastLoginAt: null });
    store.memberships.push({ organizationId, userId: id, roleId, isActive: true });
  }
  drivers.rows.push(
    driverRow('1', '1', { firstName: 'Leen', lastName: 'Mansour', assignedZone: 'East' }),
    driverRow('2', '1', { firstName: 'Samir', lastName: 'Farah', licenseExpiryDate: day(10), account: { userId: '20', username: 'samir.farah' } }),
    driverRow('3', '1', { firstName: 'Rami', lastName: 'Haddad', dispatchStatus: 'suspended', licenseExpiryDate: day(-5) }),
    driverRow('4', '1', { firstName: 'Gone', lastName: 'Away', employmentStatus: 'terminated', terminationDate: '2026-01-01', dispatchStatus: 'off_duty' }),
    driverRow('5', '2', { firstName: 'Tariq', lastName: 'Aziz' }),
  );
  drivers.accounts.push(
    { organizationId: '1', userId: '20', username: 'samir.farah' },
    { organizationId: '1', userId: '21', username: 'leen.mansour' },
    { organizationId: '2', userId: '22', username: 'harbor.rider' },
  );
  const { server } = await createAuthApp(t, store, { imports: [DriversModule], overrides: [[DriversRepository, drivers.repository]] });
  const tokens = {};
  for (const [, username] of people) tokens[username] = await tokenFor(server, username);
  return { server, store, drivers, tokens };
}

const hasAll = (driver, fields) => fields.every((field) => field in driver);
const hasNone = (driver, fields) => fields.every((field) => !(field in driver));

test('the driver list: by last name, company counts without terminated drivers, search, filters and paging', async (t) => {
  const { server, tokens } = await driversApp(t);
  const list = (await as(request(server).get('/api/drivers'), tokens.yusuf).expect(200)).body;
  assert.deepEqual(list.items.map((driver) => driver.lastName), ['Away', 'Farah', 'Haddad', 'Mansour']);
  assert.deepEqual([list.total, list.page, list.pageSize], [4, 1, 10]);
  assert.deepEqual(list.counts, { total: 3, available: 2, onRun: 0, offDuty: 0, suspended: 1, licensesExpiring: 2 });
  assert.equal(list.items[0].organizationId, undefined);

  const names = async (query) => (await as(request(server).get(`/api/drivers?${query}`), tokens.dana).expect(200)).body.items
    .map((driver) => driver.lastName);
  assert.deepEqual(await names('status=suspended'), ['Haddad']);
  assert.deepEqual(await names('search=samir farah'), ['Farah']);
  assert.deepEqual(await names('search=drv-001'), ['Mansour']);
  assert.deepEqual(await names('sort=hireDate&direction=desc'), ['Away', 'Haddad', 'Farah', 'Mansour']);
  for (const query of ['status=fired', 'sort=nationalId', 'pageSize=7', 'page=0', 'direction=up']) {
    await as(request(server).get(`/api/drivers?${query}`), tokens.dana).expect(400);
  }
  // Harbor sees only its own driver.
  const harbor = (await as(request(server).get('/api/drivers'), tokens.karim, '2').expect(200)).body;
  assert.deepEqual(harbor.items.map((driver) => driver.lastName), ['Aziz']);
});

test('each field group only for its permission; no drivers.view, no drivers', async (t) => {
  const { server, tokens } = await driversApp(t);
  const read = async (username) => (await as(request(server).get('/api/drivers/2'), tokens[username]).expect(200)).body;
  const hr = await read('yusuf');
  assert.ok(hasAll(hr, [...PERSONAL, ...PAYROLL, ...COMPLIANCE, ...EARNINGS]));
  assert.deepEqual(hr.account, { userId: '20', username: 'samir.farah' });
  const dispatcher = await read('dana');
  assert.ok(hasNone(dispatcher, [...PERSONAL, ...PAYROLL, ...COMPLIANCE, ...EARNINGS]));
  assert.equal(dispatcher.personalMobile, '+962 7 9555 2201');
  const fleet = await read('maya');
  assert.ok(hasAll(fleet, COMPLIANCE) && hasNone(fleet, [...PERSONAL, ...PAYROLL, ...EARNINGS]));
  const finance = await read('rania');
  assert.ok(hasAll(finance, [...PAYROLL, ...EARNINGS]) && hasNone(finance, [...PERSONAL, ...COMPLIANCE]));
  const listed = (await as(request(server).get('/api/drivers'), tokens.dana).expect(200)).body.items;
  assert.ok(listed.every((driver) => hasNone(driver, [...PERSONAL, ...PAYROLL, ...COMPLIANCE, ...EARNINGS])));

  for (const path of ['/api/drivers', '/api/drivers/1', '/api/drivers/choices']) await as(request(server).get(path), tokens.omar).expect(403);
  await as(request(server).get('/api/drivers/linkable-accounts'), tokens.dana).expect(403);
  await as(request(server).post('/api/drivers').send(newDriver()), tokens.rania).expect(403);
  await as(request(server).patch('/api/drivers/1').send({ assignedZone: 'West' }), tokens.dana).expect(403);
  await as(request(server).patch('/api/drivers/1/duty-status').send({ dispatchStatus: 'off_duty' }), tokens.maya).expect(403);
  await as(request(server).put('/api/drivers/1/account').send({ userId: '21' }), tokens.dana).expect(403);
});

test('another company\'s driver, an unknown id and a malformed id are all simply not found', async (t) => {
  const { server, tokens } = await driversApp(t);
  for (const id of ['5', '99', 'abc', '0']) {
    assert.equal((await as(request(server).get(`/api/drivers/${id}`), tokens.yusuf).expect(404)).body.code, 'DRIVER_NOT_FOUND');
  }
  await as(request(server).patch('/api/drivers/5').send({ assignedZone: 'Taken over' }), tokens.yusuf).expect(404);
  await as(request(server).patch('/api/drivers/5/duty-status').send({ dispatchStatus: 'off_duty' }), tokens.yusuf).expect(404);
  await as(request(server).put('/api/drivers/5/account').send({ userId: null }), tokens.yusuf).expect(404);
});

test('choices: everyone still employed; linkable accounts: the company\'s unlinked driver accounts', async (t) => {
  const { server, tokens } = await driversApp(t);
  const choices = (await as(request(server).get('/api/drivers/choices'), tokens.dana).expect(200)).body;
  assert.deepEqual(choices, [
    { id: '2', name: 'Samir Farah', employeeCode: 'DRV-002' },
    { id: '3', name: 'Rami Haddad', employeeCode: 'DRV-003' },
    { id: '1', name: 'Leen Mansour', employeeCode: 'DRV-001' },
  ]);
  const linkable = (await as(request(server).get('/api/drivers/linkable-accounts'), tokens.yusuf).expect(200)).body;
  assert.deepEqual(linkable, [{ userId: '21', username: 'leen.mansour' }]);
});

test('onboarding a driver: cleaned values, off duty, payroll only with staff.view_payroll, audited', async (t) => {
  const { server, store, tokens } = await driversApp(t);
  const created = (await as(request(server).post('/api/drivers').send(newDriver({ baseSalary: '250', bankName: 'Arab Bank' })), tokens.yusuf)
    .expect(201)).body;
  assert.deepEqual([created.employeeCode, created.firstName, created.assignedZone, created.backgroundCheckDate], ['DRV-100', 'Hala', null, null]);
  assert.deepEqual(
    [created.maxWeightCapacityKg, created.maxVolumeCapacityM3, created.commissionPerDrop, created.baseSalary],
    ['40.00', '0.20', '1.50', '250.00'],
  );
  assert.deepEqual([created.dispatchStatus, created.account, created.bankAccountIban], ['off_duty', null, null]);
  const entry = store.auditEntries.at(-1);
  assert.deepEqual(
    [entry.module, entry.action, entry.resourceType, entry.recordId, entry.resourceLabel, entry.actorId, entry.before],
    ['drivers', 'create', 'driver', created.id, 'DRV-100', '10', null],
  );
  // "pass" reads as a secret to the audit rules, so the background check is stored under another name.
  assert.equal(entry.after.backgroundCheck, false);
  assert.equal('backgroundCheckPassed' in entry.after, false);

  // Ivan manages drivers but not payroll: without pay fields the driver is saved with no salary; with them, refused.
  const plain = (await as(request(server).post('/api/drivers').send(newDriver({ employeeCode: 'DRV-101', licenseNumber: 'LIC-101' })), tokens.ivan)
    .expect(201)).body;
  assert.ok(hasNone(plain, PAYROLL));
  const refused = await as(request(server).post('/api/drivers').send(newDriver({ employeeCode: 'DRV-102', licenseNumber: 'LIC-102', bankName: 'X' })), tokens.ivan)
    .expect(403);
  assert.equal(refused.body.code, 'DRIVER_PAYROLL_FORBIDDEN');

  assert.equal((await as(request(server).post('/api/drivers').send(newDriver({ employeeCode: 'DRV-001', licenseNumber: 'LIC-X' })), tokens.yusuf)
    .expect(409)).body.code, 'EMPLOYEE_CODE_TAKEN');
  assert.equal((await as(request(server).post('/api/drivers').send(newDriver({ employeeCode: 'DRV-103', licenseNumber: 'LIC-1' })), tokens.yusuf)
    .expect(409)).body.code, 'LICENSE_NUMBER_TAKEN');
  // Another company may use the same code and license number.
  await as(request(server).post('/api/drivers').send(newDriver({ employeeCode: 'DRV-001', licenseNumber: 'LIC-1' })), tokens.karim, '2').expect(201);
  const terminated = await as(request(server).post('/api/drivers').send(newDriver({ employeeCode: 'DRV-104', employmentStatus: 'terminated' })), tokens.yusuf)
    .expect(400);
  assert.equal(terminated.body.code, 'DRIVER_TERMINATION_DATE_REQUIRED');
});

test('a new driver is validated like the form', async (t) => {
  const { server, tokens } = await driversApp(t);
  const invalid = [
    { employeeCode: 'D' }, { firstName: '  ' }, { personalMobile: 'call me' }, { personalEmail: 'nope' }, { dateOfBirth: '1995-02-30' },
    { hireDate: '01/11/2026' }, { driverCategory: 'rocket' }, { maxWeightCapacityKg: '-1' }, { commissionPerDrop: '1.234' },
    { licenseNumber: undefined }, { backgroundCheckPassed: 'yes' }, { organizationId: '2' }, { dispatchStatus: 'available' },
  ];
  for (const values of invalid) {
    await as(request(server).post('/api/drivers').send(newDriver(values)), tokens.yusuf).expect(400);
  }
});

test('editing a driver saves what changed; ending employment takes them off duty', async (t) => {
  const { server, store, tokens } = await driversApp(t);
  const edited = (await as(request(server).patch('/api/drivers/1').send({ assignedZone: ' North ', commissionPerDrop: '0.9', maxWeightCapacityKg: '800' }), tokens.yusuf)
    .expect(200)).body;
  assert.deepEqual([edited.assignedZone, edited.commissionPerDrop, edited.maxWeightCapacityKg], ['North', '0.90', '800.00']);
  const entry = store.auditEntries.at(-1);
  // 800 is the saved 800.00, so it isn't a change.
  assert.deepEqual([entry.action, entry.before.assignedZone, entry.after.assignedZone], ['update', 'East', 'North']);
  assert.equal(entry.after.maxWeightCapacityKg, entry.before.maxWeightCapacityKg);

  const missingDate = await as(request(server).patch('/api/drivers/1').send({ employmentStatus: 'terminated' }), tokens.yusuf).expect(400);
  assert.equal(missingDate.body.code, 'DRIVER_TERMINATION_DATE_REQUIRED');
  const ended = (await as(request(server).patch('/api/drivers/1').send({ employmentStatus: 'terminated', terminationDate: '2026-11-04' }), tokens.yusuf)
    .expect(200)).body;
  assert.deepEqual([ended.employmentStatus, ended.dispatchStatus], ['terminated', 'off_duty']);

  assert.equal((await as(request(server).patch('/api/drivers/2').send({ baseSalary: '1' }), tokens.ivan).expect(403)).body.code, 'DRIVER_PAYROLL_FORBIDDEN');
  assert.equal((await as(request(server).patch('/api/drivers/2').send({ licenseNumber: 'LIC-3' }), tokens.yusuf).expect(409)).body.code, 'LICENSE_NUMBER_TAKEN');
  for (const values of [{ firstName: null }, { hireDate: null }, { dispatchStatus: 'available' }, { account: null }]) {
    await as(request(server).patch('/api/drivers/2').send(values), tokens.yusuf).expect(400);
  }
});

test('the duty status by hand: available, off duty or suspended; never for a terminated driver', async (t) => {
  const { server, store, tokens } = await driversApp(t);
  const off = (await as(request(server).patch('/api/drivers/1/duty-status').send({ dispatchStatus: 'off_duty' }), tokens.yusuf).expect(200)).body;
  assert.equal(off.dispatchStatus, 'off_duty');
  const entry = store.auditEntries.at(-1);
  assert.deepEqual([entry.action, entry.before, entry.after], ['status_change', { dispatchStatus: 'available' }, { dispatchStatus: 'off_duty' }]);
  for (const dispatchStatus of ['on_pickup', 'out_for_delivery', 'lunch', undefined]) {
    await as(request(server).patch('/api/drivers/1/duty-status').send({ dispatchStatus }), tokens.yusuf).expect(400);
  }
  const terminated = await as(request(server).patch('/api/drivers/4/duty-status').send({ dispatchStatus: 'available' }), tokens.yusuf).expect(409);
  assert.equal(terminated.body.code, 'DRIVER_TERMINATED');
});

test('linking an account: only the company\'s unlinked driver accounts, unlinking with null, audited', async (t) => {
  const { server, store, tokens } = await driversApp(t);
  const linked = (await as(request(server).put('/api/drivers/1/account').send({ userId: '21' }), tokens.yusuf).expect(200)).body;
  assert.deepEqual(linked.account, { userId: '21', username: 'leen.mansour' });
  let entry = store.auditEntries.at(-1);
  assert.deepEqual([entry.action, entry.before, entry.after], ['assign', { account: null }, { account: { userId: '21', username: 'leen.mansour' } }]);

  assert.equal((await as(request(server).put('/api/drivers/3/account').send({ userId: '20' }), tokens.yusuf).expect(409)).body.code, 'ACCOUNT_ALREADY_LINKED');
  // Harbor's account, or one without the driver role, can't be linked.
  for (const userId of ['22', '12']) {
    assert.equal((await as(request(server).put('/api/drivers/3/account').send({ userId }), tokens.yusuf).expect(400)).body.code, 'ACCOUNT_NOT_LINKABLE');
  }
  for (const body of [{}, { userId: 'abc' }, { userId: 21 }]) {
    await as(request(server).put('/api/drivers/3/account').send(body), tokens.yusuf).expect(400);
  }
  const unlinked = (await as(request(server).put('/api/drivers/1/account').send({ userId: null }), tokens.yusuf).expect(200)).body;
  assert.equal(unlinked.account, null);
  entry = store.auditEntries.at(-1);
  assert.equal(entry.action, 'revoke');
});
