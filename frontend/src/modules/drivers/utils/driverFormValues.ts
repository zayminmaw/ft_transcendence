import type { Driver, DriverValues } from '../api';
import { DRIVER_DEFAULT_VALUES } from '../constants';
import type { DriverFormOutput, DriverFormValues } from '../schemas/driverSchema';

// Empty optional fields are sent as null, like the nullable columns. Without staff.view_payroll the payroll
// fields aren't on the form, so they're left out and keep their saved value.
export function toDriverValues(values: DriverFormOutput, withPayroll: boolean): DriverValues {
	const orNull = (value: string) => value || null;
	return {
		...values,
		terminationDate: orNull(values.terminationDate),
		assignedZone: orNull(values.assignedZone),
		backgroundCheckDate: orNull(values.backgroundCheckDate),
		transitInsurancePolicy: orNull(values.transitInsurancePolicy),
		transitInsuranceExpiry: orNull(values.transitInsuranceExpiry),
		baseSalary: withPayroll ? values.baseSalary : undefined,
		bankName: withPayroll ? orNull(values.bankName) : undefined,
		bankAccountIban: withPayroll ? orNull(values.bankAccountIban) : undefined,
	};
}

// A saved driver as form fields: nulls and fields this person can't see become the defaults.
export function toDriverFormValues(driver: Driver): DriverFormValues {
	const d = DRIVER_DEFAULT_VALUES;
	return {
		employeeCode: driver.employeeCode,
		firstName: driver.firstName,
		lastName: driver.lastName,
		personalMobile: driver.personalMobile,
		personalEmail: driver.personalEmail,
		nationalId: driver.nationalId ?? d.nationalId,
		dateOfBirth: driver.dateOfBirth ?? d.dateOfBirth,
		residentialAddress: driver.residentialAddress ?? d.residentialAddress,
		emergencyContactName: driver.emergencyContactName ?? d.emergencyContactName,
		emergencyContactPhone: driver.emergencyContactPhone ?? d.emergencyContactPhone,
		employmentClassification: driver.employmentClassification,
		compensationType: driver.compensationType,
		employmentStatus: driver.employmentStatus,
		hireDate: driver.hireDate,
		terminationDate: driver.terminationDate ?? '',
		baseSalary: driver.baseSalary ?? d.baseSalary,
		bankName: driver.bankName ?? '',
		bankAccountIban: driver.bankAccountIban ?? '',
		driverCategory: driver.driverCategory,
		fleetArrangement: driver.fleetArrangement,
		assignedZone: driver.assignedZone ?? '',
		maxWeightCapacityKg: driver.maxWeightCapacityKg,
		maxVolumeCapacityM3: driver.maxVolumeCapacityM3,
		commissionPerDrop: driver.commissionPerDrop ?? d.commissionPerDrop,
		licenseNumber: driver.licenseNumber ?? d.licenseNumber,
		licenseClass: driver.licenseClass ?? d.licenseClass,
		licenseExpiryDate: driver.licenseExpiryDate ?? d.licenseExpiryDate,
		backgroundCheckPassed: driver.backgroundCheckPassed ?? d.backgroundCheckPassed,
		backgroundCheckDate: driver.backgroundCheckDate ?? '',
		transitInsurancePolicy: driver.transitInsurancePolicy ?? '',
		transitInsuranceExpiry: driver.transitInsuranceExpiry ?? '',
	};
}
