import type { Readable } from "node:stream";

/** What a restore drill found in the restored copy (enhancement 2.6). */
export interface RestoreDrillChecks {
	/** Application tables found in the restored copy. */
	readonly tablesChecked: number;
	/** Rows across those tables. */
	readonly rowsRestored: number;
	/** The latest migration recorded in the restored copy. */
	readonly migration: string | null;
	/** What failed, one line each: the restore itself, a missing table, a table without row-level security… */
	readonly failures: readonly string[];
}

/**
 * Restores a backup into a throwaway database on the same server, checks it, and always drops it again. The
 * database it uses is its own (a unique name); the live database is never touched.
 */
export interface RestoreDrillPort {
	/** Whether drills can run here, and why not when they cannot. */
	availability(): { readonly ready: true } | { readonly ready: false; readonly reason: string };
	restoreAndCheck(dump: Readable): Promise<RestoreDrillChecks>;
}

/** Hands a due drill to the worker; the same `slot` (one per week) is never queued twice. */
export interface RestoreDrillQueuePort {
	enqueue(slot: string): Promise<void>;
}

export const RESTORE_DRILL = Symbol("RESTORE_DRILL");
export const RESTORE_DRILL_QUEUE = Symbol("RESTORE_DRILL_QUEUE");
export const RESTORE_DRILL_SERVICE = Symbol("RESTORE_DRILL_SERVICE");
