import { z } from 'zod';
import { RETURN_CONDITIONS } from '../constants';
import { date, key, money, optional, optionalDate, required } from './fields';

// The same limits as the `asset_maintenance_logs` columns. 'YYYY-MM-DD' strings compare in date order.
export const maintenanceSchema = z
	.object({
		serviceDate: date,
		serviceType: required(128),
		serviceCost: money,
		vendorServiceCenter: optional(128),
		nextServiceDue: optionalDate,
		notes: optional(2000),
		condition: z.enum(RETURN_CONDITIONS),
	})
	.refine((values) => !values.nextServiceDue || values.nextServiceDue > values.serviceDate, {
		path: ['nextServiceDue'],
		message: key('errors.dueBeforeService'),
	});

// What the form fields hold, and what the schema turns them into (trimmed).
export type MaintenanceFormValues = z.input<typeof maintenanceSchema>;
export type MaintenanceFormOutput = z.output<typeof maintenanceSchema>;
