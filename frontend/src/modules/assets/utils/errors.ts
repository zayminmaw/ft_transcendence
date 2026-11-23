import { errorKey, fromErrorCode } from '@services/api-client';
import { ASSET_ERROR_MESSAGES, ASSET_FIELD_ERRORS } from '../constants';

// A refusal as a translation key: its own message when the code is known, the general one otherwise.
export const assetErrorKey = (error: unknown) => errorKey(ASSET_ERROR_MESSAGES, error);

// The form field a refusal belongs to, if any; anything else shows above the form.
export const assetErrorField = (error: unknown) => fromErrorCode(ASSET_FIELD_ERRORS, error);
