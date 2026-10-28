// ============================================
// infrastructure/backup/backup.processor.ts — the `operations.backup` worker
// ============================================
// One backup at a time (BullMQ's default concurrency of 1 per worker): two dumps would compete for
// the same database and disk. Mounted by `OperationsQueueModule` only when Redis is configured; the
// runner is the operations module's, found through ModuleRef.

import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Injectable } from "@nestjs/common";
import { ModuleRef } from "@nestjs/core";
import { QUEUE_NAMES } from "@workspace/shared";
import type { Job } from "bullmq";
import { z } from "zod";

import type { BackupRunner } from "../../application/services/backup-runner";
import { BACKUP_RUNNER } from "../../application/ports/operations.tokens";

const OpsBackupJobSchema = z.object({ backupId: z.uuid() }).strict();

@Processor(QUEUE_NAMES.operationsBackup)
@Injectable()
export class OpsBackupProcessor extends WorkerHost {
	public constructor(private readonly moduleRef: ModuleRef) {
		super();
	}

	public async process(job: Pick<Job, "data">): Promise<void> {
		const { backupId } = OpsBackupJobSchema.parse(job.data);
		await this.moduleRef.get<BackupRunner>(BACKUP_RUNNER, { strict: false }).run(backupId);
	}
}
