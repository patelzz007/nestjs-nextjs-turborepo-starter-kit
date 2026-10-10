// ============================================
// session-countdown.ts - the access token's countdown, computed on the device
// ============================================
// The same arithmetic as the admin topbar's session badge
// (apps/admin/lib/session/status-badge-helpers.ts): the API serves the token's
// `exp` once (`GET /session` → `expiresAt`) and the app counts down to it
// locally, so the countdown keeps running without a request per second.

const MS_PER_SECOND = 1_000;
const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;

/** The minutes after an hour and the seconds after a minute always show two digits ("1h 05m", "4m 09s"). */
const PADDED_WIDTH = 2;

/** Whole seconds from `nowMs` until `expiresAtMs` (both epoch ms), never below zero. */
export function secondsUntil(expiresAtMs: number, nowMs: number): number {
	return Math.max(0, Math.round((expiresAtMs - nowMs) / MS_PER_SECOND));
}

/**
 * True when a silent refresh rotated the token: the new expiry is strictly
 * later than the one seen before. The first sighting (`previous === null`)
 * is not a rotation.
 */
export function didTokenRotate(previous: number | null, next: number | null): boolean {
	if (previous === null || next === null) {
		return false;
	}
	return next > previous;
}

function padded(value: number): string {
	return String(value).padStart(PADDED_WIDTH, "0");
}

/**
 * "14m 32s". `compact` shortens an hour or more to "2h 05m", so a long-lived
 * token still fits the corner pill.
 */
export function formatTimeLeft(totalSeconds: number, compact: boolean): string {
	const minutes = Math.floor(totalSeconds / SECONDS_PER_MINUTE);
	const seconds = totalSeconds % SECONDS_PER_MINUTE;
	if (compact && minutes >= MINUTES_PER_HOUR) {
		return `${String(Math.floor(minutes / MINUTES_PER_HOUR))}h ${padded(minutes % MINUTES_PER_HOUR)}m`;
	}
	return `${String(minutes)}m ${padded(seconds)}s`;
}
