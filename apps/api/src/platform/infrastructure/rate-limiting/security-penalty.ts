// ============================================
// platform/infrastructure/rate-limiting/security-penalty.ts — the penalty every security policy shares
// ============================================
// ADR 071: three refusals within an hour start a 15-minute penalty; the next ones an hour, then a day.
// The step count resets after a day without a refusal.

import type { PenaltyRule } from "../../application/ports/rate-limiter.port";

const MS_PER_MINUTE = 60_000;
const MS_PER_HOUR = 60 * MS_PER_MINUTE;
const MS_PER_DAY = 24 * MS_PER_HOUR;

/** Refusals within {@link SECURITY_STRIKE_WINDOW_MS} that start a penalty. */
export const SECURITY_STRIKE_THRESHOLD = 3;
export const SECURITY_STRIKE_WINDOW_MS = MS_PER_HOUR;
export const SECURITY_PENALTY_STEPS_MS: readonly number[] = [15 * MS_PER_MINUTE, MS_PER_HOUR, MS_PER_DAY];
export const SECURITY_PENALTY_RESET_MS = MS_PER_DAY;

export const SECURITY_PENALTY: PenaltyRule = {
	strikeThreshold: SECURITY_STRIKE_THRESHOLD,
	strikeWindowMs: SECURITY_STRIKE_WINDOW_MS,
	stepsMs: SECURITY_PENALTY_STEPS_MS,
	resetAfterMs: SECURITY_PENALTY_RESET_MS,
};
