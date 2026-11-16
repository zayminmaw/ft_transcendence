const { after, before, test } = require('node:test');
const assert = require('node:assert/strict');
const { createTestDatabase } = require('./test-database.cjs');
const { recordAudit } = require('../../dist/modules/audit');
const { AuditLog } = require('../../dist/modules/audit/entities/audit-log.entity');
const { DriversRepository } = require('../../dist/modules/drivers/drivers.repository');
const { Employee } = require('../../dist/modules/drivers/entities/employee.entity');
const { Organization } = require('../../dist/modules/organizations/entities/organization.entity');
const { OrganizationMember } = require('../../dist/modules/organizations/entities/organization-member.entity');
const { Role } = require('../../dist/modules/rbac/entities/role.entity');
const { User } = require('../../dist/modules/users/entities/user.entity');

let database;
let drivers;
let meridian;
let harbor;
const accounts = {};
before(async () => {
  database = await createTestDatabase();
  drivers = new DriversRepository(database);
  const organizations = database.getRepository(Organization);
  meridian = (await organizations.save({ name: 'Drivers Meridian', slug: 'drivers-meridian', contactEmail: 'ops@meridian.db.test' })).id;
  harbor = (await organizations.save({ name: 'Drivers Harbor', slug: 'drivers-harbor', contactEmail: 'ops@harbor.db.test' })).id;
  const roles = Object.fromEntries((await database.getRepository(Role).find()).map((role) => [role.code, role.id]));
  // rider1 and rider2 have the driver role at Meridian (rider2 also at Harbor); clerk is a dispatcher; gone left Meridian.
  const people = [
    ['rider1', [[meridian, 'driver']]], ['rider2', [[meridian, 'driver'], [harbor, 'driver']]], ['clerk', [[meridian, 'dispatcher']]],
    ['gone', [[meridian, 'driver', false]]],
  ];
  for (const [username, memberships] of people) {
    const user = await database.getRepository(User).save({ username, email: `${username}@drivers.db.test`, passwordHash: 'x' });
    accounts[username] = user.id;
    for (const [organizationId, role, isActive = true] of memberships) {
      await database.getRepository(OrganizationMember).insert({ organizationId, userId: user.id, roleId: roles[role], isActive });
    }
  }
});
after(() => database?.destroy());

const day = (offset) => {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};
const values = (code, lastName, extra = {}) => ({
  employeeCode: code, firstName: 'Test', lastName, personalMobile: '+962 7 9000 0000', personalEmail: `${code.toLowerCase()}@drivers.db.test`,
  nationalId: `NID-${code}`, dateOfBirth: '1990-05-01', residentialAddress: 'Home street', emergencyContactName: 'Contact',
  emergencyContactPhone: '+962 7 9000 0001', employmentClassification: 'full_time', compensationType: 'hybrid', employmentStatus: 'active',
  hireDate: '2025-01-01', terminationDate: null, baseSalary: '300.00', bankName: null, bankAccountIban: null, driverCategory: 'van',
  fleetArrangement: 'company_vehicle', assignedZone: null, maxWeightCapacityKg: '800.00', maxVolumeCapacityM3: '6.00',
  commissionPerDrop: '0.75', licenseNumber: `LIC-${code}`, licenseClass: 'C', licenseExpiryDate: day(400), backgroundCheckPassed: false,
  backgroundCheckDate: null, transitInsurancePolicy: null, transitInsuranceExpiry: null, ...extra,
});
const noAudit = async () => {};
const query = (extra = {}) => ({ status: 'all', sort: 'lastName', direction: 'asc', page: 1, pageSize: 10, ...extra });

async function create(organizationId, code, lastName, extra) {
  const result = await drivers.create(organizationId, values(code, lastName, extra), noAudit);
  assert.equal(result.status, 'created');
  return result.driver;
}

test('a new driver is an employee and a courier row of the same company, off duty, without an account', async () => {
  const driver = await create(meridian, 'DB-001', 'Mansour', { assignedZone: 'East 100%' });
  assert.deepEqual(
    [driver.dispatchStatus, driver.account, driver.dateOfBirth, driver.licenseExpiryDate, driver.backgroundCheckPassed, driver.maxVolumeCapacityM3],
    ['off_duty', null, '1990-05-01', day(400), false, '6.00'],
  );
  assert.ok(driver.createdAt instanceof Date);
  const [row] = await database.query(
    `SELECT employee.personnel_type AS type, employee.department, driver.organization_id AS company FROM employees employee
       JOIN delivery_drivers driver ON driver.employee_id = employee.id WHERE employee.id = ?`,
    [driver.id],
  );
  assert.deepEqual([row.type, row.department, String(row.company)], ['driver', 'field_logistics', meridian]);
});

