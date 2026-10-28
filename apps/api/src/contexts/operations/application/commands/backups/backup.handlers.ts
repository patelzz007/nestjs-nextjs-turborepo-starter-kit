// ============================================
// application/commands/backups/backup.handlers.ts — the backup command handlers (ADR 068)
// ============================================
// Each handler is one use case (Single Responsibility); storage, the dump tool and the queue are
// ports (Dependency Inversion). Stored files are removed only after the row change committed.

import { randomBytes } from "node:crypto";

import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import { apiPath, epochMs, OPS_BACKUP_DOWNLOAD_TTL_SECONDS, type DeleteSuccessData, type OpsBackup, type OpsBackupDownload, type OpsBackupSchedule } from "@workspace/shared";

import { TypedConfigService } from "../../../../../config/typed-config.service";
import { CLOCK, type Clock } from "../../../../../platform/application/clock.port";
import type { UnitOfWork } from "../../../../../platform/application/unit-of-work.port";
import {
	OpsBackupInProgressError,
	OpsBackupNotConfiguredError,
	OpsBackupNotFoundError,
	OpsBackupNotReadyError,
	OpsBackupStepUpRequiredError,
} from "../../../domain/errors/operations.errors";
import type { OperationsScope } from "../../operations-scope";
import type { OpsBackupRecord } from "../../ports/operations-repositories.port";
import { BACKUP_QUEUE, BACKUP_STORAGE, DATABASE_DUMP, type BackupQueuePort, type BackupStoragePort, type DatabaseDumpPort } from "../../ports/backup.ports";
import { OPS_LIVE_STORE, type OpsLiveStore } from "../../ports/ops-live-store.port";
import { OPS_BACKUP_WRITE_OPERATION, OPS_SETTINGS_WRITE_OPERATION, OPS_UNIT_OF_WORK } from "../../ports/operations.tokens";
import { actingUserIdOf } from "../../services/ops-server-view";
import { CreateOpsBackupCommand, DeleteOpsBackupCommand, IssueOpsBackupDownloadCommand, PinOpsBackupCommand, UpdateOpsBackupScheduleCommand } from "./backup.commands";

const MS_PER_SECOND = 1_000;
/** Random bytes in a download ticket (256 bits). */
const TICKET_BYTES = 32;

/** The public shape of a stored backup (where it is stored stays on the server). */
/** A stored backup as the console shows it: everything but where its file is stored (never sent to a client). */
export function toBackup(record: OpsBackupRecord): OpsBackup {
	return {
		id: record.id,
		status: record.status,
		trigger: record.trigger,
		requestedByName: record.requestedByName,
		createdAt: record.createdAt,
		startedAt: record.startedAt,
		finishedAt: record.finishedAt,
		sizeBytes: record.sizeBytes,
		checksum: record.checksum,
		pgDumpVersion: record.pgDumpVersion,
		serverVersion: record.serverVersion,
		pinned: record.pinned,
		error: record.error,
	};
}

@CommandHandler(CreateOpsBackupCommand)
export class CreateOpsBackupHandler implements ICommandHandler<CreateOpsBackupCommand, OpsBackup> {
	public constructor(
		@Inject(OPS_UNIT_OF_WORK) private readonly uow: UnitOfWork<OperationsScope>,
		@Inject(DATABASE_DUMP) private readonly dump: DatabaseDumpPort,
		@Inject(BACKUP_QUEUE) private readonly queue: BackupQueuePort,
	) {}

	/** One backup at a time: a second while one is queued or running is refused, not stacked. */
	public async execute({ actor }: CreateOpsBackupCommand): Promise<OpsBackup> {
		const availability = this.dump.availability();
		if (!availability.ready) {
			throw new OpsBackupNotConfiguredError(availability.reason);
		}
		const userId: string = actingUserIdOf(actor);
		const backup: OpsBackupRecord = await this.uow.runSystemOperation(OPS_BACKUP_WRITE_OPERATION, actor, async (scope) => {
			if ((await scope.backups.findActive()) !== null) {
				throw new OpsBackupInProgressError();
			}
			return scope.backups.create({ trigger: "MANUAL", requestedById: userId });
		});
		await this.queue.enqueue(backup.id);
		return toBackup(backup);
	}
}

@CommandHandler(PinOpsBackupCommand)
export class PinOpsBackupHandler implements ICommandHandler<PinOpsBackupCommand, OpsBackup> {
	public constructor(@Inject(OPS_UNIT_OF_WORK) private readonly uow: UnitOfWork<OperationsScope>) {}

