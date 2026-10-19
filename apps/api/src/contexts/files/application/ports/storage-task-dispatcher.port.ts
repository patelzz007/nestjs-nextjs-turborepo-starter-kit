import type { FileVariantKind, StorageCdnInvalidationJob, StorageDeleteJob } from "@workspace/shared";

/**
 * Hands post-request storage work (malware scans, delayed physical deletes,
 * CDN purges of withdrawn public assets) to whichever executor this
 * deployment has, chosen once at module load from the validated config:
 * BullMQ when Redis is configured (required in production), in-request otherwise.
 * Neither silently drops work: a dispatch either happens or throws.
 */
export abstract class StorageTaskDispatcher {
	/** Starts the malware scan of a file that was just claimed into SCANNING. */
	public abstract dispatchScan(fileId: string): Promise<void>;

	/** Re-dispatches a scan whose verdict is overdue (lost job, outage beyond retries). */
	public abstract redispatchScan(fileId: string): Promise<void>;

	/**
	 * Physically deletes one stored copy of a soft-deleted file (after the
	 * retention delay where a scheduler exists). `slot` keeps each copy's job
	 * distinct: the original and every rendition are separate objects.
	 */
	public abstract dispatchPhysicalDelete(job: StorageDeleteJob, slot: FileVariantKind): Promise<void>;

	/** Purges a withdrawn file's keys from the CDN cache (retried until the CDN accepts it). */
	public abstract dispatchCdnInvalidation(job: StorageCdnInvalidationJob): Promise<void>;
}
