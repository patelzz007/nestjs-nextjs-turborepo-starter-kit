import { Processor, WorkerHost, InjectQueue } from "@nestjs/bullmq";
import { Inject, Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import { Job, Queue, hasLegacyRepeatableKeyShape } from "bullmq";

import { QUEUE_NAMES, StorageCleanupJobSchema, StorageDeleteJobSchema } from "@workspace/shared";

import { TypedConfigService } from "../../../config/typed-config.service";
import { OBJECT_STORAGE } from "../../storage/storage.tokens";
import type { ObjectStorageService } from "../../storage/storage.types";
import { StoredFileRepository } from "../repositories/stored-file.repository";

const STORAGE_CLEANUP_INTERVAL_MS = 60 * 60 * 1000;
const STORAGE_CLEANUP_SCHEDULER_ID = "storage-cleanup";
const STALE_PENDING_MAX_AGE_MS = 60 * 60 * 1000;

@Injectable()
export class StorageQueueScheduler implements OnModuleInit {
	private readonly logger: Logger = new Logger(StorageQueueScheduler.name);

	public constructor(
		private readonly config: TypedConfigService,
		@InjectQueue(QUEUE_NAMES[5]) private readonly cleanupQueue: Queue,
	) {}

	public async onModuleInit(): Promise<void> {
		if (!this.config.useBullMq) {
			return;
		}

		const schedulers = await this.cleanupQueue.getJobSchedulers(0, -1, true);
		for (const scheduler of schedulers) {
			if (!hasLegacyRepeatableKeyShape(scheduler.key)) {
				continue;
			}
			try {
				await this.cleanupQueue.removeJobScheduler(scheduler.key);
				this.logger.warn(`Removed legacy repeatable scheduler ${scheduler.key} from ${QUEUE_NAMES[5]}`);
			} catch (error) {
				this.logger.warn(`Could not remove legacy repeatable scheduler ${scheduler.key}: ${String(error)}`);
			}
		}

		const payload = StorageCleanupJobSchema.parse({});
		await this.cleanupQueue.upsertJobScheduler(STORAGE_CLEANUP_SCHEDULER_ID, { every: STORAGE_CLEANUP_INTERVAL_MS }, { name: "cleanup-stale-pending", data: payload });
		this.logger.log("Registered BullMQ storage cleanup scheduler");
	}
}

@Processor(QUEUE_NAMES[5])
@Injectable()
export class StorageCleanupProcessor extends WorkerHost {
	private readonly logger: Logger = new Logger(StorageCleanupProcessor.name);

	public constructor(
		private readonly repository: StoredFileRepository,
		@Inject(OBJECT_STORAGE) private readonly storage: ObjectStorageService,
	) {
		super();
	}

	public async process(job: Job): Promise<void> {
		StorageCleanupJobSchema.parse(job.data);
		const staleFiles = await this.repository.listStalePending(STALE_PENDING_MAX_AGE_MS);
		for (const file of staleFiles) {
			try {
				await this.storage.deleteObject(file.storageBucket, file.storagePath);
				await this.repository.markDeleted(file.id);
				this.logger.log(`Cleaned stale pending file ${file.id}`);
			} catch (error) {
				this.logger.warn(`Failed to clean stale pending file ${file.id}: ${String(error)}`);
			}
		}
	}
}

@Processor(QUEUE_NAMES[6])
@Injectable()
export class StorageDeleteProcessor extends WorkerHost {
	private readonly logger: Logger = new Logger(StorageDeleteProcessor.name);

	public constructor(@Inject(OBJECT_STORAGE) private readonly storage: ObjectStorageService) {
		super();
	}

	public async process(job: Job): Promise<void> {
		const payload = StorageDeleteJobSchema.parse(job.data);
		try {
			await this.storage.deleteObject(payload.bucket, payload.path);
			this.logger.log(`Physically deleted object for file ${payload.fileId}`);
		} catch (error) {
			this.logger.warn(`Physical delete failed for file ${payload.fileId}: ${String(error)}`);
			throw error;
		}
	}
}
