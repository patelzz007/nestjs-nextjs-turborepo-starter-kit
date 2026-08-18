import { Body, Controller, Delete, ForbiddenException, Get, HttpCode, Param, Post, Query, Req, Res, UseGuards } from "@nestjs/common";
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
	type BackupVerifyResponse,
} from "@workspace/shared";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { BackupRestoreInputSchema } from "@workspace/shared";
import { extractClientInfo } from "../../common/utils/client-info";
import { GetUser } from "../auth/decorators/get-user.decorator";
import type { AccessTokenPayload, RefreshTokenPayload } from "../auth/services/token.service";

import { BackupAdminGuard } from "./backup-admin.guard";
import { BackupService } from "./backup.service";

/**
 * Database backup admin API — `apiPath("/backup")` → `/api/v1/backup`.
 *
 * Every route requires admin access (global AuthGuard + BackupAdminGuard).
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
@UseGuards(BackupAdminGuard)
export class BackupController {
	public constructor(private readonly backupService: BackupService) {}

	/** Starts a backup — 202 Accepted; the job runs in the background. */
	@Post()
	@HttpCode(202)
	@ApiOperation({ summary: "Create a database backup (async)" })
	public async create(
		@Body(new ZodValidationPipe(apiContract.backup.create.input)) body: BackupCreateInput,
		@GetUser() user: AccessTokenPayload | RefreshTokenPayload | undefined,
		@Req() req: FastifyRequest,
	): Promise<BackupCreateResponse> {
		const admin = requireAdminAccessToken(user);
		const { ipAddress } = extractClientInfo(req);
		return this.backupService.create(body, { sub: admin.sub, fullName: admin.fullName, isSuperAdmin: admin.isSuperAdmin }, ipAddress);
	}

	/** History + active flag + the requesting admin's quota — the page's data source. */
	@Get()
	@ApiOperation({ summary: "List backups + operational facts" })
	public list(@GetUser() user: AccessTokenPayload | RefreshTokenPayload | undefined): Promise<BackupListResponse> {
		const admin = requireAdminAccessToken(user);
		return this.backupService.list({ sub: admin.sub, isSuperAdmin: admin.isSuperAdmin });
	}

	/** What the create form may exclude. */
	@Get("options")
	@ApiOperation({ summary: "Excludable tables + form defaults" })
	public options(): Promise<BackupOptionsResponse> {
		return this.backupService.getOptions();
	}

	/** One backup's status/progress — the poll target. */
	@Get(":id")
	@ApiOperation({ summary: "Backup status" })
	public status(@Param("id") id: string): Promise<BackupEntry> {
		return this.backupService.getStatus(id);
	}

	/** Mints a short-lived signed download token (bound to the requesting admin). */
	@Post(":id/download")
	@ApiOperation({ summary: "Mint a signed download token" })
	public downloadToken(@Param("id") id: string, @GetUser() user: AccessTokenPayload | RefreshTokenPayload | undefined): Promise<BackupDownloadResponse> {
		const admin = requireAdminAccessToken(user);
		return this.backupService.createDownloadToken(id, admin.sub);
	}

	/** Streams the backup file (guarded by the signed token). */
	@Get(":id/download")
	@ApiOperation({ summary: "Stream the backup file (signed token required)" })
	public async download(
		@Param("id") id: string,
		@Query("token") token: string | undefined,
		@GetUser() user: AccessTokenPayload | RefreshTokenPayload | undefined,
		@Res() reply: FastifyReply,
	): Promise<void> {
		const admin = requireAdminAccessToken(user);
		await this.backupService.streamDownload(id, token, admin.sub, reply);
	}

	/** Deletes the file + row. */
	@Delete(":id")
	@ApiOperation({ summary: "Delete a backup (file + row)" })
	public remove(@Param("id") id: string): Promise<BackupDeleteResponse> {
		return this.backupService.remove(id);
	}

	/** Restores the dump into a scratch DB, confirms it, drops it. */
	@Post(":id/verify")
	@ApiOperation({ summary: "Verify a backup restores cleanly (scratch DB, then dropped)" })
	public verify(@Param("id") id: string): Promise<BackupVerifyResponse> {
		return this.backupService.verifyBackup(id);
	}

	/** Restores the dump into a NEW database (left in place for inspection). */
	@Post(":id/restore")
	@ApiOperation({ summary: "Restore a backup into a new database" })
	public restore(
		// The contract input also carries `:id` (consumed by the path); the body
		// itself is the target-name options + the re-verification password.
		@Body(new ZodValidationPipe(BackupRestoreInputSchema)) body: BackupRestoreInput,
		@Param("id") id: string,
		@GetUser() user: AccessTokenPayload | RefreshTokenPayload | undefined,
	): Promise<BackupRestoreResponse> {
		const admin = requireAdminAccessToken(user);
		return this.backupService.restoreBackup(id, body, admin.sub);
	}

	/** Gracefully stops a pending/running backup job. */
	@Post(":id/cancel")
	@ApiOperation({ summary: "Cancel a pending or running backup" })
	public cancel(@Param("id") id: string): Promise<{ readonly cancelled: true }> {
		return this.backupService.cancelBackup(id);
	}

	/** List scheduled backups. */
	@Get("schedules")
	@ApiOperation({ summary: "List scheduled backup jobs" })
	public schedules(): ReturnType<BackupService["getSchedules"]> {
		return this.backupService.getSchedules();
	}

	/** Toggle a scheduled backup on/off. */
	@Post("schedules/:id/toggle")
	@HttpCode(200)
	@ApiOperation({ summary: "Toggle a scheduled backup on/off" })
	public toggleSchedule(@Param("id") id: string, @Body() body: { readonly enabled: boolean }): { readonly toggled: true } {
		this.backupService.toggleSchedule(id, body.enabled);
		return { toggled: true };
	}
}

/** Narrow the auth payload union to an access token and re-check admin access. */
function requireAdminAccessToken(user: AccessTokenPayload | RefreshTokenPayload | undefined): AccessTokenPayload {
	if (user === undefined || !("hasAdminAccess" in user) || !user.hasAdminAccess) {
		throw new ForbiddenException({ message: "Admin access required to manage database backups.", error: "ADMIN_ACCESS_REQUIRED" });
	}
	return user;
}
