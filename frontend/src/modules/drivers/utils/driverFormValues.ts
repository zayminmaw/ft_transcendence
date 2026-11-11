import type { Driver, DriverValues } from '../api';
import { DRIVER_DEFAULT_VALUES } from '../constants';
import type { DriverFormOutput, DriverFormValues } from '../schemas/driverSchema';

// The field groups on the form: payroll with staff.view_payroll; when editing, compliance with
// drivers.view_compliance and the commission with drivers.view_earnings.
export type DriverFormGroups = { payroll: boolean; compliance: boolean; earnings: boolean };

// Empty optional fields are sent as null, like the nullable columns. A group that isn't on the form is left out, so
// it keeps its saved value instead of being overwritten with the form's defaults.
export function toDriverValues(values: DriverFormOutput, groups: DriverFormGroups): DriverValues {
	const orNull = (value: string) => value || null;
	const {
		baseSalary,
		bankName,
		bankAccountIban,
		licenseNumber,
		licenseClass,
		licenseExpiryDate,
		backgroundCheckPassed,
		backgroundCheckDate,
		transitInsurancePolicy,
		transitInsuranceExpiry,
		commissionPerDrop,
		...always
	} = values;
	return {
		...always,
		terminationDate: orNull(values.terminationDate),
		assignedZone: orNull(values.assignedZone),
		...(groups.payroll && {
			baseSalary,
			bankName: orNull(bankName),
			bankAccountIban: orNull(bankAccountIban),
		}),
		...(groups.compliance && {
			licenseNumber,
			licenseClass,
			licenseExpiryDate,
			backgroundCheckPassed,
			backgroundCheckDate: orNull(backgroundCheckDate),
			transitInsurancePolicy: orNull(transitInsurancePolicy),
			transitInsuranceExpiry: orNull(transitInsuranceExpiry),
		}),
		...(groups.earnings && { commissionPerDrop }),
	};
}

// A saved driver as form fields: nulls and fields this person can't see become the defaults. The ones they can't
// see aren't shown or sent (toDriverValues).
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
