// AssetsRepository over plain rows (the details shape it returns, kept with organizationId), for the HTTP tests. The
// same results and refusals; the audit step gets a stand-in manager (the fake AuditService ignores it). The rules
// are the module's own (asset-rules); the SQL is covered by test/db/assets.db.test.cjs.
const { checkInRefusal, checkOutRefusal, maintenanceRefusal, planUpdate } = require('../../dist/modules/assets/asset-rules');
const { EXPIRY_WARNING_DAYS } = require('../../dist/common/expiry');
const { READY_CONDITIONS } = require('../../dist/modules/assets/constants');

function createFakeAssets() {
  const rows = [];
  // Drivers who may take assets: { organizationId, id, name, working }.
  const drivers = [];
  let nextId = 100;
  const company = (organizationId) => rows.filter((row) => row.organizationId === organizationId);
  const details = (row) => {
    const copy = structuredClone(row);
    delete copy.organizationId;
    const open = copy.assignments.find((item) => !item.checkedInAt);
    copy.holder = open
      ? { assignmentId: open.id, driverId: open.driverId, driverName: open.driverName, checkedOutAt: open.checkedOutAt, checkoutNotes: open.checkoutNotes }
      : null;
    copy.nextServiceDue = copy.maintenanceLogs.find((log) => log.nextServiceDue)?.nextServiceDue ?? null;
    return copy;
  };
  // The list answer carries no history.
  const summary = (asset) => {
    const copy = { ...asset };
    delete copy.assignments;
    delete copy.maintenanceLogs;
    return copy;
  };
  const tagTaken = (organizationId, tag, exceptId) => tag !== undefined && company(organizationId).some((row) => row.id !== exceptId && row.assetTag === tag);
  // Runs a change on the company's asset. The work returns what stops it (a refusal, or unchanged), or changes the row.
  const change = async (organizationId, id, audit, work) => {
    const row = company(organizationId).find((item) => item.id === id);
    if (!row) return { status: 'not_found' };
    const before = details(row);
    const stop = work(row, before);
    if (stop) return stop;
    row.updatedAt = new Date();
    const after = details(row);
    await audit({}, before, after);
    return { status: 'updated', asset: after };
  };

  const repository = {
    list: async (organizationId, query) => {
      const needle = query.search?.toLowerCase();
      const matching = company(organizationId).map(details).filter((asset) => {
        const status = {
          all: true,
          available: !asset.holder && READY_CONDITIONS.includes(asset.currentCondition),
          checked_out: asset.holder !== null,
        }[query.status] ?? asset.currentCondition === query.status;
        return status && (!needle || [asset.assetTag, asset.assetName, asset.licensePlate ?? '', asset.holder?.driverName ?? '']
          .some((text) => text.toLowerCase().includes(needle)));
      });
      const sign = query.direction === 'desc' ? -1 : 1;
      matching.sort((a, b) => sign * (a[query.sort].localeCompare(b[query.sort]) || Number(a.id) - Number(b.id)));
      const start = (query.page - 1) * query.pageSize;
      return { items: matching.slice(start, start + query.pageSize).map(summary), total: matching.length };
    },
    counts: async (organizationId) => {
      const all = company(organizationId).map(details);
      const inService = all.filter((asset) => asset.currentCondition !== 'decommissioned');
      const soon = new Date(Date.now() + EXPIRY_WARNING_DAYS * 86_400_000).toISOString().slice(0, 10);
      return {
        inService: inService.length,
        checkedOut: inService.filter((asset) => asset.holder).length,
        needsMaintenance: all.filter((asset) => asset.currentCondition === 'needs_maintenance').length,
        decommissioned: all.length - inService.length,
        roadTaxDue: inService.filter((asset) => asset.roadTaxExpiry && asset.roadTaxExpiry <= soon).length,
      };
    },
    find: async (organizationId, id) => {
      const row = company(organizationId).find((item) => item.id === id);
      return row ? details(row) : null;
    },
    create: async (organizationId, values, audit) => {
      if (tagTaken(organizationId, values.assetTag)) return { status: 'tag_taken' };
      const now = new Date();
      const row = { ...values, id: String(nextId++), organizationId, assignments: [], maintenanceLogs: [], createdAt: now, updatedAt: now };
      await audit({}, null, details(row));
      rows.push(row);
      return { status: 'created', asset: details(row) };
    },
    update: (organizationId, id, changes, audit) => change(organizationId, id, audit, (row, before) => {
      const plan = planUpdate(before, changes);
      if (plan.refusal) return { status: plan.refusal };
      if (Object.keys(plan.changed).length === 0) return { status: 'unchanged', asset: before };
      if (tagTaken(organizationId, plan.changed.assetTag, id)) return { status: 'tag_taken' };
      Object.assign(row, plan.changed);
    }),
    checkOut: (organizationId, id, { driverId, notes }, audit) => change(organizationId, id, audit, (row, before) => {
      const refusal = checkOutRefusal(before);
      if (refusal) return { status: refusal };
      const driver = drivers.find((item) => item.organizationId === organizationId && item.id === driverId && item.working);
      if (!driver) return { status: 'driver_unavailable' };
      row.assignments.unshift({
        id: String(nextId++), driverId, driverName: driver.name, checkedOutAt: new Date(), checkedInAt: null, checkoutNotes: notes, checkinNotes: null,
      });
    }),
    checkIn: (organizationId, id, { condition, notes }, audit) => change(organizationId, id, audit, (row, before) => {
      const refusal = checkInRefusal(before);
      if (refusal) return { status: refusal };
      Object.assign(row.assignments.find((item) => !item.checkedInAt), { checkedInAt: new Date(), checkinNotes: notes });
      row.currentCondition = condition;
    }),
    logMaintenance: (organizationId, id, { condition, ...log }, audit) => change(organizationId, id, audit, (row, before) => {
      const refusal = maintenanceRefusal(before);
      if (refusal) return { status: refusal };
      row.maintenanceLogs = [{ ...log, id: String(nextId++), createdAt: new Date() }, ...row.maintenanceLogs]
        .sort((a, b) => b.serviceDate.localeCompare(a.serviceDate));
      row.currentCondition = condition;
    }),
  };
  return { rows, drivers, repository };
}

module.exports = { createFakeAssets };
