// ============================================
// infrastructure/backup/backup.processor.ts — the `operations.backup` worker
// ============================================
// One backup at a time (BullMQ's default concurrency of 1 per worker): two dumps would compete for
// the same database and disk. Mounted by `OperationsQueueModule` only when Redis is configured; the
// runner is the operations module's, found through ModuleRef.

import { Processor, WorkerHost } from "@nestjs/bullmq";
import { MONITORED_WORKER_OPTIONS } from "@workspace/messaging/nest";
import { Injectable } from "@nestjs/common";
import { ModuleRef } from "@nestjs/core";
import { QUEUE_NAMES } from "@workspace/shared";
import type { Job } from "bullmq";
import { z } from "zod";

import type { BackupRunner } from "../../application/services/backup-runner";
import type { RestoreDrillService } from "../../application/services/restore-drill.service";
import { BACKUP_RUNNER, OPS_RESTORE_DRILL_OPERATION } from "../../application/ports/operations.tokens";
import { RESTORE_DRILL_SERVICE } from "../../application/ports/restore-drill.port";
import { systemActor } from "../../../../platform/application/actor-context";
import { OPS_RESTORE_DRILL_JOB_NAME } from "./backup-queue";

const OpsBackupJobSchema = z.object({ backupId: z.uuid() }).strict();

@Processor(QUEUE_NAMES.operationsBackup, MONITORED_WORKER_OPTIONS)
@Injectable()
export class OpsBackupProcessor extends WorkerHost {
	public constructor(private readonly moduleRef: ModuleRef) {
		super();
	}

	public async process(job: Pick<Job, "data" | "name">): Promise<void> {
		if (job.name === OPS_RESTORE_DRILL_JOB_NAME) {
			const actor = systemActor(OPS_RESTORE_DRILL_OPERATION, "job", null, "Restore the latest backup into a throwaway database and check it", null);
			await this.moduleRef.get<RestoreDrillService>(RESTORE_DRILL_SERVICE, { strict: false }).run(actor);
			return;
		}
		const { backupId } = OpsBackupJobSchema.parse(job.data);
		await this.moduleRef.get<BackupRunner>(BACKUP_RUNNER, { strict: false }).run(backupId);
	}
}
