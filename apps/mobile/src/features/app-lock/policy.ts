// ============================================
// policy.ts - when the app lock asks (§11.2, §11.5), as pure functions
// ============================================

/** What the lock decision needs, at the moment the app returns to the foreground. */
export interface ResumeLockInput {
	readonly lockEnabled: boolean;
	/** Epoch ms when the app went to the background; `null` when it never did in this run. */
	readonly backgroundedAt: number | null;
	readonly now: number;
	readonly timeoutMs: number;
}

/**
 * Returning from the background locks the app when the lock is on and it was
 * away for at least the timeout (`now - backgroundedAt >= timeout`; "Immediately"
 * is a timeout of 0). A clock that went backwards counts as zero time away.
 */
export function shouldLockOnResume(input: ResumeLockInput): boolean {
	if (!input.lockEnabled || input.backgroundedAt === null) {
		return false;
	}
	return Math.max(0, input.now - input.backgroundedAt) >= input.timeoutMs;
}
