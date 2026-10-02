import { Processor, WorkerHost, InjectQueue } from "@nestjs/bullmq";
import { Inject, Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import { Job, Queue } from "bullmq";

import { QUEUE_NAMES, StorageCleanupJobSchema, StorageDeleteJobSchema } from "@workspace/shared";

import { TypedConfigService } from "../../../config/typed-config.service";
import type { ObjectStorage } from "../../storage/domain/object-storage.port";
import { OBJECT_STORAGE } from "../../storage/domain/storage.tokens";
import { toStorageObjectLocator } from "../../storage/utils/storage-locator.util";
import { StoredFileRepository } from "../repositories/stored-file.repository";
import { runWithSystemRlsContext } from "../../../prisma/rls-context";
import { registerMaintenanceScheduler } from "../../../infrastructure/jobs/maintenance-scheduler";

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

		await registerMaintenanceScheduler(
			this.cleanupQueue,
			{
				queueName: QUEUE_NAMES[5],
				schedulerId: STORAGE_CLEANUP_SCHEDULER_ID,
				everyMs: STORAGE_CLEANUP_INTERVAL_MS,
				jobName: "cleanup-stale-pending",
				data: StorageCleanupJobSchema.parse({}),
			},
			this.logger,
		);
		this.logger.log("Registered BullMQ storage cleanup scheduler");
	}
}

@Processor(QUEUE_NAMES[5])
@Injectable()
export class StorageCleanupProcessor extends WorkerHost {
	private readonly logger: Logger = new Logger(StorageCleanupProcessor.name);

	public constructor(
		private readonly repository: StoredFileRepository,
		@Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
	) {
		super();
	}

	public async process(job: Job): Promise<void> {
		await runWithSystemRlsContext("queue.job", async (): Promise<void> => this.handle(job));
	}

	private async handle(job: Job): Promise<void> {
		StorageCleanupJobSchema.parse(job.data);
		const staleFiles = await this.repository.listStalePending(STALE_PENDING_MAX_AGE_MS);
		for (const file of staleFiles) {
			try {
				const locator = toStorageObjectLocator(
					file.storageProvider ?? "s3",
					file.storageContainer ?? file.storageBucket,
					file.storagePath,
					file.objectRevision ?? file.objectGeneration,
				);
				await this.storage.deleteObject(locator);
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

	public constructor(@Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage) {
		super();
	}

	public async process(job: Job): Promise<void> {
		await runWithSystemRlsContext("queue.job", async (): Promise<void> => this.handle(job));
	}

	private async handle(job: Job): Promise<void> {
		const payload = StorageDeleteJobSchema.parse(job.data);
		const locator = toStorageObjectLocator(payload.provider, payload.container, payload.path);
		try {
			await this.storage.deleteObject(locator);
			this.logger.log(`Physically deleted object for file ${payload.fileId}`);
		} catch (error) {
			this.logger.warn(`Physical delete failed for file ${payload.fileId}: ${String(error)}`);
			throw error;
		}
	}
}
