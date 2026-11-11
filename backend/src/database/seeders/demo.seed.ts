import type { DataSource } from 'typeorm';
import { Client } from '../../modules/clients/entities/client.entity';
import type { NewClient } from '../../modules/clients/types/client';
import { hashPassword } from '../../modules/users/password';
import { Organization } from '../../modules/organizations/entities/organization.entity';
import { OrganizationMember } from '../../modules/organizations/entities/organization-member.entity';
import { Role } from '../../modules/rbac/entities/role.entity';
import { UserRole } from '../../modules/rbac/entities/user-role.entity';
import { PlatformRolesRepository } from '../../modules/rbac/platform-roles.repository';
import { User } from '../../modules/users/entities/user.entity';
import { seedDemoDrivers } from './demo-drivers.seed';

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
  // Logs in with the demo password, then must choose a new one (auth part 2a's first-login change).
  mustChangePassword?: boolean;
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
  { username: 'leen.mansour', email: 'leen@meridian.example.test', memberships: [{ company: 'meridian-courier', role: 'driver' }] },
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
  { username: 'new.hire', email: 'new.hire@meridian.example.test', mustChangePassword: true, memberships: [{ company: 'meridian-courier', role: 'dispatcher' }] },
];

type DemoClient = NewClient & Pick<Client, 'isActive'>;

const merchant = (
  clientCode: string, businessName: string, contactPersonName: string, mobile1: string, email: string, address: string,
  extra: Partial<DemoClient> = {},
): DemoClient => ({
  clientCode, businessName, tradeLicenseNo: null, contactPersonName, contactTitle: null, mobile1, mobile2: null, email,
  billingAddress: address, defaultPickupAddress: address, pickupLatitude: null, pickupLongitude: null, rateProfileTier: 'standard',
  operationalNotes: null, isActive: true, ...extra,
});

// Merchants for the Clients pages and, later, parcels. Balances stay 0: only billing's ledger entries change them.
export const DEMO_CLIENTS: Record<string, DemoClient[]> = {
  'meridian-courier': [
    merchant('CL-0001', 'Paper & Co.', 'Rana Haddad', '+962 7 9555 0142', 'billing@paperco.example.test', '14 Wasfi Al Tal Street, Amman', {
      tradeLicenseNo: 'CR-448120', contactTitle: 'Operations lead', defaultPickupAddress: 'Warehouse 3, Sahab Industrial City, Amman',
      pickupLatitude: '31.87012400', pickupLongitude: '36.00521300', rateProfileTier: 'priority',
      operationalNotes: 'Pickups before 11:00. Fragile stationery sets ship in double boxes.',
    }),
    merchant('CL-0002', 'Olive Branch Market', 'Khaled Odeh', '+962 7 8811 2040', 'accounts@olivebranch.example.test', '3 Rainbow Street, Jabal Amman', {
      tradeLicenseNo: 'CR-219774', contactTitle: 'Owner', mobile2: '+962 6 552 1180', pickupLatitude: '31.95218300', pickupLongitude: '35.92614700',
    }),
    merchant('CL-0003', 'Nomad Electronics', 'Dina Shami', '+962 7 7720 3301', 'dina@nomad.example.test', 'Mecca Mall Offices, Floor 4, Amman', {
      defaultPickupAddress: 'Mecca Mall loading bay B, Amman', rateProfileTier: 'corporate',
      operationalNotes: 'High-value items: insured parcels only, signature required.',
    }),
    merchant('CL-0004', 'Bloom Florists', 'Sara Nasser', '+962 7 9901 7788', 'hello@bloom.example.test', '22 Abdoun Circle, Amman', {
      tradeLicenseNo: 'CR-301552', contactTitle: 'Manager', pickupLatitude: '31.94580100', pickupLongitude: '35.88302500',
      operationalNotes: 'Same-day deliveries only.', isActive: false,
    }),
    merchant('CL-0005', 'Atlas Sportswear', 'Yousef Karam', '+962 7 9640 1123', 'ecom@atlas.example.test', 'King Abdullah II Street 88, Amman', {
      tradeLicenseNo: 'CR-512903', contactTitle: 'E-commerce manager', mobile2: '+962 7 9640 1124',
      defaultPickupAddress: 'Atlas fulfilment centre, Marka, Amman', pickupLatitude: '31.97690200', pickupLongitude: '35.98411000',
    }),
  ],
  'harbor-express': [
    merchant('HX-0001', 'Gulf Spice Traders', 'Omar Saleh', '+962 7 9123 4567', 'orders@gulfspice.example.test', 'Port Road 12, Aqaba', {
      pickupLatitude: '29.52666700', pickupLongitude: '35.00777800',
    }),
    merchant('HX-0002', 'Red Sea Diving Gear', 'Leen Fares', '+962 7 9234 5678', 'shop@redseadive.example.test', 'South Beach Road 4, Aqaba', {
      rateProfileTier: 'priority',
    }),
  ],
};

export interface DemoSeedResult {
  companiesCreated: number;
  accountsCreated: number;
  accountsSkipped: string[];
  driversCreated: number;
  clientsCreated: number;
}

// Adds only what is missing. An existing username is skipped with its memberships, so real accounts are never touched.
export async function seedDemo(database: DataSource): Promise<DemoSeedResult> {
  const passwordHash = await hashPassword(DEMO_PASSWORD);
  const platformRoles = new PlatformRolesRepository(database.getRepository(UserRole));
  return database.transaction(async (manager) => {
    const result: DemoSeedResult = { companiesCreated: 0, accountsCreated: 0, accountsSkipped: [], clientsCreated: 0, driversCreated: 0 };
    const companyIds = new Map<string, string>();
    for (const company of COMPANIES) {
      let organization = await manager.findOneBy(Organization, { slug: company.slug });
      if (!organization) {
        organization = await manager.save(manager.create(Organization, company));
        result.companiesCreated += 1;
      }
      companyIds.set(company.slug, organization.id);
      for (const client of DEMO_CLIENTS[company.slug] ?? []) {
        if (await manager.existsBy(Client, { organizationId: organization.id, clientCode: client.clientCode })) continue;
        await manager.insert(Client, { ...client, organizationId: organization.id });
        result.clientsCreated += 1;
      }
    }
    for (const account of DEMO_ACCOUNTS) {
      if (await manager.existsBy(User, [{ username: account.username }, { email: account.email }])) {
        result.accountsSkipped.push(account.username);
        continue;
      }
      const user = await manager.save(manager.create(User, {
        username: account.username, email: account.email, passwordHash, mustChangePassword: account.mustChangePassword ?? false,
      }));
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
    result.driversCreated = await seedDemoDrivers(manager, companyIds);
    return result;
  });
}
