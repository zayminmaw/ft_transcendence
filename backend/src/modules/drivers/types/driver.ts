import type { COURIER_FIELDS, EMPLOYEE_FIELDS } from '../constants';
import type { DeliveryDriver } from '../entities/delivery-driver.entity';
import type { Employee } from '../entities/employee.entity';

// The login account a driver signs in with.
export interface DriverAccount {
  userId: string;
  username: string;
}

// What the driver form sets, over both tables.
export type DriverValues = Pick<Employee, (typeof EMPLOYEE_FIELDS)[number]> & Pick<DeliveryDriver, (typeof COURIER_FIELDS)[number]>;

// One driver as the repository reads it: the employee and courier rows together, with the linked account.
export type DriverRecord = DriverValues & Pick<DeliveryDriver, 'dispatchStatus' | 'lastLocationPing'> & Pick<Employee, 'id' | 'createdAt' | 'updatedAt'> & {
  account: DriverAccount | null;
};

// Left out (undefined) keeps the saved value. The duty status only through its own endpoint.
export type DriverChanges = Partial<DriverValues & Pick<DeliveryDriver, 'dispatchStatus'>>;

// A driver as the API answers: the groups the person may not see are left out.
export type DriverView = Partial<DriverRecord>;

export interface DriverCounts {
  total: number;
  available: number;
  onRun: number;
  offDuty: number;
  suspended: number;
  licensesExpiring: number;
}

export interface DriverChoice {
  id: string;
  name: string;
  employeeCode: string;
}
