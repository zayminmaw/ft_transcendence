// Who may add whom as a contact: the role matrix in .docs/ERP-Logistics-System-Outline-v1.md. To change a rule, edit this
// table and its test (test/contact-rules.test.cjs); nothing else holds it. A role missing from the table adds nobody and
// is added by nobody, which is how platform_admin stays out.
export const ADD_RULES: Readonly<Record<string, readonly string[]>> = {
  org_admin: ['org_admin', 'dispatcher', 'hub_sorter', 'finance', 'hr_manager', 'fleet_lead', 'driver'],
  dispatcher: ['driver', 'dispatcher'],
  driver: ['dispatcher'],
  hr_manager: ['hr_manager', 'driver', 'dispatcher'],
  finance: ['finance', 'dispatcher', 'hr_manager'],
  hub_sorter: ['hub_sorter', 'dispatcher', 'driver'],
  fleet_lead: ['fleet_lead', 'dispatcher', 'driver'],
};

export function canAdd(actingRole: string, targetRole: string): boolean {
  // Own-property check so a role named like an object method (toString) is unknown, not a function.
  if (!Object.hasOwn(ADD_RULES, actingRole)) return false;
  return ADD_RULES[actingRole].includes(targetRole);
}
