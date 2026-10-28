// ============================================
// presentation/http/operations-backups.controller.ts — database backups (SuperAdmin, ADR 068)
// ============================================
// Every route is SuperAdmin only and needs DATABASE_BACKUP. A download is two steps: `POST
// …/download` (a fresh second-factor proof, then a one-time, five-minute ticket) and `GET …/file`,
// which streams the stored file to whoever presents that ticket — like a signed URL, it is the
// ticket that authorises it, and the request is audited like every other.

import { Controller, Delete, Get, HttpStatus, Inject, Post, Put, Res } from "@nestjs/common";
import { CommandBus } from "@nestjs/cqrs";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import {
	OpsBackupScheduleInputSchema,
	apiContract,
	OPS_BACKUP_FILE_CONTENT_TYPE,
	OpsBackupFileInputSchema,
	AccessTokenPayloadSchema,
	apiPath,
	DeleteSuccessDataSchema,
	epochMs,
	OpsBackupDownloadSchema,
	OpsBackupListSchema,
	OpsBackupPathSchema,
	OpsBackupScheduleSchema,
	OpsBackupSchema,
	PinOpsBackupSchema,
	type AccessTokenPayload,
	type DeleteSuccessData,
	type OpsBackup,
	type OpsBackupDownload,
	type OpsBackupList,
	type OpsBackupPath,
	type OpsBackupSchedule,
	type PinOpsBackupInput,
	type RefreshTokenPayload,
} from "@workspace/shared";
import type { FastifyReply } from "fastify";
import { z } from "zod";

import type { ActorContext } from "../../../../platform/application/actor-context";
import { CurrentActor } from "../../../../platform/presentation/http/security/current-actor.decorator";
import { GetUser } from "../../../../platform/presentation/http/security/decorators/get-user.decorator";
import { PlatformOperation } from "../../../../platform/presentation/http/security/decorators/platform-operation.decorator";
import { Public } from "../../../../platform/presentation/http/security/decorators/public.decorator";
import { PublicOperation } from "../../../../platform/presentation/http/security/decorators/public-operation.decorator";
import { RequirePermission } from "../../../../platform/presentation/http/security/decorators/require-permission.decorator";
import { SuperAdminOnly } from "../../../../platform/presentation/http/security/decorators/super-admin.decorator";
import { RATE_LIMIT_POLICY, RateLimit } from "../../../../platform/presentation/http/security/throttling/rate-limit.decorator";
import { ZodBody, ZodParams, ZodQuery } from "../../../../platform/presentation/http/validation/decorators/zod-request.decorators";
import { ZodFileResponse, ZodResponse } from "../../../../platform/presentation/http/validation/decorators/zod-response.decorators";
import {
	CreateOpsBackupCommand,
	DeleteOpsBackupCommand,
	IssueOpsBackupDownloadCommand,
	PinOpsBackupCommand,
	UpdateOpsBackupScheduleCommand,
} from "../../application/commands/backups/backup.commands";
import { OPS_LIVE_STORE, type OpsLiveStore } from "../../application/ports/ops-live-store.port";
import { OPERATIONS_READ, OPS_BACKUP_WRITE_OPERATION, OPS_CONSOLE_READ_OPERATION, OPS_SETTINGS_WRITE_OPERATION } from "../../application/ports/operations.tokens";
import type { OperationsReadService } from "../../application/services/operations-read.service";
import { OpsBackupNotFoundError } from "../../domain/errors/operations.errors";

/** The download's query: the contract's input without the path parameter. */
const BackupFileQuerySchema = OpsBackupFileInputSchema.pick({ ticket: true });

/** The second-factor proof time of the caller's access token (the step-up check). */
function mfaAssuredAtOf(user: AccessTokenPayload | RefreshTokenPayload | undefined): ReturnType<typeof epochMs> | null {
	const parsed = AccessTokenPayloadSchema.safeParse(user);
	return parsed.success && parsed.data.mfaAssuredAt !== undefined ? epochMs(parsed.data.mfaAssuredAt) : null;
}

@ApiTags("Operations")
@Controller(apiPath("/admin/operations"))
export class OperationsBackupsController {
	public constructor(
		private readonly commandBus: CommandBus,
		@Inject(OPERATIONS_READ) private readonly reads: OperationsReadService,
		@Inject(OPS_LIVE_STORE) private readonly live: OpsLiveStore,
	) {}

	@ApiBearerAuth()
	@SuperAdminOnly()
	@RequirePermission("LIST", "DATABASE_BACKUP")
	@PlatformOperation(OPS_CONSOLE_READ_OPERATION)
	@Get("backups")
	@ApiOperation({ summary: "SuperAdmin: the backups, the schedule and when the next one runs" })
	@ZodResponse(OpsBackupListSchema, { description: "The backups" })
	public backups(@CurrentActor() actor: ActorContext): Promise<OpsBackupList> {
		return this.reads.backups(actor);
	}

	@ApiBearerAuth()
	@SuperAdminOnly()
	@RequirePermission("CREATE", "DATABASE_BACKUP")
	@PlatformOperation(OPS_BACKUP_WRITE_OPERATION)
	@RateLimit(RATE_LIMIT_POLICY.adminSecurityMutation)
	@Post("backups")
	@ApiOperation({ summary: "SuperAdmin: back the database up now (one backup at a time)" })
	@ZodResponse(OpsBackupSchema, { status: HttpStatus.CREATED, description: "The queued backup" })
	public create(@CurrentActor() actor: ActorContext): Promise<OpsBackup> {
		return this.commandBus.execute(new CreateOpsBackupCommand(actor));
	}

