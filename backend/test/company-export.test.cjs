const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Global, Module } = require('@nestjs/common');
const request = require('supertest');
const { hashPassword } = require('../dist/modules/users/password');
const { AUDIT_RESOURCES } = require('../dist/modules/audit/audit-resources');
const {
  CompanyExportModule,
  CompanyExportRepository,
  EXPORT_NOW,
  formatCsvCell,
  neutralizeFormula,
} = require('../dist/modules/export');
const { createAuthApp, createFakeStore, as, tokenFor, PASSWORD } = require('./helpers/auth-app.cjs');

process.env.NODE_ENV = 'test';

const FIXED_NOW = new Date('2026-11-26T14:30:00.000Z');

// Company 1 (Meridian Courier) and Company 2 (Harbor Express) fixture datasets.
function createExportFixtures() {
  return {
    organizations: [
      {
        id: '1',
        name: 'Meridian Courier',
        slug: 'meridian-courier',
        contactEmail: 'ops@meridian.example.test',
        contactPhone: '+15550101',
        address: '100 Meridian Way',
        isActive: true,
        createdAt: '2026-01-10T00:00:00.000Z',
      },
      {
        id: '2',
        name: 'Harbor Express',
        slug: 'harbor-express',
        contactEmail: 'ops@harbor.example.test',
        contactPhone: '+15550202',
        address: '200 Harbor Pier',
        isActive: true,
        createdAt: '2026-02-15T00:00:00.000Z',
      },
    ],
    members: {
      1: [
        {
          userId: '10',
          username: 'meridian_admin',
          email: 'admin@meridian.example.test',
          displayName: 'Lina Admin',
          roleCode: 'org_admin',
          roleName: 'Tenant Admin',
          isActive: true,
          lastLoginAt: '2026-11-25T10:00:00.000Z',
          // Extra secret fields simulated to prove service projection strips them even if present.
          passwordHash: '$2b$12$SECRET_HASH_MUST_NEVER_LEAK',
          refreshTokenHash: 'SECRET_REFRESH_HASH',
          inviteTokenHash: 'SECRET_INVITE_HASH',
        },
        {
          userId: '11',
          username: 'meridian_disp',
          email: 'disp@meridian.example.test',
          displayName: null,
          roleCode: 'dispatcher',
          roleName: 'Dispatcher',
          isActive: true,
          lastLoginAt: null,
        },
      ],
      2: [
        {
          userId: '20',
          username: 'harbor_admin',
          email: 'admin@harbor.example.test',
          displayName: 'Karim Harbor',
          roleCode: 'org_admin',
          roleName: 'Tenant Admin',
          isActive: true,
          lastLoginAt: '2026-11-24T09:00:00.000Z',
        },
      ],
    },
    clients: {
      1: [
        {
          id: '101',
          clientCode: 'MRD-01',
          businessName: '=CMD() "Acme, Inc."',
          tradeLicenseNo: 'TL-1001',
          contactPersonName: '+John Formula',
          contactTitle: 'Owner',
          mobile1: '+15551111',
          mobile2: null,
          email: 'acme@meridian.example.test',
          billingAddress: '10 Market St',
          defaultPickupAddress: '10 Market St',
          rateProfileTier: 'standard',
          currentBalance: '250.00',
          pendingCodBalance: '45.50',
          isActive: true,
          createdAt: '2026-03-01T00:00:00.000Z',
        },
      ],
      2: [
        {
          id: '201',
          clientCode: 'HBR-99',
          businessName: 'Harbor Secret Merchant',
          tradeLicenseNo: 'TL-9999',
          contactPersonName: 'Nadia Harbor',
          contactTitle: 'Director',
          mobile1: '+15559999',
          mobile2: null,
          email: 'secret@harbor.example.test',
          billingAddress: '99 Dock Rd',
          defaultPickupAddress: '99 Dock Rd',
          rateProfileTier: 'vip',
          currentBalance: '9999.00',
          pendingCodBalance: '0.00',
          isActive: true,
          createdAt: '2026-03-05T00:00:00.000Z',
        },
      ],
    },
    drivers: {
      1: [
        {
          employeeId: '301',
          employeeCode: 'DRV-001',
          firstName: 'Omar',
          lastName: 'Rashed',
          employmentStatus: 'active',
          hireDate: '2025-06-01',
          driverCategory: 'van',
          fleetArrangement: 'company_vehicle',
          assignedZone: 'North',
          dispatchStatus: 'available',
          maxWeightCapacityKg: '500.00',
          maxVolumeCapacityM3: '4.50',
          licenseNumber: 'LIC-111',
          licenseClass: 'B',
          licenseExpiryDate: '2028-06-01',
          backgroundCheckPassed: true,
          backgroundCheckDate: '2025-05-15',
          transitInsurancePolicy: 'INS-100',
          transitInsuranceExpiry: '2027-06-01',
        },
      ],
      2: [
        {
          employeeId: '401',
          employeeCode: 'HBR-DRV-1',
          firstName: 'Harbor',
          lastName: 'Courier',
          employmentStatus: 'active',
          hireDate: '2025-07-01',
          driverCategory: 'motorcycle',
          fleetArrangement: 'owner_operator',
          assignedZone: 'Port',
          dispatchStatus: 'off_duty',
          maxWeightCapacityKg: '40.00',
          maxVolumeCapacityM3: '0.40',
          licenseNumber: 'LIC-999',
          licenseClass: 'A',
          licenseExpiryDate: '2028-07-01',
          backgroundCheckPassed: true,
          backgroundCheckDate: '2025-06-20',
          transitInsurancePolicy: null,
          transitInsuranceExpiry: null,
        },
      ],
    },
    assets: {
      1: [
        {
          id: '501',
          assetTag: 'VAN-01',
          assetName: 'Sprinter Alpha',
          category: 'van',
          licensePlate: 'MRD-123',
          vin: 'VIN123456789',
          insurancePolicyNumber: 'POL-501',
          roadTaxExpiry: '2027-01-01',
          currentCondition: 'good',
          acquisitionCost: '35000.00',
          currentBookValue: '28000.00',
          createdAt: '2025-08-01T00:00:00.000Z',
        },
      ],
      2: [
        {
          id: '601',
          assetTag: 'HBR-VAN-9',
          assetName: 'Harbor Truck',
          category: 'heavy_truck',
          licensePlate: 'HBR-999',
          vin: 'VIN999999999',
          insurancePolicyNumber: 'POL-601',
          roadTaxExpiry: '2027-02-01',
          currentCondition: 'good',
          acquisitionCost: '80000.00',
          currentBookValue: '75000.00',
          createdAt: '2025-09-01T00:00:00.000Z',
        },
      ],
    },
    parcels: {
      1: [
        {
          id: '701',
          trackingNumber: 'TRC-MERIDIAN01',
          status: 'delivered',
          clientCode: 'MRD-01',
          clientName: '=CMD() "Acme, Inc."',
          recipientName: '@SUM(A1:A2)',
          recipientPhone: '+15553333',
          deliveryCityZone: 'Downtown',
          weightKg: '2.50',
          isFragile: true,
          deliveryFee: '12.00',
          codAmount: '100.00',
          collectedAmount: '100.00',
          deliveryAttemptCount: 1,
          deliveredAt: '2026-11-20T12:00:00.000Z',
          createdAt: '2026-11-19T08:00:00.000Z',
        },
      ],
      2: [
        {
          id: '801',
          trackingNumber: 'TRC-HARBOR9999',
          status: 'in_hub_sorted',
          clientCode: 'HBR-99',
          clientName: 'Harbor Secret Merchant',
          recipientName: 'Harbor Recipient',
          recipientPhone: '+15558888',
          deliveryCityZone: 'Dockside',
          weightKg: '1.00',
          isFragile: false,
          deliveryFee: '9.00',
          codAmount: '0.00',
          collectedAmount: null,
          deliveryAttemptCount: 0,
          deliveredAt: null,
          createdAt: '2026-11-21T08:00:00.000Z',
        },
      ],
    },
    invoices: {
      1: [
        {
          id: '901',
          invoiceNumber: 'INV-1-000901',
          clientCode: 'MRD-01',
          clientName: '=CMD() "Acme, Inc."',
          status: 'issued',
          billingPeriodStart: '2026-11-01',
          billingPeriodEnd: '2026-11-15',
          issueDate: '2026-11-16',
          dueDate: '2026-11-30',
          totalDeliveries: 10,
          totalDeliveryFees: '120.00',
          totalCodCollected: '500.00',
          netAmountDue: '120.00',
          createdAt: '2026-11-16T09:00:00.000Z',
        },
      ],
      2: [
        {
          id: '902',
          invoiceNumber: 'INV-2-000902',
          clientCode: 'HBR-99',
          clientName: 'Harbor Secret Merchant',
          status: 'draft',
          billingPeriodStart: '2026-11-01',
          billingPeriodEnd: '2026-11-15',
          issueDate: '2026-11-16',
          dueDate: '2026-11-30',
          totalDeliveries: 3,
          totalDeliveryFees: '27.00',
          totalCodCollected: '0.00',
          netAmountDue: '27.00',
          createdAt: '2026-11-16T10:00:00.000Z',
        },
      ],
    },
  };
}

