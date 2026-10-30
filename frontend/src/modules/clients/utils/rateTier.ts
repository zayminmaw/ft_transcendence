import { RATE_TIERS, type RateTier } from '../constants';

// Whether a saved rate_profile_tier is one the screens know, so it can be shown translated.
export const isRateTier = (value?: string): value is RateTier =>
	RATE_TIERS.includes(value as RateTier);
