/** The maintenance job's storage, under `queue.feature_flags.maintenance`. */
export interface FlagMaintenanceStore {
	/** Marks pending revisions past their expiry EXPIRED; how many. */
	expirePending(at: number): Promise<number>;
	/**
	 * Raises the catalogue version when a live revision's scheduled rollout has a step in `(from, to]`; the new
	 * version, or null when none did.
	 */
	bumpForStepsBetween(from: number, to: number): Promise<number | null>;
}

export const FLAG_MAINTENANCE_STORE = Symbol("FLAG_MAINTENANCE_STORE");