function createFakeExportRepository(fixtures) {
  const calls = [];
  return {
    calls,
    findOrganization: async (organizationId) => {
      calls.push(['organization', organizationId]);
      return fixtures.organizations.find((org) => org.id === organizationId) ?? null;
    },
    listMembers: async (organizationId) => {
      calls.push(['members', organizationId]);
      return fixtures.members[organizationId] ?? [];
    },
    listClients: async (organizationId) => {
      calls.push(['clients', organizationId]);
      return fixtures.clients[organizationId] ?? [];
    },
    listDrivers: async (organizationId) => {
      calls.push(['drivers', organizationId]);
      return fixtures.drivers[organizationId] ?? [];
    },
    listAssets: async (organizationId) => {
      calls.push(['assets', organizationId]);
      return fixtures.assets[organizationId] ?? [];
    },
    listParcels: async (organizationId) => {
      calls.push(['parcels', organizationId]);
      return fixtures.parcels[organizationId] ?? [];
    },
    listInvoices: async (organizationId) => {
      calls.push(['invoices', organizationId]);
      return fixtures.invoices[organizationId] ?? [];
    },
  };
}

// Mirrors Transcend's RBAC matrix: only org_admin holds admin.manage_users.
async function exportApp(t) {
  const passwordHash = await hashPassword(PASSWORD);
  const store = createFakeStore();
  const fixtures = createExportFixtures();
  const exportRepo = createFakeExportRepository(fixtures);

  store.rolePermissions.set('1', new Set(['admin.manage_users', 'admin.manage_roles', 'admin.audit_logs'])); // org_admin
  store.rolePermissions.set('2', new Set(['clients.view', 'parcels.view', 'parcels.dispatch', 'drivers.view', 'assets.view'])); // dispatcher
  store.rolePermissions.set('3', new Set(['parcels.view', 'parcels.update_status'])); // hub_sorter
  store.rolePermissions.set('4', new Set(['clients.view_financials', 'billing.view', 'billing.export', 'admin.audit_logs'])); // finance
  store.rolePermissions.set('5', new Set(['staff.view', 'staff.manage', 'drivers.view', 'drivers.manage'])); // hr_manager
  store.rolePermissions.set('6', new Set(['drivers.view', 'assets.view', 'assets.create'])); // fleet_lead
  store.assignedRolePermissions.set('7', new Set(['parcels.view', 'parcels.mark_delivered', 'drivers.view_earnings'])); // driver

  const users = [
    ['10', 'meridian_admin', '1', '1'],
    ['11', 'dispatcher_user', '1', '2'],
    ['12', 'sorter_user', '1', '3'],
    ['13', 'finance_user', '1', '4'],
    ['14', 'hr_user', '1', '5'],
    ['15', 'fleet_user', '1', '6'],
    ['16', 'driver_user', '1', '7'],
    ['20', 'harbor_admin', '2', '1'],
    ['30', 'platform_only', null, null],
  ];

  for (const [id, username, organizationId, roleId] of users) {
    store.users.push({ id, username, email: `${username}@demo.example.test`, passwordHash, isActive: true });
    if (organizationId && roleId) {
      store.memberships.push({ organizationId, userId: id, roleId, isActive: true });
    }
  }
  store.platformAdmins.add('30');

  class FixedExportClockModule {}
  Global()(FixedExportClockModule);
  Module({
    providers: [{ provide: EXPORT_NOW, useValue: () => FIXED_NOW }],
    exports: [EXPORT_NOW],
  })(FixedExportClockModule);

  const app = await createAuthApp(t, store, {
    imports: [FixedExportClockModule, CompanyExportModule],
    overrides: [[CompanyExportRepository, exportRepo]],
  });

  return { ...app, store, exportRepo };
}

