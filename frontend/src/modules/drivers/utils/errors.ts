import { errorKey, fromErrorCode } from '@services/api-client';
import { DRIVER_ERROR_MESSAGES, DRIVER_FIELD_ERRORS } from '../constants';

// A refusal as a translation key: its own message when the code is known, the general one otherwise.
export const driverErrorKey = (error: unknown) => errorKey(DRIVER_ERROR_MESSAGES, error);

// The form field a refusal belongs to, if any; anything else shows above the form.
export const driverErrorField = (error: unknown) => fromErrorCode(DRIVER_FIELD_ERRORS, error);
