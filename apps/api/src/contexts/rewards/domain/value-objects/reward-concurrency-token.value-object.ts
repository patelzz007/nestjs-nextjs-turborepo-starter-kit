import { epochMs, type EpochMs } from "@workspace/shared";

import type { RewardLifecycleStatus } from "./reward-status.value-object";

/**
 * What a reward row looked like when a command loaded it. Saving compares all three fields
 * (compare-and-set): a concurrent review decision changes `status`, any other save moves
 * `updatedAt`, and a resubmission moves `autoPublishAt` — each makes the stale save match nothing.
 */
export interface RewardConcurrencyToken {
	readonly status: RewardLifecycleStatus;
	readonly updatedAt: EpochMs;
	readonly autoPublishAt: EpochMs | null;
}

/** The smallest step `updatedAt` moves on a save, so two saves in the same millisecond still differ. */
const UPDATED_AT_STEP_MS = 1;

/** The `updatedAt` a save writes: now, but always strictly after the value it was loaded with. */
export function nextUpdatedAt(loaded: EpochMs, now: EpochMs): EpochMs {
	return epochMs(Math.max(now, loaded + UPDATED_AT_STEP_MS));
}
