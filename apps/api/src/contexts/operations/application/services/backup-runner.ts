// ============================================
// application/services/backup-runner.ts — taking one backup, and the daily schedule
// ============================================
// Single Responsibility: this class orchestrates (mark running → dump → store → mark finished);
// dumping, storing and queueing are ports. A failure at any step marks the backup FAILED with the
// reason, and removes whatever was half-written.

import { epochMs, type EpochMs } from "@workspace/shared";

import type { ActorContext } from "../../../../platform/application/actor-context";
import type { Clock } from "../../../../platform/application/clock.port";
import type { UnitOfWork } from "../../../../platform/application/unit-of-work.port";
import { expiredBackupIds, isScheduledBackupDue } from "../../domain/policies/backup-schedule.policy";
import type { OperationsScope } from "../operations-scope";
import type { BackupQueuePort, BackupStoragePort, DatabaseDumpPort, StoredBackup } from "../ports/backup.ports";
import { OPS_BACKUP_RUN_OPERATION } from "../ports/operations.tokens";

export interface BackupRunnerDeps {
	readonly uow: UnitOfWork<OperationsScope>;
	readonly dump: DatabaseDumpPort;
	readonly storage: BackupStoragePort;
	readonly queue: BackupQueuePort;
	readonly clock: Clock;
	readonly actor: ActorContext;
	readonly timeZone: string;
}

export class BackupRunner {
	public constructor(private readonly deps: BackupRunnerDeps) {}

	/** Takes one queued backup. Never throws for a backup failure: it is recorded on the row. */
	public async run(backupId: string): Promise<void> {
		const { uow, actor, clock } = this.deps;
		const availability = this.deps.dump.availability();
		if (!availability.ready) {
			await uow.runSystemOperation(OPS_BACKUP_RUN_OPERATION, actor, (scope) =>
				scope.backups.markFinished(backupId, { status: "FAILED", at: clock.now(), error: availability.reason }),
			);
			return;
		}
		let stored: StoredBackup | null = null;
		try {
			const versions = await this.deps.dump.versions();
			const startedAt: EpochMs = clock.now();
			await uow.runSystemOperation(OPS_BACKUP_RUN_OPERATION, actor, (scope) => scope.backups.markRunning(backupId, startedAt, versions));
			const running = await this.deps.dump.dump();
			// Both must succeed: the upload of the bytes, and pg_dump's own exit. Settled separately so a
			// stored object whose dump then failed is still known, and removed below.
			const [upload, exit] = await Promise.allSettled([this.deps.storage.store(backupId, startedAt, running.stream), running.finished]);
			if (upload.status === "fulfilled") {
				stored = upload.value;
			}
			if (upload.status === "rejected") {
				throw upload.reason instanceof Error ? upload.reason : new Error(String(upload.reason));
			}
			if (exit.status === "rejected") {
				throw exit.reason instanceof Error ? exit.reason : new Error(String(exit.reason));
			}
			const finished: StoredBackup = upload.value;
			await uow.runSystemOperation(OPS_BACKUP_RUN_OPERATION, actor, (scope) =>
				scope.backups.markFinished(backupId, {
					status: "SUCCEEDED",
					at: clock.now(),
					sizeBytes: finished.sizeBytes,
					checksum: finished.checksum,
					storageContainer: finished.container,
					storagePath: finished.path,
				}),
			);
		} catch (error) {
			if (stored !== null) {
				await this.deps.storage.remove(stored.container, stored.path).catch(() => undefined);
			}
			const reason: string = error instanceof Error ? error.message : String(error);
			await uow.runSystemOperation(OPS_BACKUP_RUN_OPERATION, actor, (scope) => scope.backups.markFinished(backupId, { status: "FAILED", at: clock.now(), error: reason }));
		}
	}

	/**
	 * The hourly check: queues the daily backup when it is due (and none is queued or running), then
	 * removes the backups past their retention (pinned ones are kept). Returns the queued backup's id.
	 */
	public async scheduledCheck(): Promise<string | null> {
		const { uow, actor, clock } = this.deps;
		const now: EpochMs = clock.now();
		const outcome = await uow.runSystemOperation(OPS_BACKUP_RUN_OPERATION, actor, async (scope) => {
			const settings = await scope.settings.get();
			const expired: string[] = expiredBackupIds(
				(await scope.backups.list()).filter((backup) => backup.status === "SUCCEEDED" || backup.status === "FAILED"),
				settings.backup.retentionDays,
				now,
			);
			const removed = await Promise.all(
				expired.map(async (backupId) => {
					const backup = await scope.backups.find(backupId);
					await scope.backups.remove(backupId, now, null);
					return backup;
				}),
			);
			const due: boolean = isScheduledBackupDue(settings.backup.backupHour, this.deps.timeZone, await scope.backups.lastScheduledAt(), now);
			const queued = due && (await scope.backups.findActive()) === null ? await scope.backups.create({ trigger: "SCHEDULED", requestedById: null }) : null;
			return { removed, queued };
		});
		for (const backup of outcome.removed) {
			if (backup?.storageContainer !== null && backup?.storageContainer !== undefined && backup.storagePath !== null) {
				await this.deps.storage.remove(backup.storageContainer, backup.storagePath).catch(() => undefined);
			}
		}
		if (outcome.queued === null) {
			return null;
		}
		await this.deps.queue.enqueue(outcome.queued.id);
		return outcome.queued.id;
	}
}

/** `backups/2026/10/<id>.dump` — one folder per month, so a bucket listing stays readable. */
export function backupObjectPath(backupId: string, takenAt: number): string {
	const date = new Date(epochMs(takenAt));
	const monthDigits = 2;
	return `backups/${String(date.getUTCFullYear())}/${String(date.getUTCMonth() + 1).padStart(monthDigits, "0")}/${backupId}.dump`;
}
