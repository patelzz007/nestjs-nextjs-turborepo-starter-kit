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
import type { RestoreDrillQueuePort } from "../../application/ports/restore-drill.port";
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

/** The restore drill's job name on the same `operations.backup` queue: one job at a time, never beside a dump. */
export const OPS_RESTORE_DRILL_JOB_NAME = "restore-drill";

/** The drill's payload: which week it belongs to (the job id carries the same). */
export interface OpsRestoreDrillJob {
	readonly slot: string;
}

/** One job per week (`jobId` = the week's slot), so every instance asking queues it once (enhancement 2.6). */
export class BullRestoreDrillQueue implements RestoreDrillQueuePort {
	public constructor(private readonly queue: Pick<Queue<OpsBackupJob | OpsRestoreDrillJob>, "add">) {}

	public async enqueue(slot: string): Promise<void> {
		await this.queue.add(OPS_RESTORE_DRILL_JOB_NAME, { slot }, { ...QUEUE_JOB_OPTIONS.operationsBackup, jobId: `restore-drill-${slot}` });
	}
}

/** Without Redis: the drill runs in this process (one instance in development). */
export class InlineRestoreDrillQueue implements RestoreDrillQueuePort {
	private readonly logger: Logger = new Logger(InlineRestoreDrillQueue.name);
	private readonly started = new Set<string>();

	public constructor(private readonly run: () => Promise<void>) {}

	public enqueue(slot: string): Promise<void> {
		if (this.started.has(slot)) {
			return Promise.resolve();
		}
		this.started.add(slot);
		setImmediate((): void => {
			this.run().catch((error: unknown): void => {
				this.logger.error({ event: "operations.restore_drill.inline_failed", slot, ...caughtErrorLogFields(CaughtValueSchema.safeParse(error).data) });
			});
		});
		return Promise.resolve();
	}
}
