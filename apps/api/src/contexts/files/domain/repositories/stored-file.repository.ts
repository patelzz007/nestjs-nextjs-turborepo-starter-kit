import type { StoredFileAggregate } from "../aggregates/stored-file.aggregate";

/**
 * Whether a save applied. `lost-race` means the row was no longer in the state
 * the aggregate was loaded in (a concurrent completion, a verdict racing a
 * delete, a redelivered job): nothing was written. Each caller maps that to its
 * own documented outcome (409, SKIPPED, 404), which is why this is a result and
 * not a thrown ConcurrentModificationError.
 */
export type StoredFileSaveOutcome = "applied" | "lost-race";

/** Repository port for the StoredFile aggregate. Implementations are bound to one unit-of-work transaction. */
export interface StoredFileRepository {
	/** Inserts a freshly requested (PENDING) file. */
	add(file: StoredFileAggregate): Promise<void>;

	/** A live (not deleted) file, or null. */
	findLive(fileId: string): Promise<StoredFileAggregate | null>;

	/**
	 * A live file locked `FOR UPDATE` together with every live rendition (read
	 * inside this transaction, so a deletion never works from a stale list), or null.
	 */
	lockForDeletion(fileId: string): Promise<StoredFileAggregate | null>;

	/** Persists the aggregate's pending change with a compare-and-set on the status it was loaded in. */
	save(file: StoredFileAggregate): Promise<StoredFileSaveOutcome>;
}