test('the employee code and license number are unique per company, also under a race', async () => {
  assert.deepEqual(await drivers.create(meridian, values('DB-001', 'Again', { licenseNumber: 'LIC-OTHER' }), noAudit), { status: 'code_taken' });
  assert.deepEqual(await drivers.create(meridian, values('DB-009', 'Again', { licenseNumber: 'LIC-DB-001' }), noAudit), { status: 'license_taken' });
  // A refused license leaves no half-made employee behind.
  assert.equal(await database.getRepository(Employee).countBy({ organizationId: meridian, employeeCode: 'DB-009' }), 0);
  const raced = await Promise.all([1, 2].map((n) => drivers.create(meridian, values(`DB-RACE${n}`, 'Race', { licenseNumber: 'LIC-RACE' }), noAudit)));
  assert.deepEqual(raced.map((result) => result.status).sort(), ['created', 'license_taken']);
  // Another company may use the same code and license number.
  await create(harbor, 'DB-001', 'Aziz', { licenseNumber: 'LIC-DB-001' });
});

test('the courier row always belongs to its employee\'s company', async () => {
  const [employee] = await database.query('SELECT id FROM employees WHERE organization_id = ? LIMIT 1', [harbor]);
  await assert.rejects(database.query('UPDATE delivery_drivers SET organization_id = ? WHERE employee_id = ?', [meridian, employee.id]));
});

test('the list searches, filters, sorts and pages within one company; the counts leave out terminated drivers', async () => {
  await create(meridian, 'DB-002', 'Farah', { firstName: 'Samir', licenseExpiryDate: day(10), hireDate: '2025-06-01' });
  await create(meridian, 'DB-003', 'Haddad', { licenseExpiryDate: day(-3), hireDate: '2024-01-01' });
  const farah = (await drivers.list(meridian, query({ search: 'Farah' }))).items[0];
  await drivers.update(meridian, farah.id, { dispatchStatus: 'available' }, noAudit);
  const race = (await drivers.list(meridian, query({ search: 'Race' }))).items[0];
  await drivers.update(meridian, race.id, { employmentStatus: 'terminated', terminationDate: '2026-01-01', licenseExpiryDate: day(-30) }, noAudit);

  const names = async (extra) => (await drivers.list(meridian, query(extra))).items.map((driver) => driver.lastName);
  assert.deepEqual(await names({}), ['Farah', 'Haddad', 'Mansour', 'Race']);
  assert.deepEqual(await names({ status: 'available' }), ['Farah']);
  assert.deepEqual(await names({ sort: 'hireDate', direction: 'desc' }), ['Farah', 'Race', 'Mansour', 'Haddad']);
  assert.deepEqual(await names({ sort: 'employeeCode' }), ['Mansour', 'Farah', 'Haddad', 'Race']);
  assert.deepEqual(await names({ search: 'samir farah' }), ['Farah']);
  assert.deepEqual(await names({ search: 'db-003' }), ['Haddad']);
  // A wildcard typed in the search is a plain character.
  assert.deepEqual(await names({ search: '100%' }), ['Mansour']);
  assert.deepEqual(await names({ search: '_' }), []);
  assert.deepEqual(await names({ search: 'Aziz' }), []);
  const pages = await Promise.all([1, 2].map((page) => drivers.list(meridian, query({ pageSize: 10, page }))));
  assert.deepEqual(pages.map(({ items, total }) => [items.length, total]), [[4, 4], [0, 4]]);

  assert.deepEqual(await drivers.counts(meridian), { total: 3, available: 1, onRun: 0, offDuty: 2, suspended: 0, licensesExpiring: 2 });
  assert.deepEqual(await drivers.counts(harbor), { total: 1, available: 0, onRun: 0, offDuty: 1, suspended: 0, licensesExpiring: 0 });
  assert.deepEqual((await drivers.choices(meridian)).map((choice) => choice.name), ['Samir Farah', 'Test Haddad', 'Test Mansour']);
});

