const MS_PER_SECOND = 1_000;
const SECONDS_PER_MINUTE = 60;
const SECONDS_WIDTH = 2;

/** Whole seconds left on a hold, never below zero. */
export function holdSecondsLeft(holdExpiresAt: number, now: number): number {
	return Math.max(0, Math.ceil((holdExpiresAt - now) / MS_PER_SECOND));
}

/** Seconds as a clock: `4:05`. */
export function formatHoldTime(seconds: number): string {
	const minutes = Math.floor(seconds / SECONDS_PER_MINUTE);
	return `${String(minutes)}:${String(seconds % SECONDS_PER_MINUTE).padStart(SECONDS_WIDTH, "0")}`;
}

/** The claim flow stays open for a customer holding a unit, even when that unit made the reward look sold out. */
export function showsClaimFlow(canClaim: boolean, holdingUnit: boolean): boolean {
	return canClaim || holdingUnit;
}
