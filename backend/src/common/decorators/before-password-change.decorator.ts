import { SetMetadata } from '@nestjs/common';
export const ALLOWED_BEFORE_PASSWORD_CHANGE = 'allowedBeforePasswordChange';
// The few endpoints an account may use while it must still replace an admin-given password (/auth/me, /auth/password).
export const BeforePasswordChange = () => SetMetadata(ALLOWED_BEFORE_PASSWORD_CHANGE, true);
