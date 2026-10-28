// ============================================
// application/commands/backups/backup.commands.ts — the backup commands (SuperAdmin, ADR 068)
// ============================================

import { Command } from "@nestjs/cqrs";
import type { DeleteSuccessData, EpochMs, OpsBackup, OpsBackupDownload, OpsBackupSchedule } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** `POST /admin/operations/backups`: back the database up now. */
export class CreateOpsBackupCommand extends Command<OpsBackup> {
	public constructor(public readonly actor: ActorContext) {
		super();
	}
}

/** `PUT /admin/operations/backups/:backupId/pin`: keep a backup past the retention, or let it go. */
export class PinOpsBackupCommand extends Command<OpsBackup> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly backupId: string,
		public readonly pinned: boolean,
	) {
		super();
	}
}

/** `DELETE /admin/operations/backups/:backupId`: remove a finished (or failed) backup and its file. */
export class DeleteOpsBackupCommand extends Command<DeleteSuccessData> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly backupId: string,
	) {
		super();
	}
}

/** `PUT /admin/operations/backups/schedule`: when the daily backup runs and how long backups are kept. */
export class UpdateOpsBackupScheduleCommand extends Command<OpsBackupSchedule> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly schedule: OpsBackupSchedule,
	) {
		super();
	}
}

/**
 * `POST /admin/operations/backups/:backupId/download`: a five-minute, one-time download link, only
 * after a fresh second-factor proof (`mfaAssuredAt` from the caller's verified access token).
 */
export class IssueOpsBackupDownloadCommand extends Command<OpsBackupDownload> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly backupId: string,
		public readonly mfaAssuredAt: EpochMs | null,
	) {
		super();
	}
}
