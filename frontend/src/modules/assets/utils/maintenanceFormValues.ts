import type { MaintenanceValues } from '../api';
import type { MaintenanceFormOutput } from '../schemas/maintenanceSchema';

// Empty optional fields are sent as null, like the nullable columns.
export function toMaintenanceValues(values: MaintenanceFormOutput): MaintenanceValues {
	return {
		...values,
		vendorServiceCenter: values.vendorServiceCenter || null,
		nextServiceDue: values.nextServiceDue || null,
		notes: values.notes || null,
	};
}
