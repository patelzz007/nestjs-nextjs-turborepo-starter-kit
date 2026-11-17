import { READY_TO_REMOVE_AFTER_DAYS, type FlagRule, type ReadyToRemoveReason } from "@workspace/shared";

// ── "Ready to remove from code" (a badge only: nothing happens by itself) ────────────────────────

const MS_PER_DAY = 86_400_000;
export const READY_TO_REMOVE_AFTER_MS = READY_TO_REMOVE_AFTER_DAYS * MS_PER_DAY;
const EVERYONE = 100;
const NO_ONE = 0;

export interface FlagStateForRemoval {
	readonly killed: boolean;
	/** When the kill switch or the live rules last changed; null: never configured. */
	readonly lastChangedAt: number | null;
	readonly rules: readonly FlagRule[];
	readonly overrideCount: number;
	/** The last exposure; null: never checked since exposures are kept. */
	readonly lastExposureAt: number | null;
	/** When the flag was first configured or exposures began, whichever is earlier; the "never checked" clock. */
	readonly trackedSince: number | null;
}

/** One unconditional fixed rule letting everyone in (or no one), and no overrides that say otherwise. */
function uniformShare(state: FlagStateForRemoval): number | null {
	const [only, ...rest] = state.rules;
	if (only === undefined || rest.length > 0 || only.conditions.length > 0 || only.rollout.kind !== "FIXED" || state.overrideCount > 0) {
		return null;
	}
	return only.rollout.percentage;
}

/**
 * Why a flag reads "ready to remove", or null. Killed, fully on or fully off for everyone without change for
 * 30 days, or never checked in the last 30 days of being tracked.
 */
export function readyToRemove(state: FlagStateForRemoval, now: number): ReadyToRemoveReason | null {
	const settled = state.lastChangedAt !== null && now - state.lastChangedAt >= READY_TO_REMOVE_AFTER_MS;
	if (settled && state.killed) {
		return "KILLED";
	}
	const share = settled && !state.killed ? uniformShare(state) : null;
	if (share === EVERYONE) {
		return "ALWAYS_ON";
	}
	if (share === NO_ONE) {
		return "ALWAYS_OFF";
	}
	const quietSince = state.lastExposureAt ?? state.trackedSince;
	if (quietSince !== null && now - quietSince >= READY_TO_REMOVE_AFTER_MS) {
		return "NEVER_CHECKED";
	}
	return null;
}
