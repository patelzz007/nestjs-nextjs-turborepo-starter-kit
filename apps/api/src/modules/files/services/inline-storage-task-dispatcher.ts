import { Logger } from "@nestjs/common";
import { StorageDeleteJobSchema, type StorageCdnInvalidationJob, type StorageDeleteJob } from "@workspace/shared";

import type { CdnCacheInvalidator } from "../../storage/domain/cdn-cache.port";
import type { ObjectStorage } from "../../storage/domain/object-storage.port";
import { MalwareScannerUnavailableError } from "../../storage/domain/malware-scanner.port";
import { toStorageObjectLocator } from "../../storage/utils/storage-locator.util";
import { toCdnInvalidationRequest } from "./cdn-invalidation.util";
import type { FileScanService } from "./file-scan.service";
import { StorageTaskDispatcher } from "./storage-task-dispatcher";

/**
 * Dispatcher for deployments without Redis (local development only — production
 * requires REDIS_URL). Work runs inside the request so its outcome is visible:
 *
 * - scans run before the completion response returns; with no queue to retry,
 *   a scanner outage fails the upload (FAILED) instead of leaving it pending forever;
 * - physical deletes happen immediately — there is no scheduler to honour
 *   STORAGE_PHYSICAL_DELETE_DELAY_MS without Redis;
 * - CDN purges run immediately and a failure surfaces in the request.
 *
 * Built by FilesModule's provider factory.
 */
export class InlineStorageTaskDispatcher extends StorageTaskDispatcher {
	private readonly logger: Logger = new Logger(InlineStorageTaskDispatcher.name);

	public constructor(
		private readonly fileScan: FileScanService,
		private readonly storage: ObjectStorage,
		private readonly cdnCache: CdnCacheInvalidator,
	) {
		super();
	}

	public async dispatchScan(fileId: string): Promise<void> {
		try {
			await this.fileScan.scan(fileId);
		} catch (error) {
			if (!(error instanceof MalwareScannerUnavailableError)) {
				throw error;
			}
			this.logger.error(`Inline scan of file ${fileId} could not obtain a verdict: ${error.message}`);
			await this.fileScan.failAfterExhaustedAttempts(fileId, error.message);
		}
	}

	public async redispatchScan(fileId: string): Promise<void> {
		await this.dispatchScan(fileId);
	}

	public async dispatchPhysicalDelete(job: StorageDeleteJob): Promise<void> {
		const payload = StorageDeleteJobSchema.parse(job);
		await this.storage.deleteObject(toStorageObjectLocator(payload.provider, payload.container, payload.path));
		this.logger.log(`Physically deleted object for file ${payload.fileId} (no Redis: deleted immediately, no retention delay)`);
	}

	public async dispatchCdnInvalidation(job: StorageCdnInvalidationJob): Promise<void> {
		await this.cdnCache.invalidate(toCdnInvalidationRequest(job));
		this.logger.log(`Invalidated CDN cache for file ${job.fileId} (no Redis: inline)`);
	}
}
