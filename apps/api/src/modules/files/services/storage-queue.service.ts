import { InjectQueue } from "@nestjs/bullmq";
import { Injectable } from "@nestjs/common";
import { Queue } from "bullmq";

import { QUEUE_JOB_OPTIONS, QUEUE_NAMES, StorageDeleteJobSchema, type StorageDeleteJob } from "@workspace/shared";

import { TypedConfigService } from "../../../config/typed-config.service";

@Injectable()
export class StorageQueueService {
	public constructor(
		private readonly config: TypedConfigService,
		@InjectQueue(QUEUE_NAMES[6]) private readonly deleteQueue: Queue<StorageDeleteJob>,
	) {}

	public async enqueuePhysicalDelete(input: { fileId: string; bucket: string; path: string }): Promise<void> {
		if (!this.config.useBullMq) {
			return;
		}

		const payload = StorageDeleteJobSchema.parse({
			fileId: input.fileId,
			bucket: input.bucket,
			path: input.path,
		});

		await this.deleteQueue.add("physical-delete", payload, {
			...QUEUE_JOB_OPTIONS.storageDelete,
			jobId: `storage-delete:${input.fileId}`,
			delay: this.config.storagePhysicalDeleteDelayMs,
		});
	}
}
