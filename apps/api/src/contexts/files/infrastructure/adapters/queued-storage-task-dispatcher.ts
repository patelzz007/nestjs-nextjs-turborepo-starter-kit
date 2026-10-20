import type { JobsOptions } from "bullmq";
import {
	QUEUE_JOB_OPTIONS,
	QUEUE_NAMES,
	StorageCdnInvalidationJobSchema,
	StorageDeleteJobSchema,
	StorageScanJobSchema,
	type FileVariantKind,
	type StorageCdnInvalidationJob,
	type StorageDeleteJob,
	type StorageScanJob,
} from "@workspace/shared";

import { StorageTaskDispatcher } from "../../application/ports/storage-task-dispatcher.port";

/** `storage.scan` queue. */
export const STORAGE_SCAN_QUEUE = QUEUE_NAMES.storageScan;
/** `storage.delete` queue. */
export const STORAGE_DELETE_QUEUE = QUEUE_NAMES.storageDelete;
/** `storage.cdn-invalidate` queue. */
export const STORAGE_CDN_INVALIDATE_QUEUE = QUEUE_NAMES.storageCdnInvalidate;
/** `storage.cleanup` queue (hourly sweep). */
export const STORAGE_CLEANUP_QUEUE = QUEUE_NAMES.storageCleanup;

/** The one queue operation the dispatcher needs (a BullMQ `Queue<T>` satisfies it). */
export interface StorageJobQueue<T> {
	add(name: string, data: T, options: JobsOptions): Promise<object>;
}

/** The job id of one copy's physical delete. The original keeps the historical id; each rendition gets its own (BullMQ forbids ":" in ids). */
export function physicalDeleteJobId(fileId: string, slot: FileVariantKind): string {
	return slot === "ORIGINAL" ? `storage-delete-${fileId}` : `storage-delete-${fileId}-${slot.toLowerCase()}`;
}

/**
 * BullMQ-backed dispatcher (REDIS_URL set). Job ids dedupe repeated dispatches
 * of the same work, so a retried after-commit handler never enqueues twice.
 * Built by FilesModule's factory.
 */
export class QueuedStorageTaskDispatcher extends StorageTaskDispatcher {
	public constructor(
		private readonly physicalDeleteDelayMs: number,
		private readonly scanQueue: StorageJobQueue<StorageScanJob>,
		private readonly deleteQueue: StorageJobQueue<StorageDeleteJob>,
		private readonly cdnInvalidationQueue: StorageJobQueue<StorageCdnInvalidationJob>,
	) {
		super();
	}

	public async dispatchScan(fileId: string): Promise<void> {
		await this.scanQueue.add("scan", StorageScanJobSchema.parse({ fileId }), { ...QUEUE_JOB_OPTIONS.storageScan, jobId: `storage-scan-${fileId}` });
	}

	public async redispatchScan(fileId: string): Promise<void> {
		// A fresh job id: the original job may still be retained (completed/failed), which would dedupe a re-add.
		await this.scanQueue.add("scan", StorageScanJobSchema.parse({ fileId }), {
			...QUEUE_JOB_OPTIONS.storageScan,
			jobId: `storage-scan-${fileId}-redispatch-${String(Date.now())}`,
		});
	}

	public async dispatchPhysicalDelete(job: StorageDeleteJob, slot: FileVariantKind): Promise<void> {
		await this.deleteQueue.add("physical-delete", StorageDeleteJobSchema.parse(job), {
			...QUEUE_JOB_OPTIONS.storageDelete,
			jobId: physicalDeleteJobId(job.fileId, slot),
			delay: this.physicalDeleteDelayMs,
		});
	}

	/** Enqueued, never awaited against the CDN: the request returns while the worker retries with backoff. */
	public async dispatchCdnInvalidation(job: StorageCdnInvalidationJob): Promise<void> {
		await this.cdnInvalidationQueue.add("cdn-invalidate", StorageCdnInvalidationJobSchema.parse(job), {
			...QUEUE_JOB_OPTIONS.storageCdnInvalidate,
			jobId: `storage-cdn-invalidate-${job.fileId}`,
		});
	}
}