	public async execute({ actor, backupId, pinned }: PinOpsBackupCommand): Promise<OpsBackup> {
		return this.uow.runSystemOperation(OPS_BACKUP_WRITE_OPERATION, actor, async (scope) => {
			if ((await scope.backups.find(backupId)) === null) {
				throw new OpsBackupNotFoundError(backupId);
			}
			return toBackup(await scope.backups.setPinned(backupId, pinned));
		});
	}
}

@CommandHandler(DeleteOpsBackupCommand)
export class DeleteOpsBackupHandler implements ICommandHandler<DeleteOpsBackupCommand, DeleteSuccessData> {
	public constructor(
		@Inject(OPS_UNIT_OF_WORK) private readonly uow: UnitOfWork<OperationsScope>,
		@Inject(BACKUP_STORAGE) private readonly storage: BackupStoragePort,
		@Inject(CLOCK) private readonly clock: Clock,
	) {}

	public async execute({ actor, backupId }: DeleteOpsBackupCommand): Promise<DeleteSuccessData> {
		const userId: string = actingUserIdOf(actor);
		const backup: OpsBackupRecord = await this.uow.runSystemOperation(OPS_BACKUP_WRITE_OPERATION, actor, async (scope) => {
			const found = await scope.backups.find(backupId);
			if (found === null) {
				throw new OpsBackupNotFoundError(backupId);
			}
			if (found.status === "QUEUED" || found.status === "RUNNING") {
				throw new OpsBackupNotReadyError(backupId);
			}
			await scope.backups.remove(backupId, this.clock.now(), userId);
			return found;
		});
		if (backup.storageContainer !== null && backup.storagePath !== null) {
			await this.storage.remove(backup.storageContainer, backup.storagePath);
		}
		return { success: true };
	}
}

@CommandHandler(UpdateOpsBackupScheduleCommand)
export class UpdateOpsBackupScheduleHandler implements ICommandHandler<UpdateOpsBackupScheduleCommand, OpsBackupSchedule> {
	public constructor(@Inject(OPS_UNIT_OF_WORK) private readonly uow: UnitOfWork<OperationsScope>) {}

	public async execute({ actor, schedule }: UpdateOpsBackupScheduleCommand): Promise<OpsBackupSchedule> {
		await this.uow.runSystemOperation(OPS_SETTINGS_WRITE_OPERATION, actor, (scope) => scope.settings.updateBackupSchedule(schedule));
		return schedule;
	}
}

@CommandHandler(IssueOpsBackupDownloadCommand)
export class IssueOpsBackupDownloadHandler implements ICommandHandler<IssueOpsBackupDownloadCommand, OpsBackupDownload> {
	public constructor(
		@Inject(OPS_UNIT_OF_WORK) private readonly uow: UnitOfWork<OperationsScope>,
		@Inject(OPS_LIVE_STORE) private readonly live: OpsLiveStore,
		@Inject(CLOCK) private readonly clock: Clock,
		private readonly config: TypedConfigService,
	) {}

	/**
	 * A backup holds every user's personal data: the download needs a second-factor proof younger
	 * than the step-up window, and the link it returns works once, for five minutes.
	 */
	public async execute({ actor, backupId, mfaAssuredAt }: IssueOpsBackupDownloadCommand): Promise<OpsBackupDownload> {
		const now = this.clock.now();
		if (mfaAssuredAt === null || now - mfaAssuredAt > this.config.mfa.stepUpTtlMs) {
			throw new OpsBackupStepUpRequiredError();
		}
		const backup = await this.uow.runSystemOperation(OPS_BACKUP_WRITE_OPERATION, actor, (scope) => scope.backups.find(backupId));
		if (backup === null) {
			throw new OpsBackupNotFoundError(backupId);
		}
		if (backup.status !== "SUCCEEDED") {
			throw new OpsBackupNotReadyError(backupId);
		}
		const ticket: string = randomBytes(TICKET_BYTES).toString("base64url");
		await this.live.putTicket(ticket, backupId, OPS_BACKUP_DOWNLOAD_TTL_SECONDS * MS_PER_SECOND);
		const fileName = `backup-${new Date(backup.createdAt).toISOString().replace(/[:.]/g, "-")}.dump`;
		return {
			url: `${this.config.http.publicUrl}${apiPath("/operations")}/backups/${backupId}/file?ticket=${encodeURIComponent(ticket)}`,
			expiresAt: epochMs(now + OPS_BACKUP_DOWNLOAD_TTL_SECONDS * MS_PER_SECOND),
			fileName,
		};
	}
}
