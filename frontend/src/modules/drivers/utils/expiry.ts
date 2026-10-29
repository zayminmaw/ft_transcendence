import { parseDay } from '@utils/format';
import { EXPIRY_WARNING_DAYS } from '../constants';

export type ExpiryState = 'expired' | 'soon' | 'valid';

// Whether a 'YYYY-MM-DD' expiry date has passed, falls within EXPIRY_WARNING_DAYS, or is further away. Compared
// as calendar days in the browser's time zone, so a license expiring today still counts as valid today.
export function expiryState(date: string, today = new Date()): ExpiryState {
	const expiry = parseDay(date);
	const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
	const days = Math.round((expiry.getTime() - start.getTime()) / 86_400_000);
	if (days < 0) return 'expired';
	return days <= EXPIRY_WARNING_DAYS ? 'soon' : 'valid';
}
