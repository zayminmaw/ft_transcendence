import type { ParseKeys } from 'i18next';
import { z } from 'zod';
import {
	COMPENSATION_TYPES,
	DRIVER_CATEGORIES,
	EMPLOYMENT_CLASSIFICATIONS,
	EMPLOYMENT_STATUSES,
	FLEET_ARRANGEMENTS,
} from '../constants';

const key = (value: ParseKeys<'drivers'>) => value;
const required = (max: number) =>
	z.string().trim().min(1, key('errors.required')).max(max, key('errors.tooLong'));
const optional = (max: number) => z.string().trim().max(max, key('errors.tooLong'));
const phone = z
	.string()
	.trim()
	.regex(/^\+?[0-9 ()-]{6,32}$/, key('errors.invalidPhone'));
// <input type="date"> gives 'YYYY-MM-DD', the same as the DATE columns.
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, key('errors.invalidDate'));
const optionalDate = z.union([z.literal(''), date]);
// DECIMAL(12, 2) for money, DECIMAL(8, 2) for capacities; kept as strings, never JS numbers.
const money = z
	.string()
	.trim()
	.regex(/^\d{1,10}(\.\d{1,2})?$/, key('errors.invalidAmount'));
const capacity = z
	.string()
	.trim()
	.regex(/^\d{1,6}(\.\d{1,2})?$/, key('errors.invalidAmount'));

// The same limits as the `employees` and `delivery_drivers` columns. Messages are translation keys, translated when
// shown.
export const driverSchema = z
	.object({
		employeeCode: z
			.string()
			.trim()
			.toUpperCase()
			.regex(/^[A-Z0-9-]{2,32}$/, key('errors.invalidCode')),
		firstName: required(64),
		lastName: required(64),
		personalMobile: phone,
		personalEmail: z
			.string()
			.trim()
			.max(191, key('errors.tooLong'))
			.regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, key('errors.invalidEmail')),
		nationalId: required(64),
		dateOfBirth: date,
		residentialAddress: required(2000),
		emergencyContactName: required(128),
		emergencyContactPhone: phone,
		employmentClassification: z.enum(EMPLOYMENT_CLASSIFICATIONS),
		compensationType: z.enum(COMPENSATION_TYPES),
		employmentStatus: z.enum(EMPLOYMENT_STATUSES),
		hireDate: date,
		terminationDate: optionalDate,
		baseSalary: money,
		bankName: optional(128),
		bankAccountIban: optional(64),
		driverCategory: z.enum(DRIVER_CATEGORIES),
		fleetArrangement: z.enum(FLEET_ARRANGEMENTS),
		assignedZone: optional(64),
		maxWeightCapacityKg: capacity,
		maxVolumeCapacityM3: capacity,
		commissionPerDrop: money,
		licenseNumber: required(64),
		licenseClass: required(32),
		licenseExpiryDate: date,
		backgroundCheckPassed: z.boolean(),
		backgroundCheckDate: optionalDate,
		transitInsurancePolicy: optional(64),
		transitInsuranceExpiry: optionalDate,
	})
	.refine((values) => values.employmentStatus !== 'terminated' || values.terminationDate !== '', {
		path: ['terminationDate'],
		message: key('errors.terminationDateRequired'),
	});

// What the form fields hold, and what the schema turns them into (trimmed, the code in capitals).
export type DriverFormValues = z.input<typeof driverSchema>;
export type DriverFormOutput = z.output<typeof driverSchema>;
