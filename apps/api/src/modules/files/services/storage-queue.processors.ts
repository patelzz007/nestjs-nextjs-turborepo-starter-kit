import { InjectQueue, Processor, WorkerHost } from "@nestjs/bullmq";
import { Inject, Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import { Job, Queue } from "bullmq";
import {
	QUEUE_NAMES,
	StorageCdnInvalidationJobSchema,
	StorageCleanupJobSchema,
	StorageDeleteJobSchema,
	StorageScanJobSchema,
	type StorageCdnInvalidationJob,
} from "@workspace/shared";

import { registerMaintenanceScheduler } from "../../../infrastructure/jobs/maintenance-scheduler";
import { runWithSystemRlsContext } from "../../../prisma/rls-context";
import type { CdnCacheInvalidator } from "../../storage/domain/cdn-cache.port";
import { MalwareScannerUnavailableError } from "../../storage/domain/malware-scanner.port";
import type { ObjectStorage } from "../../storage/domain/object-storage.port";
import { CDN_CACHE_INVALIDATOR, OBJECT_STORAGE } from "../../storage/domain/storage.tokens";
import { toStorageObjectLocator } from "../../storage/utils/storage-locator.util";
import { StoredFileRepository } from "../repositories/stored-file.repository";
import { FileScanService } from "./file-scan.service";
import { toCdnInvalidationRequest } from "./cdn-invalidation.util";
import { STORAGE_CDN_INVALIDATE_QUEUE, STORAGE_DELETE_QUEUE, STORAGE_SCAN_QUEUE } from "./queued-storage-task-dispatcher";
import { StorageTaskDispatcher } from "./storage-task-dispatcher";

const STORAGE_CLEANUP_QUEUE = QUEUE_NAMES.storageCleanup;
const STORAGE_CLEANUP_INTERVAL_MS = 60 * 60 * 1000;
const STORAGE_CLEANUP_SCHEDULER_ID = "storage-cleanup";
/** An upload ticket lives minutes; a PENDING row this old was abandoned. */
const STALE_PENDING_MAX_AGE_MS = 60 * 60 * 1000;
/** A scan that has produced no verdict for this long lost its job (or outlived its retries) and is re-dispatched. */
const STALE_SCANNING_MAX_AGE_MS = 30 * 60 * 1000;
/** `deletedBy` recorded when the sweep removes an abandoned upload. */
export const STORAGE_CLEANUP_ACTOR = "system:storage-cleanup";

@Injectable()
export class StorageQueueScheduler implements OnModuleInit {
	private readonly logger: Logger = new Logger(StorageQueueScheduler.name);

	public constructor(@InjectQueue(STORAGE_CLEANUP_QUEUE) private readonly cleanupQueue: Queue) {}

	public async onModuleInit(): Promise<void> {
		await registerMaintenanceScheduler(
			this.cleanupQueue,
			{
				queueName: STORAGE_CLEANUP_QUEUE,
				schedulerId: STORAGE_CLEANUP_SCHEDULER_ID,
				everyMs: STORAGE_CLEANUP_INTERVAL_MS,
				jobName: "cleanup-stale-uploads",
				data: StorageCleanupJobSchema.parse({}),
			},
			this.logger,
		);
		this.logger.log("Registered BullMQ storage cleanup scheduler");
	}
}

/**
 * Hourly sweep: deletes abandoned PENDING uploads and re-dispatches scans whose
 * verdict is overdue. One file's failure is logged and left for the next sweep
 * (its row is unchanged, so it is picked up again) — it never aborts the batch.
 */
@Processor(STORAGE_CLEANUP_QUEUE)
@Injectable()
export class StorageCleanupProcessor extends WorkerHost {
	private readonly logger: Logger = new Logger(StorageCleanupProcessor.name);

	public constructor(
		private readonly repository: StoredFileRepository,
		private readonly dispatcher: StorageTaskDispatcher,
		@Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
	) {
		super();
	}

	public async process(job: Job): Promise<void> {
		await runWithSystemRlsContext("queue.storage.cleanup", async (): Promise<void> => this.handle(job));
	}

	private async handle(job: Job): Promise<void> {
		StorageCleanupJobSchema.parse(job.data);
		await this.cleanStalePending();
		await this.redispatchStaleScans();
	}

	private async cleanStalePending(): Promise<void> {
		for (const file of await this.repository.listStalePending(STALE_PENDING_MAX_AGE_MS)) {
			try {
				// Row first: a completion racing the sweep wins, and then the bytes must stay.
				const deleted = await this.repository.softDeleteStalePending(file.id, STORAGE_CLEANUP_ACTOR);
				if (!deleted) {
					continue;
				}
				const locator = toStorageObjectLocator(file.storageProvider ?? "s3", file.storageContainer ?? file.storageBucket, file.storagePath);
				await this.storage.deleteObject(locator);
				this.logger.log(`Cleaned stale pending file ${file.id}`);
			} catch (error) {
				this.logger.error(`Failed to clean stale pending file ${file.id}: ${String(error)}`);
			}
		}
	}

	private async redispatchStaleScans(): Promise<void> {
		for (const file of await this.repository.listStaleAwaitingVerdict(STALE_SCANNING_MAX_AGE_MS)) {
			try {
				await this.dispatcher.redispatchScan(file.id);
				this.logger.warn(`Re-dispatched overdue scan for file ${file.id}`);
			} catch (error) {
				this.logger.error(`Failed to re-dispatch scan for file ${file.id}: ${String(error)}`);
			}
		}
	}
}

@Processor(STORAGE_DELETE_QUEUE)
@Injectable()
export class StorageDeleteProcessor extends WorkerHost {
	private readonly logger: Logger = new Logger(StorageDeleteProcessor.name);

	public constructor(@Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage) {
		super();
	}

	public async process(job: Job): Promise<void> {
		await runWithSystemRlsContext("queue.storage.delete", async (): Promise<void> => this.handle(job));
	}

	private async handle(job: Job): Promise<void> {
		const payload = StorageDeleteJobSchema.parse(job.data);
		await this.storage.deleteObject(toStorageObjectLocator(payload.provider, payload.container, payload.path));
		this.logger.log(`Physically deleted object for file ${payload.fileId}`);
	}
}

/**
 * Purges withdrawn public assets from the CDN. A failure throws, so BullMQ
 * retries the job with backoff (QUEUE_JOB_OPTIONS.storageCdnInvalidate); the
 * per-file CallerReference makes a retry after a lost response harmless.
 * Touches no database rows, so it needs no RLS context.
 */
@Processor(STORAGE_CDN_INVALIDATE_QUEUE)
@Injectable()
export class StorageCdnInvalidationProcessor extends WorkerHost {
	private readonly logger: Logger = new Logger(StorageCdnInvalidationProcessor.name);

	public constructor(@Inject(CDN_CACHE_INVALIDATOR) private readonly cdnCache: CdnCacheInvalidator) {
		super();
	}

	public async process(job: Job): Promise<void> {
		await this.purge(StorageCdnInvalidationJobSchema.parse(job.data));
	}

	/** One attempt; a rejection is BullMQ's signal to retry. */
	public async purge(payload: StorageCdnInvalidationJob): Promise<void> {
		await this.cdnCache.invalidate(toCdnInvalidationRequest(payload));
		this.logger.log(`Invalidated CDN cache for withdrawn file ${payload.fileId}`);
	}
}

/**
 * Runs malware scans. A scanner outage is retried with backoff (the file stays
 * SCANNING, never downloadable); after the last attempt the upload is FAILED —
 * it is never treated as clean.
 */
@Processor(STORAGE_SCAN_QUEUE)
@Injectable()
export class StorageScanProcessor extends WorkerHost {
	private readonly logger: Logger = new Logger(StorageScanProcessor.name);

	public constructor(private readonly fileScan: FileScanService) {
		super();
	}

	public async process(job: Job): Promise<void> {
		await runWithSystemRlsContext("queue.storage.scan", async (): Promise<void> => this.handle(job));
	}

	private async handle(job: Job): Promise<void> {
		const payload = StorageScanJobSchema.parse(job.data);
		try {
			await this.fileScan.scan(payload.fileId);
		} catch (error) {
			const isLastAttempt = job.attemptsMade + 1 >= (job.opts.attempts ?? 1);
			if (error instanceof MalwareScannerUnavailableError && isLastAttempt) {
				this.logger.error(`Scan of file ${payload.fileId} failed after ${String(job.attemptsMade + 1)} attempts: ${error.message}`);
				await this.fileScan.failAfterExhaustedAttempts(payload.fileId, error.message);
				return;
			}
			throw error;
		}
	}
}
