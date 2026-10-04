import type { StorageCdnInvalidationJob, StorageDeleteJob } from "@workspace/shared";

/**
 * Hands post-request storage work (malware scans, delayed physical deletes,
 * CDN purges of withdrawn public assets) to
 * whichever executor this deployment has. Two implementations, chosen once at
 * module load from the validated config (FilesModule):
 *
 * - {@link QueuedStorageTaskDispatcher} — BullMQ (REDIS_URL set; required in production).
 * - {@link InlineStorageTaskDispatcher} — no Redis (local development): the work
 *   runs inside the request, synchronously and observably.
 *
 * Neither silently drops work: a dispatch either happens or throws.
 */
export abstract class StorageTaskDispatcher {
	/** Starts the malware scan of a file that was just claimed into SCANNING. */
	public abstract dispatchScan(fileId: string): Promise<void>;

	/** Re-dispatches a scan whose verdict is overdue (lost job, outage beyond retries). */
	public abstract redispatchScan(fileId: string): Promise<void>;

	/** Physically deletes the bytes of a soft-deleted file (after the retention delay where a scheduler exists). */
	public abstract dispatchPhysicalDelete(job: StorageDeleteJob): Promise<void>;

	/** Purges a withdrawn public asset's keys from the CDN cache (retried until the CDN accepts it). */
	public abstract dispatchCdnInvalidation(job: StorageCdnInvalidationJob): Promise<void>;
}
