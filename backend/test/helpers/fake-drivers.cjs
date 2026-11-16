// DriversRepository over plain rows (the shape it returns: employee and courier fields together, plus `account`), for
// the HTTP tests. The same results and refusals; the audit step gets a stand-in manager (the fake AuditService
// ignores it). The employment rules are the module's own (planUpdate); the SQL is covered by
// test/db/drivers.db.test.cjs.
const { planUpdate } = require('../../dist/modules/drivers/driver-rules');

function createFakeDrivers() {
  const rows = [];
  // Company members who can be linked: { organizationId, userId, username }.
  const accounts = [];
  let nextId = 100;
  const company = (organizationId) => rows.filter((row) => row.organizationId === organizationId);
  const record = (row) => {
    const copy = { ...row, account: row.account && { ...row.account } };
    delete copy.organizationId;
    return copy;
  };
  const working = (organizationId) => company(organizationId).filter((row) => row.employmentStatus !== 'terminated');
  const conflict = (organizationId, values, exceptId) => {
    const others = company(organizationId).filter((row) => row.id !== exceptId);
    if (values.employeeCode !== undefined && others.some((row) => row.employeeCode === values.employeeCode)) return 'code_taken';
    if (values.licenseNumber !== undefined && others.some((row) => row.licenseNumber === values.licenseNumber)) return 'license_taken';
    return null;
  };

  const repository = {
    list: async (organizationId, query) => {
      const needle = query.search?.toLowerCase();
      const matching = company(organizationId).filter((row) => (query.status === 'all' || row.dispatchStatus === query.status)
        && (!needle || [`${row.firstName} ${row.lastName}`, row.employeeCode, row.personalMobile, row.assignedZone ?? '']
          .some((text) => text.toLowerCase().includes(needle))));
      const sign = query.direction === 'desc' ? -1 : 1;
      matching.sort((a, b) => sign * (a[query.sort].localeCompare(b[query.sort]) || Number(a.id) - Number(b.id)));
      const start = (query.page - 1) * query.pageSize;
      return { items: matching.slice(start, start + query.pageSize).map(record), total: matching.length };
    },
    counts: async (organizationId) => {
      const drivers = working(organizationId);
      const withStatus = (...statuses) => drivers.filter((row) => statuses.includes(row.dispatchStatus)).length;
      const soon = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
      return {
        total: drivers.length, available: withStatus('available'), onRun: withStatus('on_pickup', 'out_for_delivery'),
        offDuty: withStatus('off_duty'), suspended: withStatus('suspended'),
        licensesExpiring: drivers.filter((row) => row.licenseExpiryDate <= soon).length,
      };
    },
    choices: async (organizationId) => working(organizationId)
      .sort((a, b) => a.lastName.localeCompare(b.lastName))
      .map((row) => ({ id: row.id, name: `${row.firstName} ${row.lastName}`, employeeCode: row.employeeCode })),
    find: async (organizationId, id) => {
      const row = company(organizationId).find((item) => item.id === id);
      return row ? record(row) : null;
    },
    linkableAccounts: async (organizationId) => accounts
      .filter((account) => account.organizationId === organizationId
        && !company(organizationId).some((row) => row.account?.userId === account.userId))
      .map(({ userId, username }) => ({ userId, username })),
    create: async (organizationId, values, audit) => {
      const refusal = conflict(organizationId, values);
      if (refusal) return { status: refusal };
      const now = new Date();
      const row = { ...values, id: String(nextId++), organizationId, dispatchStatus: 'off_duty', lastLocationPing: null, account: null, createdAt: now, updatedAt: now };
      await audit({}, null, record(row));
      rows.push(row);
      return { status: 'created', driver: record(row) };
    },
    update: async (organizationId, id, changes, audit) => {
      const row = company(organizationId).find((item) => item.id === id);
      if (!row) return { status: 'not_found' };
      const plan = planUpdate(record(row), changes);
      if (plan.refusal) return { status: plan.refusal };
      const diff = plan.changed;
      if (Object.keys(diff).length === 0) return { status: 'unchanged', driver: record(row) };
      const refusal = conflict(organizationId, diff, id);
      if (refusal) return { status: refusal };
      const before = record(row);
      Object.assign(row, diff, { updatedAt: new Date() });
      await audit({}, before, record(row));
      return { status: 'updated', driver: record(row) };
    },
    linkAccount: async (organizationId, id, userId, audit) => {
      const row = company(organizationId).find((item) => item.id === id);
      if (!row) return { status: 'not_found' };
      if ((row.account?.userId ?? null) === userId) return { status: 'unchanged', driver: record(row) };
      const account = userId && accounts.find((item) => item.organizationId === organizationId && item.userId === userId);
      if (userId && !account) return { status: 'account_not_linkable' };
      if (userId && company(organizationId).some((item) => item.account?.userId === userId)) return { status: 'account_taken' };
      const before = record(row);
      row.account = account ? { userId: account.userId, username: account.username } : null;
      await audit({}, before, record(row));
      return { status: 'updated', driver: record(row) };
    },
  };
  return { rows, accounts, repository };
}

module.exports = { createFakeDrivers };