	@ApiBearerAuth()
	@SuperAdminOnly()
	@RequirePermission("CREATE", "DATABASE_BACKUP")
	@PlatformOperation(OPS_SETTINGS_WRITE_OPERATION)
	@RateLimit(RATE_LIMIT_POLICY.adminSecurityMutation)
	@Put("backups/schedule")
	@ApiOperation({ summary: "SuperAdmin: when the daily backup runs (platform time zone) and how long backups are kept" })
	@ZodResponse(OpsBackupScheduleSchema, { description: "The saved schedule" })
	public schedule(@CurrentActor() actor: ActorContext, @ZodBody(OpsBackupScheduleInputSchema) schedule: OpsBackupSchedule): Promise<OpsBackupSchedule> {
		return this.commandBus.execute(new UpdateOpsBackupScheduleCommand(actor, schedule));
	}

	@ApiBearerAuth()
	@SuperAdminOnly()
	@RequirePermission("UPDATE", "DATABASE_BACKUP")
	@PlatformOperation(OPS_BACKUP_WRITE_OPERATION)
	@RateLimit(RATE_LIMIT_POLICY.adminSecurityMutation)
	@Put("backups/:backupId/pin")
	@ApiOperation({ summary: "SuperAdmin: keep a backup past the retention (pinned), or let it go" })
	@ZodResponse(OpsBackupSchema, { description: "The backup" })
	public pin(
		@CurrentActor() actor: ActorContext,
		@ZodParams(OpsBackupPathSchema) path: OpsBackupPath,
		@ZodBody(PinOpsBackupSchema) body: PinOpsBackupInput,
	): Promise<OpsBackup> {
		return this.commandBus.execute(new PinOpsBackupCommand(actor, path.backupId, body.pinned));
	}

	@ApiBearerAuth()
	@SuperAdminOnly()
	@RequirePermission("READ", "DATABASE_BACKUP")
	@PlatformOperation(OPS_BACKUP_WRITE_OPERATION)
	@RateLimit(RATE_LIMIT_POLICY.adminSecurityMutation)
	@Post("backups/:backupId/download")
	@ApiOperation({ summary: "SuperAdmin: a one-time, five-minute download link (needs a fresh second-factor proof)" })
	@ZodResponse(OpsBackupDownloadSchema, { status: HttpStatus.CREATED, description: "The link" })
	public download(
		@CurrentActor() actor: ActorContext,
		@GetUser() user: AccessTokenPayload | RefreshTokenPayload | undefined,
		@ZodParams(OpsBackupPathSchema) path: OpsBackupPath,
	): Promise<OpsBackupDownload> {
		return this.commandBus.execute(new IssueOpsBackupDownloadCommand(actor, path.backupId, mfaAssuredAtOf(user)));
	}

	@ApiBearerAuth()
	@SuperAdminOnly()
	@RequirePermission("DELETE", "DATABASE_BACKUP")
	@PlatformOperation(OPS_BACKUP_WRITE_OPERATION)
	@RateLimit(RATE_LIMIT_POLICY.adminSecurityMutation)
	@Delete("backups/:backupId")
	@ApiOperation({ summary: "SuperAdmin: delete a finished or failed backup and its file" })
	@ZodResponse(DeleteSuccessDataSchema, { description: "Deleted" })
	public remove(@CurrentActor() actor: ActorContext, @ZodParams(OpsBackupPathSchema) path: OpsBackupPath): Promise<DeleteSuccessData> {
		return this.commandBus.execute(new DeleteOpsBackupCommand(actor, path.backupId));
	}
}

/**
 * A backup's file for a one-time ticket (`POST /admin/operations/backups/:backupId/download`). Not an
 * admin-console route: like a signed URL, the ticket alone authorises it (it is spent on first use and
 * lives five minutes), and the request is audited like every other.
 */
@ApiTags("Operations")
@Controller(apiPath("/operations"))
export class OperationsBackupFileController {
	public constructor(
		@Inject(OPERATIONS_READ) private readonly reads: OperationsReadService,
		@Inject(OPS_LIVE_STORE) private readonly live: OpsLiveStore,
	) {}

	@Public()
	@PublicOperation(OPS_CONSOLE_READ_OPERATION)
	@RateLimit(RATE_LIMIT_POLICY.credential)
	@Get("backups/:backupId/file")
	@ApiOperation({ summary: "The backup file, for a one-time ticket from POST …/download" })
	@ZodFileResponse(apiContract.operations.backupFile.response, { description: "The `pg_dump --format=custom` file (Content-Disposition: attachment)" })
	public async file(
		@CurrentActor({ allowAnonymous: true }) actor: ActorContext,
		@ZodParams(OpsBackupPathSchema) path: OpsBackupPath,
		@ZodQuery(BackupFileQuerySchema) query: z.output<typeof BackupFileQuerySchema>,
		@Res() reply: FastifyReply,
	): Promise<void> {
		// The ticket is spent here, whatever happens next: a link works once.
		if ((await this.live.takeTicket(query.ticket)) !== path.backupId) {
			throw new OpsBackupNotFoundError(path.backupId);
		}
		const file = await this.reads.backupFile(actor, path.backupId);
		void reply
			.header("Content-Type", OPS_BACKUP_FILE_CONTENT_TYPE)
			.header("Content-Disposition", `attachment; filename="${file.fileName}"`)
			.header("Cache-Control", "no-store")
			.send(file.stream);
	}
}