function keysDeep(value, out = []) {
  if (Array.isArray(value)) {
    for (const item of value) keysDeep(item, out);
  } else if (value && typeof value === 'object') {
    for (const [key, inner] of Object.entries(value)) {
      out.push(key);
      keysDeep(inner, out);
    }
  }
  return out;
}

test('company_export is registered in AUDIT_RESOURCES under category access', () => {
  assert.deepEqual(AUDIT_RESOURCES.company_export, { category: 'access', fields: {} });
});

test('CSV formula neutralization prefixes =, +, -, @, tab, and carriage return with a single quote', () => {
  assert.equal(neutralizeFormula('=CMD()'), "'=CMD()");
  assert.equal(neutralizeFormula('+1+2'), "'+1+2");
  assert.equal(neutralizeFormula('-5+2'), "'-5+2");
  assert.equal(neutralizeFormula('@SUM(A1:A2)'), "'@SUM(A1:A2)");
  assert.equal(neutralizeFormula('\t=1'), "'\t=1");
  assert.equal(neutralizeFormula('\r=1'), "'\r=1");
  assert.equal(neutralizeFormula('Normal text'), 'Normal text');
  assert.equal(formatCsvCell('=CMD() "Acme, Inc."'), `"'=CMD() ""Acme, Inc."""`);
});

