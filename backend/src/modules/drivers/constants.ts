import { DISPATCH_STATUSES, type DispatchStatus } from './entities/delivery-driver.entity';

// The columns of each table that the driver form sets. Both tables are written together.
export const EMPLOYEE_FIELDS = [
  'employeeCode', 'firstName', 'lastName', 'personalMobile', 'personalEmail', 'nationalId', 'dateOfBirth',
  'residentialAddress', 'emergencyContactName', 'emergencyContactPhone', 'employmentClassification', 'compensationType',
  'employmentStatus', 'hireDate', 'terminationDate', 'baseSalary', 'bankName', 'bankAccountIban',
] as const;
export const COURIER_FIELDS = [
  'driverCategory', 'fleetArrangement', 'assignedZone', 'maxWeightCapacityKg', 'maxVolumeCapacityM3', 'commissionPerDrop',
  'licenseNumber', 'licenseClass', 'licenseExpiryDate', 'backgroundCheckPassed', 'backgroundCheckDate',
  'transitInsurancePolicy', 'transitInsuranceExpiry',
] as const;

// What anyone with drivers.view sees. Each group below needs its own permission; a field in no list is never answered.
export const BASE_FIELDS = [
  'id', 'employeeCode', 'firstName', 'lastName', 'personalMobile', 'personalEmail', 'employmentClassification',
  'compensationType', 'employmentStatus', 'hireDate', 'terminationDate', 'driverCategory', 'fleetArrangement',
  'assignedZone', 'maxWeightCapacityKg', 'maxVolumeCapacityM3', 'dispatchStatus', 'lastLocationPing', 'account',
  'createdAt', 'updatedAt',
] as const;
export const FIELD_GROUPS = {
  personal: {
    permission: 'drivers.manage',
    fields: ['nationalId', 'dateOfBirth', 'residentialAddress', 'emergencyContactName', 'emergencyContactPhone'],
  },
  payroll: { permission: 'staff.view_payroll', fields: ['baseSalary', 'bankName', 'bankAccountIban'] },
  compliance: {
    permission: 'drivers.view_compliance',
    fields: [
      'licenseNumber', 'licenseClass', 'licenseExpiryDate', 'backgroundCheckPassed', 'backgroundCheckDate',
      'transitInsurancePolicy', 'transitInsuranceExpiry',
    ],
  },
  earnings: { permission: 'drivers.view_earnings', fields: ['commissionPerDrop'] },
} as const;
export type FieldGroup = keyof typeof FIELD_GROUPS;

export const DRIVER_STATUS_FILTERS = [...DISPATCH_STATUSES, 'all'] as const;
export const DRIVER_SORTS = ['lastName', 'employeeCode', 'hireDate'] as const;
// The duty statuses a person sets by hand. On pickup and out for delivery will come from dispatch.
export const MANUAL_DISPATCH_STATUSES = ['available', 'off_duty', 'suspended'] as const satisfies readonly DispatchStatus[];
// A license counts as expiring this many days ahead, like the frontend's EXPIRY_WARNING_DAYS.
export const EXPIRY_WARNING_DAYS = 30;
// The role an account needs to be linked to a driver.
export const DRIVER_ROLE = 'driver';

export const DRIVER_NOT_FOUND = { message: "That driver isn't in this company.", code: 'DRIVER_NOT_FOUND' };
export const EMPLOYEE_CODE_TAKEN = { message: 'This employee code is already used.', code: 'EMPLOYEE_CODE_TAKEN' };
export const LICENSE_NUMBER_TAKEN = { message: 'This license number is already registered.', code: 'LICENSE_NUMBER_TAKEN' };
export const ACCOUNT_ALREADY_LINKED = { message: 'This account is linked to another driver.', code: 'ACCOUNT_ALREADY_LINKED' };
export const ACCOUNT_NOT_LINKABLE = {
  message: 'Only an active member of this company with the driver role can be linked.',
  code: 'ACCOUNT_NOT_LINKABLE',
};
export const DRIVER_PAYROLL_FORBIDDEN = { message: "You can't change a driver's pay or bank details.", code: 'DRIVER_PAYROLL_FORBIDDEN' };
export const DRIVER_TERMINATION_DATE_REQUIRED = {
  message: 'Give the date employment ended.',
  code: 'DRIVER_TERMINATION_DATE_REQUIRED',
};
export const DRIVER_TERMINATED = { message: 'This driver no longer works here.', code: 'DRIVER_TERMINATED' };
