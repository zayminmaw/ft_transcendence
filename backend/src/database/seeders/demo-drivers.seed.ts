import type { EntityManager } from 'typeorm';
import { insertDriver } from '../../modules/drivers/drivers.repository';
import { DeliveryDriver } from '../../modules/drivers/entities/delivery-driver.entity';
import { Employee } from '../../modules/drivers/entities/employee.entity';
import type { DriverValues } from '../../modules/drivers/types/driver';
import { User } from '../../modules/users/entities/user.entity';

// A demo courier: the driver form's values, the duty status, and the username of the account it signs in with.
export type DemoDriver = DriverValues & Pick<DeliveryDriver, 'dispatchStatus'> & { account: string | null };

// Meridian's couriers match the drivers screens' former sample data: one license expiring soon, one expired, one
// account linked (samir.farah) and one driver-role account left to link (leen.mansour).
export const DEMO_DRIVERS: Record<string, DemoDriver[]> = {
  'meridian-courier': [
    {
      employeeCode: 'DRV-001', firstName: 'Leen', lastName: 'Mansour', personalMobile: '+962 7 9555 2101',
      personalEmail: 'leen.mansour@mail.example.test', nationalId: '9881023344', dateOfBirth: '1994-05-12',
      residentialAddress: '8 Al Rabiah Street, Amman', emergencyContactName: 'Nadia Mansour',
      emergencyContactPhone: '+962 7 9555 2102', employmentClassification: 'full_time', compensationType: 'hybrid',
      employmentStatus: 'active', hireDate: '2025-02-01', terminationDate: null, baseSalary: '350.00',
      bankName: 'Arab Bank', bankAccountIban: 'JO94CBJO0010000000000131000302', driverCategory: 'van',
      fleetArrangement: 'company_vehicle', assignedZone: 'East', maxWeightCapacityKg: '800.00',
      maxVolumeCapacityM3: '6.50', dispatchStatus: 'available', licenseNumber: 'JO-DL-4410982', licenseClass: 'C',
      licenseExpiryDate: '2028-03-15', backgroundCheckPassed: true, backgroundCheckDate: '2025-01-20',
      transitInsurancePolicy: 'GIT-22018', transitInsuranceExpiry: '2027-01-31', commissionPerDrop: '0.75',
      account: null,
    },
    {
      employeeCode: 'DRV-002', firstName: 'Samir', lastName: 'Farah', personalMobile: '+962 7 9555 2201',
      personalEmail: 'samir.farah@mail.example.test', nationalId: '9900417781', dateOfBirth: '1998-11-03',
      residentialAddress: '41 Jabal Al Hussein, Amman', emergencyContactName: 'Rima Farah',
      emergencyContactPhone: '+962 7 9555 2202', employmentClassification: 'contractor',
      compensationType: 'commission_only', employmentStatus: 'active', hireDate: '2025-06-15', terminationDate: null,
      baseSalary: '0.00', bankName: 'Housing Bank', bankAccountIban: 'JO71HBHO0320000000000412300101',
      driverCategory: 'motorcycle', fleetArrangement: 'owner_operator', assignedZone: 'Central',
      maxWeightCapacityKg: '40.00', maxVolumeCapacityM3: '0.20', dispatchStatus: 'available',
      licenseNumber: 'JO-DL-5520411', licenseClass: 'A', licenseExpiryDate: '2026-11-18', backgroundCheckPassed: true,
      backgroundCheckDate: '2025-06-01', transitInsurancePolicy: null, transitInsuranceExpiry: null,
      commissionPerDrop: '1.10', account: 'samir.farah',
    },
    {
      employeeCode: 'DRV-003', firstName: 'Hadi', lastName: 'Salim', personalMobile: '+962 7 9555 2301',
      personalEmail: 'hadi.salim@mail.example.test', nationalId: '9851200456', dateOfBirth: '1985-01-27',
      residentialAddress: '17 Tla Al Ali, Amman', emergencyContactName: 'Huda Salim',
      emergencyContactPhone: '+962 7 9555 2302', employmentClassification: 'full_time',
      compensationType: 'fixed_salary', employmentStatus: 'active', hireDate: '2024-09-01', terminationDate: null,
      baseSalary: '520.00', bankName: 'Arab Bank', bankAccountIban: 'JO32CBJO0010000000000187600455',
      driverCategory: 'van', fleetArrangement: 'company_vehicle', assignedZone: 'West', maxWeightCapacityKg: '750.00',
      maxVolumeCapacityM3: '6.00', dispatchStatus: 'available', licenseNumber: 'JO-DL-3301877', licenseClass: 'C',
      licenseExpiryDate: '2027-08-09', backgroundCheckPassed: true, backgroundCheckDate: '2024-08-20',
      transitInsurancePolicy: 'GIT-21544', transitInsuranceExpiry: '2026-11-30', commissionPerDrop: '0.00',
      account: null,
    },
    {
      employeeCode: 'DRV-004', firstName: 'Omar', lastName: 'Kanaan', personalMobile: '+962 7 9555 2401',
      personalEmail: 'omar.kanaan@mail.example.test', nationalId: '2001336790', dateOfBirth: '2001-07-19',
      residentialAddress: '5 University Street, Amman', emergencyContactName: 'Fadi Kanaan',
      emergencyContactPhone: '+962 7 9555 2402', employmentClassification: 'part_time',
      compensationType: 'commission_only', employmentStatus: 'probation', hireDate: '2026-09-10',
      terminationDate: null, baseSalary: '0.00', bankName: null, bankAccountIban: null, driverCategory: 'bicycle',
      fleetArrangement: 'owner_operator', assignedZone: 'Central', maxWeightCapacityKg: '15.00',
      maxVolumeCapacityM3: '0.08', dispatchStatus: 'off_duty', licenseNumber: 'JO-CY-0099102',
      licenseClass: 'Bicycle', licenseExpiryDate: '2029-09-01', backgroundCheckPassed: false,
      backgroundCheckDate: null, transitInsurancePolicy: null, transitInsuranceExpiry: null,
      commissionPerDrop: '0.90', account: null,
    },
    {
      employeeCode: 'DRV-005', firstName: 'Rami', lastName: 'Haddad', personalMobile: '+962 7 9555 2501',
      personalEmail: 'rami.haddad@mail.example.test', nationalId: '9790281145', dateOfBirth: '1979-03-30',
      residentialAddress: '12 Marka Street, Amman', emergencyContactName: 'Laila Haddad',
      emergencyContactPhone: '+962 7 9555 2502', employmentClassification: 'full_time', compensationType: 'hybrid',
      employmentStatus: 'on_leave', hireDate: '2023-04-03', terminationDate: null, baseSalary: '300.00',
      bankName: 'Jordan Kuwait Bank', bankAccountIban: 'JO15JKBA1100000000000233000771',
      driverCategory: 'heavy_truck', fleetArrangement: 'company_vehicle', assignedZone: 'Industrial',
      maxWeightCapacityKg: '3500.00', maxVolumeCapacityM3: '24.00', dispatchStatus: 'suspended',
      licenseNumber: 'JO-DL-1188420', licenseClass: 'D', licenseExpiryDate: '2026-10-05', backgroundCheckPassed: true,
      backgroundCheckDate: '2023-03-15', transitInsurancePolicy: 'GIT-19002', transitInsuranceExpiry: '2027-04-02',
      commissionPerDrop: '0.50', account: null,
    },
  ],
  'harbor-express': [
    {
      employeeCode: 'HX-DRV-01', firstName: 'Tariq', lastName: 'Aziz', personalMobile: '+962 7 9666 3101',
      personalEmail: 'tariq.aziz@mail.example.test', nationalId: '9870554120', dateOfBirth: '1987-02-14',
      residentialAddress: '3 Port Road, Aqaba', emergencyContactName: 'Sara Aziz', emergencyContactPhone: '+962 7 9666 3102',
      employmentClassification: 'full_time', compensationType: 'hybrid', employmentStatus: 'active', hireDate: '2025-03-01',
      terminationDate: null, baseSalary: '320.00', bankName: 'Arab Bank', bankAccountIban: 'JO60CBJO0010000000000155000101',
      driverCategory: 'van', fleetArrangement: 'company_vehicle', assignedZone: 'Port', maxWeightCapacityKg: '900.00',
      maxVolumeCapacityM3: '7.00', dispatchStatus: 'available', licenseNumber: 'JO-DL-7700311', licenseClass: 'C',
      licenseExpiryDate: '2028-06-30', backgroundCheckPassed: true, backgroundCheckDate: '2025-02-10',
      transitInsurancePolicy: 'GIT-30011', transitInsuranceExpiry: '2027-03-01', commissionPerDrop: '0.60', account: null,
    },
    {
      employeeCode: 'HX-DRV-02', firstName: 'Maha', lastName: 'Nasser', personalMobile: '+962 7 9666 3201',
      personalEmail: 'maha.nasser@mail.example.test', nationalId: '9960871234', dateOfBirth: '1996-09-08',
      residentialAddress: '20 Coast Street, Aqaba', emergencyContactName: 'Khaled Nasser',
      emergencyContactPhone: '+962 7 9666 3202', employmentClassification: 'contractor', compensationType: 'commission_only',
      employmentStatus: 'active', hireDate: '2026-01-12', terminationDate: null, baseSalary: '0.00', bankName: null,
      bankAccountIban: null, driverCategory: 'motorcycle', fleetArrangement: 'owner_operator', assignedZone: 'Old Town',
      maxWeightCapacityKg: '35.00', maxVolumeCapacityM3: '0.15', dispatchStatus: 'off_duty', licenseNumber: 'JO-DL-7700422',
      licenseClass: 'A', licenseExpiryDate: '2027-12-01', backgroundCheckPassed: true, backgroundCheckDate: '2026-01-05',
      transitInsurancePolicy: null, transitInsuranceExpiry: null, commissionPerDrop: '1.00', account: null,
    },
  ],
};

// Adds each company's missing drivers (by employee code); existing ones are left unchanged. Returns how many were added.
export async function seedDemoDrivers(manager: EntityManager, companyIds: Map<string, string>): Promise<number> {
  let created = 0;
  for (const [company, drivers] of Object.entries(DEMO_DRIVERS)) {
    const organizationId = companyIds.get(company)!;
    for (const { account, dispatchStatus, ...values } of drivers) {
      if (await manager.existsBy(Employee, { organizationId, employeeCode: values.employeeCode })) continue;
      const user = account ? await manager.findOneBy(User, { username: account }) : null;
      await insertDriver(manager, organizationId, values, { userId: user?.id, dispatchStatus });
      created += 1;
    }
  }
  return created;
}