test('tenant admin can export JSON snapshot with exact tenant-scoped rows and zero secrets', async (t) => {
  const { server, store, exportRepo } = await exportApp(t);
  const adminToken = await tokenFor(server, 'meridian_admin');

  const response = await as(request(server).get('/api/company-export?format=json'), adminToken, '1').expect(200);

  assert.match(response.headers['content-type'], /^application\/json/i);
  assert.equal(response.headers['content-disposition'], 'attachment; filename="meridian-courier-export-2026-11-26.json"');

  const payload = JSON.parse(response.text);
  assert.equal(payload.exportedAt, FIXED_NOW.toISOString());
  assert.equal(payload.organization.id, '1');
  assert.equal(payload.organization.slug, 'meridian-courier');
  assert.deepEqual(payload.counts, {
    members: 2,
    clients: 1,
    drivers: 1,
    assets: 1,
    parcels: 1,
    invoices: 1,
  });

  // Exact Company 1 rows only — zero Company 2 data.
  assert.equal(payload.members[0].username, 'meridian_admin');
  assert.equal(payload.clients[0].clientCode, 'MRD-01');
  assert.equal(payload.drivers[0].employeeCode, 'DRV-001');
  assert.equal(payload.assets[0].assetTag, 'VAN-01');
  assert.equal(payload.parcels[0].trackingNumber, 'TRC-MERIDIAN01');
  assert.equal(payload.invoices[0].invoiceNumber, 'INV-1-000901');
  assert.ok(!response.text.includes('Harbor'));
  assert.ok(!response.text.includes('HBR-99'));
  assert.ok(!response.text.includes('TRC-HARBOR9999'));

  // Zero secret fields or secret values anywhere in the exported JSON.
  const allKeys = keysDeep(payload);
  for (const forbidden of ['passwordHash', 'password', 'refreshTokenHash', 'tokenHash', 'inviteTokenHash']) {
    assert.ok(!allKeys.includes(forbidden), `Secret key ${forbidden} must not appear in export`);
  }
  assert.ok(!response.text.includes('SECRET_HASH_MUST_NEVER_LEAK'));
  assert.ok(!response.text.includes('SECRET_REFRESH_HASH'));
  assert.ok(!response.text.includes('SECRET_INVITE_HASH'));

  // Every repository query was scoped to organizationId '1'.
  assert.ok(exportRepo.calls.length > 0);
  assert.ok(exportRepo.calls.every(([, orgId]) => orgId === '1'));

  // Audit log entry recorded.
  assert.deepEqual(
    store.auditEntries.filter((entry) => entry.resourceType === 'company_export'),
    [{
      module: 'export',
      action: 'read',
      resourceType: 'company_export',
      organizationId: '1',
      params: { format: 'json', section: 'all' },
    }],
  );
});

