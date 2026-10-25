import type { DataSource } from 'typeorm';
import { hashPassword } from '../../modules/auth/password';
import { Organization } from '../../modules/organizations/entities/organization.entity';
import { OrganizationMember } from '../../modules/organizations/entities/organization-member.entity';
import { Role } from '../../modules/rbac/entities/role.entity';
import { UserRole } from '../../modules/rbac/entities/user-role.entity';
import { PlatformRolesRepository } from '../../modules/rbac/platform-roles.repository';
import { User } from '../../modules/users/entities/user.entity';

// Every demo account uses this password. It is written in the README, so never load demo data on a real deployment.
export const DEMO_PASSWORD = 'Transcend-demo-1';

const COMPANIES = [
  { slug: 'meridian-courier', name: 'Meridian Courier', contactEmail: 'ops@meridian.example.test' },
  { slug: 'harbor-express', name: 'Harbor Express', contactEmail: 'ops@harbor.example.test' },
];

interface DemoAccount {
  username: string;
  email: string;
  platformAdmin?: boolean;
  memberships: { company: string; role: string; active?: boolean }[];
}

export const DEMO_ACCOUNTS: DemoAccount[] = [
  { username: 'lina', email: 'lina@meridian.example.test', memberships: [{ company: 'meridian-courier', role: 'org_admin' }] },
  { username: 'dana.saleh', email: 'dana@meridian.example.test', memberships: [{ company: 'meridian-courier', role: 'dispatcher' }] },
  { username: 'omar.hub', email: 'omar@meridian.example.test', memberships: [{ company: 'meridian-courier', role: 'hub_sorter' }] },
  { username: 'rania.finance', email: 'rania@meridian.example.test', memberships: [{ company: 'meridian-courier', role: 'finance' }] },
  { username: 'yusuf.hr', email: 'yusuf@meridian.example.test', memberships: [{ company: 'meridian-courier', role: 'hr_manager' }] },
  { username: 'maya.fleet', email: 'maya@meridian.example.test', memberships: [{ company: 'meridian-courier', role: 'fleet_lead' }] },
  { username: 'samir.farah', email: 'samir@meridian.example.test', memberships: [{ company: 'meridian-courier', role: 'driver' }] },
  { username: 'karim.harbor', email: 'karim@harbor.example.test', memberships: [{ company: 'harbor-express', role: 'org_admin' }] },
  { username: 'noor', email: 'noor@demo.example.test', memberships: [
    { company: 'meridian-courier', role: 'dispatcher' }, { company: 'harbor-express', role: 'finance' },
  ] },
  { username: 'alaa', email: 'ataan@student.42bangkok.com', memberships: [
    { company: 'meridian-courier', role: 'dispatcher' }, { company: 'harbor-express', role: 'finance' },
  ] },
  { username: 'zaid', email: 'zabu-bak@student.42bangkok.com', memberships: [
    { company: 'meridian-courier', role: 'dispatcher' }, { company: 'harbor-express', role: 'finance' },
  ] },
  { username: 'zmin', email: 'zmin@student.42bangkok.com', platformAdmin: true, memberships: [{ company: 'meridian-courier', role: 'dispatcher' }] },
  { username: 'wai', email: 'wmin-kha@student.42bangkok.com', memberships: [{ company: 'harbor-express', role: 'org_admin' }] },
  { username: 'zara.platform', email: 'zara@demo.example.test', platformAdmin: true, memberships: [{ company: 'meridian-courier', role: 'dispatcher' }] },
  { username: 'platform.ops', email: 'platform.ops@demo.example.test', platformAdmin: true, memberships: [] },
  { username: 'ex.member', email: 'ex.member@meridian.example.test', memberships: [{ company: 'meridian-courier', role: 'hub_sorter', active: false }] },
];

export interface DemoSeedResult {
  companiesCreated: number;
  accountsCreated: number;
  accountsSkipped: string[];
}

// Adds only what is missing. An existing username is skipped with its memberships, so real accounts are never touched.
export async function seedDemo(database: DataSource): Promise<DemoSeedResult> {
  const passwordHash = await hashPassword(DEMO_PASSWORD);
  const platformRoles = new PlatformRolesRepository(database.getRepository(UserRole));
  return database.transaction(async (manager) => {
    const result: DemoSeedResult = { companiesCreated: 0, accountsCreated: 0, accountsSkipped: [] };
    const companyIds = new Map<string, string>();
    for (const company of COMPANIES) {
      let organization = await manager.findOneBy(Organization, { slug: company.slug });
      if (!organization) {
        organization = await manager.save(manager.create(Organization, company));
        result.companiesCreated += 1;
      }
      companyIds.set(company.slug, organization.id);
    }
    for (const account of DEMO_ACCOUNTS) {
      if (await manager.existsBy(User, [{ username: account.username }, { email: account.email }])) {
        result.accountsSkipped.push(account.username);
        continue;
      }
      const user = await manager.save(manager.create(User, { username: account.username, email: account.email, passwordHash }));
      if (account.platformAdmin) await platformRoles.grantPlatformAdmin(user.id, manager);
      for (const membership of account.memberships) {
        const role = await manager.findOneBy(Role, { code: membership.role });
        if (!role) throw new Error(`Role ${membership.role} is missing. Run the migrations first.`);
        await manager.insert(OrganizationMember, {
          organizationId: companyIds.get(membership.company), userId: user.id, roleId: role.id, isActive: membership.active ?? true,
        });
      }
      result.accountsCreated += 1;
    }
    return result;
  });
}
