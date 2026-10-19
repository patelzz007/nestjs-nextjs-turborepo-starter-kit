import { Logger } from "@nestjs/common";
import { StorageDeleteJobSchema, type StorageCdnInvalidationJob, type StorageDeleteJob } from "@workspace/shared";

import { systemActor, type ActorContext } from "../../../../platform/application/actor-context";
import type { FileObjectStoragePort } from "../../application/ports/file-object-storage.port";
import type { CdnInvalidationPort, FileProcessingPort } from "../../application/ports/file-processing.port";
import { STORAGE_SCAN_OPERATION } from "../../application/ports/files.tokens";
import { StorageTaskDispatcher } from "../../application/ports/storage-task-dispatcher.port";

/** The inline scan runs as the scan job would. */
function inlineScanActor(fileId: string): ActorContext {
	return systemActor(STORAGE_SCAN_OPERATION, "job", null, `Inline malware scan of file ${fileId} (no Redis)`, null);
}

/**
 * Dispatcher for deployments without Redis (local development only — production
 * requires REDIS_URL). Work runs inside the request so its outcome is visible:
 *
 * - scans run before the completion response returns; with no queue to retry,
 *   a scanner outage fails the upload (FAILED) instead of leaving it pending forever;
 * - physical deletes happen immediately — there is no scheduler to honour
 *   STORAGE_PHYSICAL_DELETE_DELAY_MS without Redis;
 * - CDN purges run immediately and a failure surfaces to the caller.
 *
 * Built by FilesModule's provider factory.
 */
export class InlineStorageTaskDispatcher extends StorageTaskDispatcher {
	private readonly logger: Logger = new Logger(InlineStorageTaskDispatcher.name);

	public constructor(
		private readonly processing: FileProcessingPort,
		private readonly storage: FileObjectStoragePort,
		private readonly cdn: CdnInvalidationPort,
	) {
		super();
	}

	public async dispatchScan(fileId: string): Promise<void> {
		// Every inline scan is the final attempt: there is no queue to retry it.
		await this.processing.scan(inlineScanActor(fileId), fileId, true);
	}

	public async redispatchScan(fileId: string): Promise<void> {
		await this.dispatchScan(fileId);
	}

	public async dispatchPhysicalDelete(job: StorageDeleteJob): Promise<void> {
		const payload = StorageDeleteJobSchema.parse(job);
		await this.storage.deleteObject({ provider: payload.provider, container: payload.container, path: payload.path });
		this.logger.log(`Physically deleted object for file ${payload.fileId} (no Redis: deleted immediately, no retention delay)`);
	}

	public async dispatchCdnInvalidation(job: StorageCdnInvalidationJob): Promise<void> {
		await this.cdn.invalidate(job);
		this.logger.log(`Invalidated CDN cache for file ${job.fileId} (no Redis: inline)`);
	}
}