test('tenant admin can export CSV (single sections and all sections) with formula injection neutralized', async (t) => {
  const { server, store } = await exportApp(t);
  const adminToken = await tokenFor(server, 'meridian_admin');

  // Single section: clients (contains =CMD() and +John Formula)
  const clientsCsv = await as(
    request(server).get('/api/company-export?format=csv&section=clients'),
    adminToken,
    '1',
  ).expect(200);
  assert.match(clientsCsv.headers['content-type'], /^text\/csv/i);
  assert.equal(clientsCsv.headers['content-disposition'], 'attachment; filename="meridian-courier-clients-2026-11-26.csv"');
  assert.ok(clientsCsv.text.includes(`"'=CMD() ""Acme, Inc."""`));
  assert.ok(clientsCsv.text.includes("'+John Formula"));
  assert.ok(!clientsCsv.text.includes('Harbor Secret Merchant'));

  // Single section: parcels (contains @SUM(A1:A2))
  const parcelsCsv = await as(
    request(server).get('/api/company-export?format=csv&section=parcels'),
    adminToken,
    '1',
  ).expect(200);
  assert.equal(parcelsCsv.headers['content-disposition'], 'attachment; filename="meridian-courier-parcels-2026-11-26.csv"');
  assert.ok(parcelsCsv.text.includes("'@SUM(A1:A2)"));
  assert.ok(parcelsCsv.text.includes('TRC-MERIDIAN01'));
  assert.ok(!parcelsCsv.text.includes('TRC-HARBOR9999'));

  // All sections CSV
  const allCsv = await as(
    request(server).get('/api/company-export?format=csv&section=all'),
    adminToken,
    '1',
  ).expect(200);
  assert.equal(allCsv.headers['content-disposition'], 'attachment; filename="meridian-courier-all-2026-11-26.csv"');
  for (const section of ['organization', 'members', 'clients', 'drivers', 'assets', 'parcels', 'invoices']) {
    assert.ok(allCsv.text.includes(`section,${section}\r\n`), `Expected section ${section} in combined CSV`);
  }
  assert.ok(!allCsv.text.includes('SECRET_HASH_MUST_NEVER_LEAK'));
  assert.ok(!allCsv.text.includes('Harbor Express'));

  // Audit entries recorded for all three exports with exact params.
  const exportAudits = store.auditEntries.filter((entry) => entry.resourceType === 'company_export');
  assert.equal(exportAudits.length, 3);
  assert.deepEqual(exportAudits[0].params, { format: 'csv', section: 'clients' });
  assert.deepEqual(exportAudits[1].params, { format: 'csv', section: 'parcels' });
  assert.deepEqual(exportAudits[2].params, { format: 'csv', section: 'all' });
});

