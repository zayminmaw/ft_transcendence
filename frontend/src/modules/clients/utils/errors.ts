import { errorKey, fromErrorCode } from '@services/api-client';
import { CLIENT_ERROR_MESSAGES, CLIENT_FIELD_ERRORS } from '../constants';

// A refusal as a translation key: its own message when the code is known, the general one otherwise.
export const clientErrorKey = (error: unknown) => errorKey(CLIENT_ERROR_MESSAGES, error);

// The form field a refusal belongs to, if any; anything else shows above the form.
export const clientErrorField = (error: unknown) => fromErrorCode(CLIENT_FIELD_ERRORS, error);
