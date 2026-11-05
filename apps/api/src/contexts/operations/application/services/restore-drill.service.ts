import { createHash } from "node:crypto";
import { PassThrough } from "node:stream";

import type { ActorContext } from "../../../../platform/application/actor-context";
import type { Clock } from "../../../../platform/application/clock.port";
import type { UnitOfWork } from "../../../../platform/application/unit-of-work.port";
import type { OperationsScope } from "../operations-scope";
import type { BackupStoragePort } from "../ports/backup.ports";
import { OPS_RESTORE_DRILL_OPERATION } from "../ports/operations.tokens";
import type { OpsBackupRecord, OpsRestoreDrillRecord } from "../ports/operations-repositories.port";
import type { RestoreDrillChecks, RestoreDrillPort, RestoreDrillQueuePort } from "../ports/restore-drill.port";

export interface RestoreDrillServiceDependencies {
	readonly uow: UnitOfWork<OperationsScope>;
	readonly storage: BackupStoragePort;
	readonly drill: RestoreDrillPort;
	readonly queue: RestoreDrillQueuePort;
	readonly clock: Clock;
}

const MS_PER_DAY = 86_400_000;
const DAYS_BETWEEN_DRILLS = 7;
/** How often a drill runs. */
export const RESTORE_DRILL_INTERVAL_MS = DAYS_BETWEEN_DRILLS * MS_PER_DAY;

/** The week a drill belongs to: the same for every instance in that week, so the queue runs it once. */
export function restoreDrillSlot(now: number): string {
	return String(Math.floor(now / RESTORE_DRILL_INTERVAL_MS));
}

const NO_CHECKS: Omit<RestoreDrillChecks, "failures"> = { tablesChecked: 0, rowsRestored: 0, migration: null };

/**
 * The restore drill (enhancement 2.6): restores the newest good backup into a throwaway database, checks it,
 * and records the result for the operations console. The stored bytes are hashed while they stream in, and
 * a checksum that doesn't match the one recorded when the backup was taken fails the drill. A drill is
 * recorded whatever happens; it is skipped (nothing recorded) only where drills aren't set up.
 */
export class RestoreDrillService {
	public constructor(private readonly deps: RestoreDrillServiceDependencies) {}

	/** The hourly check: queues a drill when the last one is a week old (or there is none). */
	public async scheduleIfDue(actor: ActorContext): Promise<boolean> {
		if (!this.deps.drill.availability().ready) {
			return false;
		}
		const now = this.deps.clock.now();
		const [latest] = await this.deps.uow.runSystemOperation(OPS_RESTORE_DRILL_OPERATION, actor, (scope: OperationsScope) => scope.restoreDrills.recent(1));
		if (latest !== undefined && latest.startedAt > now - RESTORE_DRILL_INTERVAL_MS) {
			return false;
		}
		await this.deps.queue.enqueue(restoreDrillSlot(now));
		return true;
	}

	public async run(actor: ActorContext): Promise<OpsRestoreDrillRecord | null> {
		if (!this.deps.drill.availability().ready) {
			return null;
		}
		const startedAt = this.deps.clock.now();
		const backup = await this.deps.uow.runSystemOperation(OPS_RESTORE_DRILL_OPERATION, actor, (scope: OperationsScope) => scope.backups.latestSucceeded());
		const checks = backup === null ? { ...NO_CHECKS, failures: ["There is no successful backup to restore yet."] } : await this.restore(backup);
		return this.deps.uow.runSystemOperation(OPS_RESTORE_DRILL_OPERATION, actor, (scope: OperationsScope) =>
			scope.restoreDrills.record({
				backupId: backup?.id ?? "none",
				startedAt,
				finishedAt: this.deps.clock.now(),
				outcome: checks.failures.length === 0 ? "PASSED" : "FAILED",
				tablesChecked: checks.tablesChecked,
				rowsRestored: checks.rowsRestored,
				failures: checks.failures,
				migration: checks.migration,
			}),
		);
	}

	private async restore(backup: OpsBackupRecord): Promise<RestoreDrillChecks> {
		if (backup.storageContainer === null || backup.storagePath === null) {
			return { ...NO_CHECKS, failures: [`Backup ${backup.id} has no stored object.`] };
		}
		const stored = await this.deps.storage.open(backup.storageContainer, backup.storagePath);
		if (stored === null) {
			return { ...NO_CHECKS, failures: [`Backup ${backup.id}'s stored object is gone.`] };
		}
		const hash = createHash("sha256");
		const tee = new PassThrough();
		stored.on("data", (chunk: Buffer): void => {
			hash.update(chunk);
		});
		stored.on("error", (error: Error): void => {
			tee.destroy(error);
		});
		stored.pipe(tee);
		const checks = await this.deps.drill.restoreAndCheck(tee);
		const checksum = hash.digest("hex");
		return checksum === backup.checksum
			? checks
			: { ...checks, failures: [...checks.failures, `The stored bytes don't match the checksum recorded when backup ${backup.id} was taken.`] };
	}
}
