// ============================================
// infrastructure/backup/backup-queue.ts — handing a backup to the worker
// ============================================
// Design patterns:
//   - STRATEGY: the BullMQ queue when Redis is configured (always in production), a run in this
//     process otherwise — both behind `BackupQueuePort`, chosen once at module load (like the files
//     context's storage tasks).

import { Logger } from "@nestjs/common";
import { QUEUE_JOB_OPTIONS, CaughtValueSchema } from "@workspace/shared";
import type { Queue } from "bullmq";

import type { BackupQueuePort } from "../../application/ports/backup.ports";
import { caughtErrorLogFields } from "../../../../platform/application/errors/caught-error-log";

/** The backup job's payload. */
export interface OpsBackupJob {
	readonly backupId: string;
}

/** The job name on the `operations.backup` queue. */
export const OPS_BACKUP_JOB_NAME = "take-backup";

export class BullBackupQueue implements BackupQueuePort {
	public constructor(private readonly queue: Pick<Queue<OpsBackupJob>, "add">) {}

	/** One job per backup (`jobId` = backup id, so a retried request never queues it twice). */
	public async enqueue(backupId: string): Promise<void> {
		await this.queue.add(OPS_BACKUP_JOB_NAME, { backupId }, { ...QUEUE_JOB_OPTIONS.operationsBackup, jobId: backupId });
	}
}

/** Without Redis: the backup runs in this process, after the request that queued it has answered. */
export class InlineBackupQueue implements BackupQueuePort {
	private readonly logger: Logger = new Logger(InlineBackupQueue.name);

	public constructor(private readonly run: (backupId: string) => Promise<void>) {}

	public enqueue(backupId: string): Promise<void> {
		setImmediate((): void => {
			this.run(backupId).catch((error: unknown): void => {
				this.logger.error({ event: "operations.backup.inline_failed", backupId, ...caughtErrorLogFields(CaughtValueSchema.safeParse(error).data) });
			});
		});
		return Promise.resolve();
	}
}