test('cross-tenant isolation: Company A admin cannot read Company B data, and Company B admin reads only Company B', async (t) => {
  const { server, exportRepo } = await exportApp(t);
  const meridianAdmin = await tokenFor(server, 'meridian_admin');
  const harborAdmin = await tokenFor(server, 'harbor_admin');

  // Meridian admin naming Harbor in header -> 403
  await as(request(server).get('/api/company-export'), meridianAdmin, '2').expect(403);
  assert.equal(exportRepo.calls.length, 0);

  // Attempting to override organizationId via query param -> 400 (forbidNonWhitelisted)
  await as(request(server).get('/api/company-export?organizationId=2'), meridianAdmin, '1').expect(400);
  assert.equal(exportRepo.calls.length, 0);

  // Harbor admin gets only Harbor records
  const harborRes = await as(request(server).get('/api/company-export'), harborAdmin, '2').expect(200);
  const payload = JSON.parse(harborRes.text);
  assert.equal(payload.organization.slug, 'harbor-express');
  assert.equal(payload.clients[0].clientCode, 'HBR-99');
  assert.ok(!harborRes.text.includes('Meridian Courier'));
  assert.ok(!harborRes.text.includes('MRD-01'));
  assert.ok(exportRepo.calls.every(([, orgId]) => orgId === '2'));
});

test('non-admin tenant roles and platform_admin without org_admin membership get 403', async (t) => {
  const { server, store, exportRepo } = await exportApp(t);

  const nonAdminUsers = [
    'dispatcher_user',
    'sorter_user',
    'finance_user',
    'hr_user',
    'fleet_user',
    'driver_user',
    'platform_only',
  ];

  for (const username of nonAdminUsers) {
    const token = await tokenFor(server, username);
    await as(request(server).get('/api/company-export?format=json'), token, '1').expect(403);
    await as(request(server).get('/api/company-export?format=csv&section=clients'), token, '1').expect(403);
  }

  // Zero data queries executed for denied callers.
  assert.equal(exportRepo.calls.length, 0);

  // Denied attempts are audited.
  const deniedAudits = store.auditEntries.filter(
    (entry) => entry.resourceType === 'company_export' && entry.outcome === 'denied',
  );
  assert.equal(deniedAudits.length, nonAdminUsers.length * 2);
});

test('invalid format or section returns 400 and unauthenticated request returns 401', async (t) => {
  const { server, store, exportRepo } = await exportApp(t);
  const adminToken = await tokenFor(server, 'meridian_admin');

  await request(server).get('/api/company-export').set('X-Organization-Id', '1').expect(401);
  assert.equal(store.auditEntries.filter((entry) => entry.resourceType === 'company_export').length, 0);

  await as(request(server).get('/api/company-export?format=xml'), adminToken, '1').expect(400);
  await as(request(server).get('/api/company-export?format=csv&section=passwords'), adminToken, '1').expect(400);
  await as(request(server).get('/api/company-export?extra=1'), adminToken, '1').expect(400);
  const invalidScope = await as(request(server).get('/api/company-export?format=json&section=members'), adminToken, '1').expect(400);
  assert.equal(invalidScope.body.code, 'COMPANY_EXPORT_JSON_SECTION');
  assert.equal(exportRepo.calls.length, 0);
  assert.equal(store.auditEntries.filter((entry) => entry.resourceType === 'company_export' && entry.outcome !== 'denied').length, 0);
});

test('export DATE columns stay ISO calendar days for mysql2 Date objects and date strings', async () => {
  for (const value of [new Date('2026-01-10T00:00:00Z'), '2026-01-10']) {
    const repository = new CompanyExportRepository({ query: async () => [{
      hireDate: value, licenseExpiryDate: value, backgroundCheckDate: value,
      transitInsuranceExpiry: null, roadTaxExpiry: value, billingPeriodStart: value,
      billingPeriodEnd: value, issueDate: value, dueDate: value, createdAt: new Date('2026-01-10T12:30:00Z'),
    }] });
    const [driver] = await repository.listDrivers('1');
    const [asset] = await repository.listAssets('1');
    const [invoice] = await repository.listInvoices('1');
    for (const day of [driver.hireDate, driver.licenseExpiryDate, driver.backgroundCheckDate, asset.roadTaxExpiry,
      invoice.billingPeriodStart, invoice.billingPeriodEnd, invoice.issueDate, invoice.dueDate]) assert.equal(day, '2026-01-10');
    assert.equal(driver.transitInsuranceExpiry, null);
    assert.equal(invoice.createdAt, '2026-01-10T12:30:00.000Z');
  }
});