test('changes stay inside the company, save only what changed, follow the termination rules, and roll back with a failed audit', async () => {
  const mansour = (await drivers.list(meridian, query({ search: 'Mansour' }))).items[0];
  const harborDriver = (await drivers.list(harbor, query())).items[0];
  assert.equal(await drivers.find(meridian, harborDriver.id), null);
  assert.deepEqual(await drivers.update(meridian, harborDriver.id, { lastName: 'Taken over' }, noAudit), { status: 'not_found' });
  assert.deepEqual(await drivers.linkAccount(meridian, harborDriver.id, null, noAudit), { status: 'not_found' });

  assert.equal((await drivers.update(meridian, mansour.id, { lastName: 'Mansour', maxWeightCapacityKg: '800.00' }, noAudit)).status, 'unchanged');
  assert.deepEqual(await drivers.update(meridian, mansour.id, { employeeCode: 'DB-002' }, noAudit), { status: 'code_taken' });
  assert.deepEqual(await drivers.update(meridian, mansour.id, { licenseNumber: 'LIC-DB-002' }, noAudit), { status: 'license_taken' });
  assert.deepEqual(await drivers.update(meridian, mansour.id, { employmentStatus: 'terminated' }, noAudit), { status: 'termination_date_required' });

  // A courier field alone still moves updated_at.
  const zoned = await drivers.update(meridian, mansour.id, { assignedZone: 'North' }, noAudit);
  assert.equal(zoned.driver.assignedZone, 'North');
  assert.ok(zoned.driver.updatedAt >= mansour.updatedAt);

  const audited = [];
  const updated = await drivers.update(meridian, mansour.id, { firstName: 'Leen', licenseClass: 'D' }, async (manager, old, saved) => {
    audited.push([old.firstName, saved.firstName, saved.licenseClass]);
    await recordAudit(manager, {
      module: 'drivers', action: 'update', resourceType: 'driver', recordId: saved.id, organizationId: meridian, before: old, after: saved,
    });
  });
  assert.deepEqual(audited, [['Test', 'Leen', 'D']]);
  assert.equal(updated.status, 'updated');

  const failing = async () => { throw new Error('audit down'); };
  await assert.rejects(drivers.update(meridian, mansour.id, { firstName: 'Lost', assignedZone: 'Lost' }, failing), /audit down/);
  const kept = await drivers.find(meridian, mansour.id);
  assert.deepEqual([kept.firstName, kept.assignedZone], ['Leen', 'North']);
  await assert.rejects(drivers.create(meridian, values('DB-LOST', 'Lost'), failing), /audit down/);
  assert.equal(await database.getRepository(Employee).countBy({ employeeCode: 'DB-LOST' }), 0);
  assert.equal(await database.getRepository(AuditLog).countBy({ resourceType: 'driver', recordId: mansour.id }), 1);

  const farah = (await drivers.list(meridian, query({ search: 'Farah' }))).items[0];
  const ended = await drivers.update(meridian, farah.id, { employmentStatus: 'terminated', terminationDate: '2026-11-01' }, noAudit);
  assert.deepEqual([ended.driver.employmentStatus, ended.driver.dispatchStatus], ['terminated', 'off_duty']);
  assert.deepEqual(await drivers.update(meridian, farah.id, { dispatchStatus: 'available' }, noAudit), { status: 'terminated' });
});

test('an account links to one driver per company, only as an active driver-role member', async () => {
  const haddad = (await drivers.list(meridian, query({ search: 'Haddad' }))).items[0];
  const mansour = (await drivers.list(meridian, query({ search: 'Mansour' }))).items[0];
  const harborDriver = (await drivers.list(harbor, query())).items[0];
  assert.deepEqual(
    (await drivers.linkableAccounts(meridian)).map((account) => account.username),
    ['rider1', 'rider2'],
  );

  for (const username of ['clerk', 'gone']) {
    assert.deepEqual(await drivers.linkAccount(meridian, haddad.id, accounts[username], noAudit), { status: 'account_not_linkable' });
  }
  const linked = await drivers.linkAccount(meridian, haddad.id, accounts.rider2, noAudit);
  assert.deepEqual(linked.driver.account, { userId: accounts.rider2, username: 'rider2' });
  assert.equal((await drivers.linkAccount(meridian, haddad.id, accounts.rider2, noAudit)).status, 'unchanged');
  assert.deepEqual(await drivers.linkAccount(meridian, mansour.id, accounts.rider2, noAudit), { status: 'account_taken' });
  assert.deepEqual((await drivers.linkableAccounts(meridian)).map((account) => account.username), ['rider1']);
  // The same account may also drive for another company.
  assert.equal((await drivers.linkAccount(harbor, harborDriver.id, accounts.rider2, noAudit)).status, 'updated');
  // Two drivers taking the same account at once: the unique key stops the second.
  const raced = await Promise.all([haddad.id, mansour.id].map((id) => drivers.linkAccount(meridian, id, accounts.rider1, noAudit)));
  assert.equal(raced.filter((result) => result.status === 'account_taken').length, 1);

  const unlinked = await drivers.linkAccount(meridian, haddad.id, null, noAudit);
  assert.equal(unlinked.driver.account, null);
});
