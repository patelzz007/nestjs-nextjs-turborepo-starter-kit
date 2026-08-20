import { Body, Controller, Delete, Get, HttpCode, Param, Post, Query, Req, Res, ServiceUnavailableException } from "@nestjs/common";
import { ApiExcludeController, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { FastifyReply, FastifyRequest } from "fastify";

import {
	apiContract,
	apiPath,
	type BackupCreateInput,
	type BackupCreateResponse,
	type BackupDeleteResponse,
	type BackupDownloadResponse,
	type BackupEntry,
	type BackupListResponse,
	type BackupOptionsResponse,
	type BackupRestoreInput,
	type BackupRestoreResponse,
	type BackupScheduleToggleBody,
	type BackupScheduleToggleResponse,
	type BackupVerifyResponse,
	BackupRestoreInputSchema,
	BackupScheduleToggleBodySchema,
} from "@workspace/shared";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { extractClientInfo } from "../../common/utils/client-info";
import { AdminAccessOnly } from "../auth/decorators/admin-access.decorator";
import { EmailVerified } from "../auth/decorators/email-verified.decorator";
import { GetUser } from "../auth/decorators/get-user.decorator";
import { RequirePermission } from "../auth/decorators/require-permission.decorator";
import type { AccessTokenPayload, RefreshTokenPayload } from "../auth/services/token.service";
import { requireAdminAccessToken } from "../auth/utils/admin-access";

import { BackupService } from "./backup.service";

/**
 * Database backup admin API — `apiPath("/backup")` → `/api/v1/backup`.
 *
 * Every route requires admin access (global AuthGuard + AdminAccessGuard).
 * The controller is excluded from the public Swagger document — a backup is
 * the whole database, so the surface stays out of the docs.
 *
 * File streaming: `GET /:id/download?token=…` writes directly to the Fastify
 * reply (never JSON), so the global ResponseInterceptor's envelope is not
 * applied to it — the endpoint is meant to be hit through the admin app's
 * same-origin proxy (which forwards the admin cookies + the signed token).
 */
@ApiExcludeController()
@ApiTags("Backup")
@Controller(apiPath("/backup"))
@AdminAccessOnly("Admin access required to manage database backups.")
export class BackupController {
	public constructor(private readonly backupService: BackupService) {}

	/** Starts a backup — 202 Accepted; the job runs in the background. */
	@RequirePermission("CREATE", "BACKUP")
	@Post()
	@HttpCode(202)
	@EmailVerified()
	@ApiOperation({ summary: "Create a database backup (async)" })
	public async create(
		@Body(new ZodValidationPipe(apiContract.backup.create.input)) body: BackupCreateInput,
		@GetUser() user: AccessTokenPayload | RefreshTokenPayload | undefined,
		@Req() req: FastifyRequest,
		@Res() reply: FastifyReply,
	): Promise<BackupCreateResponse> {
		const admin = requireAdminAccessToken(user, "Admin access required to manage database backups.");
		const { ipAddress } = extractClientInfo(req);
		try {
			return await this.backupService.create(body, { sub: admin.sub, fullName: admin.fullName, isSuperAdmin: admin.isSuperAdmin }, ipAddress);
		} catch (error) {
			if (error instanceof ServiceUnavailableException) {
				// Rate-limited — tell the client how long to wait.
				reply.header("Retry-After", "3600");
			}
			throw error;
		}
	}

	/** History + active flag + the requesting admin's quota — the page's data source. */
	@RequirePermission("LIST", "BACKUP")
	@Get()
	@ApiOperation({ summary: "List backups + operational facts" })
	public list(@GetUser() user: AccessTokenPayload | RefreshTokenPayload | undefined): Promise<BackupListResponse> {
		const admin = requireAdminAccessToken(user, "Admin access required to manage database backups.");
		return this.backupService.list({ sub: admin.sub, isSuperAdmin: admin.isSuperAdmin });
	}

	/** What the create form may exclude. */
	@RequirePermission("READ", "BACKUP")
	@Get("options")
	@ApiOperation({ summary: "Excludable tables + form defaults" })
	public options(): Promise<BackupOptionsResponse> {
		return this.backupService.getOptions();
	}

	/** List scheduled backups. Static path — must stay above `:id`. */
	@RequirePermission("LIST", "BACKUP")
	@Get("schedules")
	@ApiOperation({ summary: "List scheduled backup jobs" })
	public async schedules(): Promise<ReturnType<BackupService["getSchedules"]>> {
		return this.backupService.getSchedules();
	}

	/** Toggle a scheduled backup on/off. Static prefix — must stay above `:id`. */
	@RequirePermission("UPDATE", "BACKUP")
	@Post("schedules/:id/toggle")
	@HttpCode(200)
	@EmailVerified()
	@ApiOperation({ summary: "Toggle a scheduled backup on/off" })
	public async toggleSchedule(
		@Param("id") id: string,
		@Body(new ZodValidationPipe(BackupScheduleToggleBodySchema)) body: BackupScheduleToggleBody,
	): Promise<BackupScheduleToggleResponse> {
		return this.backupService.toggleSchedule(id, body.enabled);
	}

	/** Scheduler health — shows DB-backed schedule state + circuit breaker. */
	@RequirePermission("READ", "BACKUP")
	@Get("scheduler/status")
	@ApiOperation({ summary: "Scheduler health (DB-backed cron + circuit breaker)" })
	public schedulerStatus(): ReturnType<BackupService["getSchedulerStatus"]> {
		return this.backupService.getSchedulerStatus();
	}

	/** One backup's status/progress — the poll target. */
	@RequirePermission("READ", "BACKUP")
	@Get(":id")
	@ApiOperation({ summary: "Backup status" })
	public status(@Param("id") id: string): Promise<BackupEntry> {
		return this.backupService.getStatus(id);
	}

	/** Mints a short-lived signed download token (bound to the requesting admin). */
	@RequirePermission("READ", "BACKUP")
	@Post(":id/download")
	@EmailVerified()
	@ApiOperation({ summary: "Mint a signed download token" })
	public downloadToken(@Param("id") id: string, @GetUser() user: AccessTokenPayload | RefreshTokenPayload | undefined): Promise<BackupDownloadResponse> {
		const admin = requireAdminAccessToken(user, "Admin access required to manage database backups.");
		return this.backupService.createDownloadToken(id, admin.sub);
	}

	/** Streams the backup file (guarded by the signed token). */
	@RequirePermission("READ", "BACKUP")
	@Get(":id/download")
	@ApiOperation({ summary: "Stream the backup file (signed token required)" })
	public async download(
		@Param("id") id: string,
		@Query("token") token: string | undefined,
		@GetUser() user: AccessTokenPayload | RefreshTokenPayload | undefined,
		@Res() reply: FastifyReply,
	): Promise<void> {
		const admin = requireAdminAccessToken(user, "Admin access required to manage database backups.");
		await this.backupService.streamDownload(id, token, admin.sub, reply);
	}

	/** Deletes the file + row. */
	@RequirePermission("DELETE", "BACKUP")
	@Delete(":id")
	@EmailVerified()
	@ApiOperation({ summary: "Delete a backup (file + row)" })
	public remove(@Param("id") id: string): Promise<BackupDeleteResponse> {
		return this.backupService.remove(id);
	}

	/** Restores the dump into a scratch DB, confirms it, drops it. */
	@RequirePermission("READ", "BACKUP")
	@Post(":id/verify")
	@EmailVerified()
	@ApiOperation({ summary: "Verify a backup restores cleanly (scratch DB, then dropped)" })
	public verify(@Param("id") id: string): Promise<BackupVerifyResponse> {
		return this.backupService.verifyBackup(id);
	}

	/** Restores the dump into a NEW database (left in place for inspection). */
	@RequirePermission("CREATE", "BACKUP")
	@Post(":id/restore")
	@EmailVerified()
	@ApiOperation({ summary: "Restore a backup into a new database" })
	public restore(
		// The contract input also carries `:id` (consumed by the path); the body
		// itself is the target-name options + the re-verification password.
		@Body(new ZodValidationPipe(BackupRestoreInputSchema)) body: BackupRestoreInput,
		@Param("id") id: string,
		@GetUser() user: AccessTokenPayload | RefreshTokenPayload | undefined,
	): Promise<BackupRestoreResponse> {
		const admin = requireAdminAccessToken(user, "Admin access required to manage database backups.");
		return this.backupService.restoreBackup(id, body, admin.sub);
	}

	/** Gracefully stops a pending/running backup job. */
	@RequirePermission("UPDATE", "BACKUP")
	@Post(":id/cancel")
	@EmailVerified()
	@ApiOperation({ summary: "Cancel a pending or running backup" })
	public cancel(@Param("id") id: string): Promise<{ readonly cancelled: true }> {
		return this.backupService.cancelBackup(id);
	}
}
