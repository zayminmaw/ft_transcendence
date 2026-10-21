import { SetMetadata } from '@nestjs/common';
export const IS_PLATFORM_ADMIN = 'isPlatformAdmin';
// For platform endpoints (tenants, platform activity). Access comes only from the platform_admin role in user_roles,
// never from a company membership or the X-Organization-Id header. The roles task can narrow it to exact platform codes.
export const PlatformAdmin = () => SetMetadata(IS_PLATFORM_ADMIN, true);
