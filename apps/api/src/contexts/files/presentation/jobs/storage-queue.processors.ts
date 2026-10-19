import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Inject, Injectable } from "@nestjs/common";
import type { Job } from "bullmq";
import { QUEUE_NAMES, StorageCdnInvalidationJobSchema, StorageCleanupJobSchema, StorageDeleteJobSchema, StorageScanJobSchema } from "@workspace/shared";

import { systemActor } from "../../../../platform/application/actor-context";
import { SystemCommandDispatcher } from "../../../../platform/application/system-command-dispatcher";
import { CleanUpStaleUploadsCommand, type StaleUploadSweepSummary } from "../../application/commands/clean-up-stale-uploads/clean-up-stale-uploads.command";
import { InvalidateFileCdnCommand } from "../../application/commands/invalidate-file-cdn/invalidate-file-cdn.command";
import { PurgeFileObjectCommand } from "../../application/commands/purge-file-object/purge-file-object.command";
import { ScanFileCommand } from "../../application/commands/scan-file/scan-file.command";
import type { VerdictOutcome } from "../../application/ports/file-processing.port";
import { STORAGE_CLEANUP_OPERATION, STORAGE_DELETE_OPERATION, STORAGE_SCAN_OPERATION } from "../../application/ports/files.tokens";

/** BullMQ's default when a job carries no `attempts` option: a single execution. */
const DEFAULT_JOB_ATTEMPTS = 1;

/** The job fields a processor reads (a BullMQ `Job` satisfies it). */
export type StorageJobExecution = Pick<Job, "data" | "attemptsMade" | "opts">;

/** `storage.cleanup` → CleanUpStaleUploads (one file's failure never aborts the batch; it is retried next sweep). */
@Processor(QUEUE_NAMES.storageCleanup)
@Injectable()
export class StorageCleanupProcessor extends WorkerHost {
	public constructor(@Inject(SystemCommandDispatcher) private readonly commands: Pick<SystemCommandDispatcher, "dispatch">) {
		super();
	}

	public async process(job: Pick<Job, "data">): Promise<StaleUploadSweepSummary> {
		StorageCleanupJobSchema.parse(job.data);
		const actor = systemActor(STORAGE_CLEANUP_OPERATION, "job", null, "Expire abandoned and unused uploads", null);
		return this.commands.dispatch(new CleanUpStaleUploadsCommand(actor), { kind: "job", name: QUEUE_NAMES.storageCleanup });
	}
}

/** `storage.delete` → PurgeFileObject (the delayed physical delete of one stored copy). */
@Processor(QUEUE_NAMES.storageDelete)
@Injectable()
export class StorageDeleteProcessor extends WorkerHost {
	public constructor(@Inject(SystemCommandDispatcher) private readonly commands: Pick<SystemCommandDispatcher, "dispatch">) {
		super();
	}

	public async process(job: Pick<Job, "data">): Promise<void> {
		const payload = StorageDeleteJobSchema.parse(job.data);
		const actor = systemActor(STORAGE_DELETE_OPERATION, "job", null, `Physically delete a stored copy of file ${payload.fileId}`, null);
		await this.commands.dispatch(new PurgeFileObjectCommand(actor, payload), { kind: "job", name: QUEUE_NAMES.storageDelete });
	}
}

/**
 * `storage.cdn-invalidate` → InvalidateFileCdn. A failure rethrows, so BullMQ
 * retries with backoff (QUEUE_JOB_OPTIONS.storageCdnInvalidate); the per-file
 * reference makes a retry after a lost response harmless. It runs as the
 * deletion's queue operation: the purge is the last step of deleting a file.
 */
@Processor(QUEUE_NAMES.storageCdnInvalidate)
@Injectable()
export class StorageCdnInvalidationProcessor extends WorkerHost {
	public constructor(@Inject(SystemCommandDispatcher) private readonly commands: Pick<SystemCommandDispatcher, "dispatch">) {
		super();
	}

	public async process(job: Pick<Job, "data">): Promise<void> {
		const payload = StorageCdnInvalidationJobSchema.parse(job.data);
		const actor = systemActor(STORAGE_DELETE_OPERATION, "job", null, `Purge the CDN copies of deleted file ${payload.fileId}`, null);
		await this.commands.dispatch(new InvalidateFileCdnCommand(actor, payload), { kind: "job", name: QUEUE_NAMES.storageCdnInvalidate });
	}
}

/**
 * `storage.scan` → ScanFile. A scanner outage is retried with backoff (the
 * file stays SCANNING, never downloadable); on the last attempt the upload is
 * FAILED — it is never treated as clean.
 */
@Processor(QUEUE_NAMES.storageScan)
@Injectable()
export class StorageScanProcessor extends WorkerHost {
	public constructor(@Inject(SystemCommandDispatcher) private readonly commands: Pick<SystemCommandDispatcher, "dispatch">) {
		super();
	}

	public async process(job: StorageJobExecution): Promise<VerdictOutcome> {
		const payload = StorageScanJobSchema.parse(job.data);
		const finalAttempt = job.attemptsMade + 1 >= (job.opts.attempts ?? DEFAULT_JOB_ATTEMPTS);
		const actor = systemActor(STORAGE_SCAN_OPERATION, "job", null, `Malware-scan file ${payload.fileId} and apply its verdict`, null);
		return this.commands.dispatch(new ScanFileCommand(actor, payload.fileId, finalAttempt), { kind: "job", name: QUEUE_NAMES.storageScan });
	}
}
