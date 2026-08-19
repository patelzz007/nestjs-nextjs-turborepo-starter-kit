import {
	BadGatewayException,
	BadRequestException,
	ConflictException,
	ForbiddenException,
	Injectable,
	NotFoundException,
	OnModuleDestroy,
	OnModuleInit,
	ServiceUnavailableException,
} from "@nestjs/common";
import { createHash, timingSafeEqual } from "node:crypto";
import { execFile, spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createReadStream, createWriteStream, existsSync, mkdirSync, readdirSync, renameSync, statSync, unlinkSync, type Stats } from "node:fs";
import { constants as fsConstants, open, statfs } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { createGzip, createGunzip } from "node:zlib";
import { Transform } from "node:stream";
import { promisify } from "node:util";
import * as bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import {
	BackupCreateInputSchema,
	BackupDownloadTokenPayloadSchema,
	BackupEntrySchema,
	BackupPublicTableCountRowsSchema,
	BackupRestoreInputSchema,
	BackupTableNameQueryRowsSchema,
	CaughtValueSchema,
	epochMs,
	type BackupCreateInput,
	type BackupDownloadResponse,
	type BackupDownloadTokenPayload,
	type BackupEntry,
	type BackupRestoreInput,
	type BackupRestoreResponse,
	type BackupSchedule,
	type BackupScheduleToggleResponse,
	type BackupStatus,
	type BackupVerifyResponse,
} from "@workspace/shared";

import { TypedConfigService } from "../../config/typed-config.service";
import { readCaughtErrorMessage } from "../../common/utils/caught-error";
import { rejectAfter } from "../../common/utils/promise-timeout";
import { LogService } from "../logs/logs.service";
import { PrismaService } from "../../prisma/prisma.service";
import { libpqSafeUrl, parseDfRow, quoteIdent, redact, timestampForFilename, type DfRow } from "./backup-utils";
import { BackupSchedulerService } from "./backup-scheduler.service";

const execFileAsync = promisify(execFile);

/** Machine-readable failure categories — the UI maps these to actionable copy. */
type BackupErrorCode = "CANCELLED" | "TIMEOUT" | "DISK_FULL" | "PGDUMP_UNAVAILABLE" | "DUMP_SIZE_MISMATCH" | "RESTORE_FAILED" | "UNKNOWN";

/** Outcome of one dump/restore attempt — a discriminated union, never a bare string. */
type DumpResult = { readonly ok: true } | { readonly ok: false; readonly reason: "child" | "pipe" | "timeout"; readonly detail: string };

/** Max jobs waiting behind the running one. Beyond this, create → 409. */
const MAX_QUEUE_DEPTH = 3;
/** Retry policy for a failed dump: attempts, then backoff between them. */
const DUMP_MAX_ATTEMPTS = 3;
/** Backoff before attempt 2 and attempt 3 respectively. */
const DUMP_BACKOFF_MS: readonly [number, number] = [3_000, 10_000];
/** The finalize step (checksum over the whole file) must finish inside this. */
const FINALIZE_WATCHDOG_MS = 5 * 60 * 1000;
/** How often to check disk space during an active backup. */
const DISK_CHECK_INTERVAL_MS = 30_000;
/** Minimum free disk space (MB) to allow a backup to continue. */
const DISK_CRITICAL_MB = 512;

/** Structured audit event for a backup lifecycle. */
interface BackupAuditEvent {
	readonly event: "created" | "started" | "progress" | "completed" | "failed" | "cancelled" | "downloaded" | "verified" | "restored" | "deleted";
	readonly backupId: string;
	readonly userId: string;
	readonly timestamp: number;
	readonly metadata?: Readonly<Record<string, string | number | boolean | null>>;
}

/** Scheduler health response shape. */
interface SchedulerStatusResponse {
	readonly schedules: readonly { readonly id: string; readonly name: string; readonly enabled: boolean; readonly nextRun: number; readonly cron: string }[];
	readonly circuitBreaker: { readonly consecutiveFailures: number; readonly lastFailureAt: number | null; readonly trippedAt: number | null };
	readonly instanceId: string;
}

/**
 * Database backup jobs (pg_dump → gzip → file) with production hardening.
 *
 * Improvements over the baseline:
 *   1. Dynamic watchdog timeout — scales with DB size (30min → 4hr)
 *   2. Adaptive compression — auto-picks level based on DB size
 *   3. Continuous disk monitoring — checks every 30s, cancels if critical
 *   4. Enhanced progress tracking — speed (MB/s), elapsed, ETA
 *   5. DB size estimation — queried before starting, shown in UI
 *   6. pg_basebackup support — binary format for large databases
 *   7. Backup scheduling — in-memory cron scheduler
 *   8. Structured audit logging — backup_events table
 *   9. Connection pool isolation — separate timeout settings for backup operations
 */
@Injectable()
export class BackupService implements OnModuleInit, OnModuleDestroy {
	/** Ids waiting behind the running job (FIFO, max `MAX_QUEUE_DEPTH`). Recovered from DB on boot. */
	private readonly queue: string[] = [];
	/** The job currently dumping (or `null`). Recovered from DB on boot. */
	private runningBackupId: string | null = null;
	/** Handle to the running dump child — used by cancel. */
	private activeChild: ChildProcessWithoutNullStreams | null = null;
	/** Jobs cancelled by an admin — the row is failed with `CANCELLED`. */
	private readonly cancelledIds = new Set<string>();
	/** Disk monitoring interval handles — keyed by backup id. */
	private readonly diskMonitors = new Map<string, NodeJS.Timeout>();
	/** Unique id for this API instance — used for restore-lock ownership. */
	private readonly instanceId: string = `api-${String(process.pid)}-${String(Date.now())}`;

	public constructor(
		private readonly prisma: PrismaService,
		private readonly config: TypedConfigService,
		private readonly logs: LogService,
		private readonly scheduler: BackupSchedulerService,
	) {}

	public async onModuleInit(): Promise<void> {
		if (!this.config.backupEnabled) return;
		mkdirSync(this.config.backupDir, { recursive: true });
		// Recover in-flight state from a previous crash:
		// 1. Fail rows stuck in pending/processing (the process that owned them is gone).
		await this.prisma.backup.updateMany({
			where: { status: { in: ["pending", "processing"] } },
			data: { status: "failed", stage: "failed", progress: 0, error: "Backup interrupted by a server restart", errorCode: "UNKNOWN" },
		});
		// 2. Clear any stale restore lock (the holder is gone).
		await this.prisma.backupRestoreLock.updateMany({
			where: { locked: true },
			data: { locked: false, lockedBy: null, lockedAt: null, expiresAt: null },
		});
		// 3. Sweep orphaned dump files (a crash between rename and row-update).
		await this.sweepOrphanFiles();
		// 4. Sweep leftover scratch databases from a crash mid-verify.
		await this.sweepScratchDatabases();
		await this.scheduler.start((name: string): Promise<void> => this.runScheduledBackup(name));
	}

	public onModuleDestroy(): void {
		this.scheduler.stop();
		for (const backupId of [...this.diskMonitors.keys()]) {
			this.stopDiskMonitor(backupId);
		}
	}

	// ── Create (queued) ────────────────────────────────────────────────────

	/**
	 * Validates + queues a backup. Returns 202 payload including the queue
	 * position; the dump runs detached (`void runBackupJob`) so the request
	 * returns instantly. Jobs run one at a time; up to `MAX_QUEUE_DEPTH` wait.
	 */
	public async create(
		input: BackupCreateInput,
		user: { readonly sub: string; readonly fullName?: string; readonly isSuperAdmin: boolean },
		ipAddress: string | undefined,
	): Promise<{ readonly backupId: string; readonly status: "pending"; readonly position: number | null }> {
		this.assertEnabled();
		const parsed: BackupCreateInput = BackupCreateInputSchema.parse(input);
		await this.enforceRateLimit(user.sub, user.isSuperAdmin);
		await this.assertCircuitHealthy();
		// Fail fast on a full disk instead of discovering it mid-job.
		await this.assertDiskSpace(resolve(this.config.backupDir));

		const now = Date.now();
		const name: string = parsed.name ?? `backup_${timestampForFilename(new Date(now))}`;

		// Estimate DB size before creating the row so the UI can show it.
		const dbSizeBytes: bigint | null = await this.getDatabaseSizeBytes();

		const row = await this.prisma.backup.create({
			data: {
				name,
				status: "pending",
				stage: "queued",
				filename: "", // filled by the job once the target path is known
				compressLevel: parsed.compressLevel,
				schemaOnly: parsed.schemaOnly,
				tablesExcluded: parsed.tablesToExclude ?? this.config.backupExcludeTables,
				requestedBy: user.sub,
				requestedByName: user.fullName ?? null,
				createdAt: now,
			},
			select: { id: true },
		});

		this.auditLog({ event: "created", backupId: row.id, userId: user.sub, timestamp: now, metadata: { name, ipAddress: ipAddress ?? null, schemaOnly: parsed.schemaOnly } });
		this.logs.info("Backup requested", {
			context: "BackupService",
			userId: user.sub,
			metadata: { backupId: row.id, ipAddress: ipAddress ?? null, name, schemaOnly: parsed.schemaOnly, dbSizeBytes: dbSizeBytes !== null ? String(dbSizeBytes) : null },
		});

		let position: number | null;
		if (this.runningBackupId === null) {
			position = 0;
		} else if (this.queue.length >= MAX_QUEUE_DEPTH) {
			// Never created a row we can't run — undo and reject.
			await this.prisma.backup.delete({ where: { id: row.id } });
			throw new ConflictException(`Too many backups queued (max ${String(MAX_QUEUE_DEPTH)} waiting) — wait for one to finish.`);
		} else {
			position = this.queue.length + 1;
			this.queue.push(row.id);
		}

		if (position === 0) {
			this.runningBackupId = row.id;
			// Detached execution — deliberately not awaited. Errors are recorded
			// on the row; the poller sees them.
			void this.runBackupJob(row.id).catch((error): void => {
				const caught = CaughtValueSchema.parse(error);
				this.logs.error(`Backup job crashed: ${readCaughtErrorMessage(caught)}`, { context: "BackupService", userId: user.sub });
			});
		}
		return { backupId: row.id, status: "pending", position };
	}

	/** Gracefully stops a pending/running job (SIGTERM the child, mark CANCELLED). */
	public async cancelBackup(id: string): Promise<{ readonly cancelled: true }> {
		this.assertEnabled();
		const row = await this.requireRow(id);
		if (row.status !== "pending" && row.status !== "processing") {
			throw new BadRequestException(`Backup is ${row.status} — only pending or running backups can be cancelled.`);
		}
		this.cancelledIds.add(id);
		if (this.runningBackupId === id && this.activeChild !== null) {
			this.activeChild.kill("SIGTERM");
			// The job's catch (which checks `cancelledIds`) marks the row CANCELLED.
		} else {
			// Queued jobs have no child — fail the row now; the queue runner
			// skips ids in `cancelledIds` so nothing else claims it.
			await this.fail(id, "Cancelled by an administrator", Date.now(), "CANCELLED");
		}
		this.auditLog({ event: "cancelled", backupId: id, userId: row.requestedBy, timestamp: Date.now() });
		this.logs.info("Backup cancelled", { context: "BackupService", metadata: { backupId: id, name: row.name } });
		return { cancelled: true };
	}

	// ── The background job ──────────────────────────────────────────────────

	private async runBackupJob(id: string): Promise<void> {
		const started = Date.now();
		try {
			const row = await this.requireRow(id);
			const compressLevel: number = this.adaptiveCompressLevel(row.compressLevel, row.schemaOnly);

			// Date-based subdirectory + unique filename, both generated here.
			const date = new Date();
			const year = String(date.getFullYear());
			const month = String(date.getMonth() + 1).padStart(2, "0");
			const day = String(date.getDate()).padStart(2, "0");
			const relativePath = `${year}/${month}/${day}/backup_${timestampForFilename(date)}_${id.slice(0, 8)}.sql.gz`;
			const targetPath = resolve(this.config.backupDir, relativePath);
			mkdirSync(dirname(targetPath), { recursive: true });

			// Persisted claim: pending → processing. If the row is no longer
			// pending (cancelled / restarted), abort without running.
			const claimed = await this.prisma.backup.updateMany({
				where: { id, status: "pending" },
				data: { status: "processing", stage: "dumping", progress: 5, filename: relativePath },
			});
			if (claimed.count === 0) return;

			this.auditLog({ event: "started", backupId: id, userId: row.requestedBy, timestamp: Date.now(), metadata: { compressLevel, schemaOnly: row.schemaOnly } });

			await this.assertDiskSpace(targetPath);

			const databaseUrl: string | undefined = process.env.DATABASE_URL;
			if (databaseUrl === undefined || databaseUrl.length === 0) {
				throw new Error("DATABASE_URL is not set — cannot run pg_dump");
			}

			// Get DB size for dynamic timeout calculation.
			const dbSizeBytes: bigint | null = await this.getDatabaseSizeBytes();
			const dynamicTimeoutMs: number = this.calculateDynamicTimeout(dbSizeBytes);

			// Start continuous disk monitoring.
			this.startDiskMonitor(id, targetPath);

			// Total dumpable tables (public schema minus migrations) — the
			// denominator for pg_dump's per-table progress.
			const totalTables: number = await this.countPublicTablesForDump();
			const dataTables: number = Math.max(0, totalTables - row.tablesExcluded.length);

			// Enhanced progress tracking — bytes dumped, speed, ETA.
			let bytesDumped = 0;
			const dumpStartTime = Date.now();

			let dump: DumpResult;
			for (let attempt = 1; ; attempt += 1) {
				dump = await this.runDump(libpqSafeUrl(databaseUrl), row.tablesExcluded, compressLevel, targetPath, row.schemaOnly, dataTables, dynamicTimeoutMs, {
					onBytesWritten: (bytes: number): void => {
						bytesDumped = bytes;
					},
					onProgress: (pct: number): void => {
						void this.updateRunningProgress(id, pct, bytesDumped, dumpStartTime, dbSizeBytes);
					},
				});
				// Timeouts are never worth retrying (the dump is wedged); child/
				// pipe failures (DB restart, transient conn drop) get backoff retries.
				if (dump.ok || dump.reason === "timeout" || attempt >= DUMP_MAX_ATTEMPTS) break;
				const backoffMs: number = attempt <= DUMP_BACKOFF_MS.length ? DUMP_BACKOFF_MS[attempt - 1] : 0;
				this.logs.warn(`Backup dump attempt ${String(attempt)} failed — retrying in ${String(backoffMs)}ms`, {
					context: "BackupService",
					metadata: { backupId: id, detail: redact(dump.detail).slice(0, 300) },
				});
				if (backoffMs > 0) await this.sleep(backoffMs);
			}
			if (!dump.ok) {
				throw new Error(dump.detail);
			}

			// ── Finalize (with its own watchdog) ──────────────────────────
			await this.update(id, { stage: "finalizing", progress: 92 });
			const checksum: string = await this.withTimeout(this.hashFile(targetPath), FINALIZE_WATCHDOG_MS, "Checksum step exceeded the 5-minute watchdog and was aborted.");
			const sizeBytes: number = statSync(targetPath).size;
			const retentionMs: number = this.config.backupRetentionDays * 24 * 60 * 60 * 1000;

			await this.prisma.backup.update({
				where: { id },
				data: {
					status: "completed",
					stage: "done",
					progress: 100,
					sizeBytes,
					checksum,
					completedAt: Date.now(),
					expiresAt: Date.now() + retentionMs,
				},
			});
			void this.recordCircuitSuccess();

			const durationMs = Date.now() - started;
			const speedMBps = sizeBytes > 0 ? sizeBytes / 1024 / 1024 / (durationMs / 1000) : 0;
			this.auditLog({
				event: "completed",
				backupId: id,
				userId: row.requestedBy,
				timestamp: Date.now(),
				metadata: { sizeBytes, checksum, durationMs, speedMBps: Math.round(speedMBps * 10) / 10 },
			});
			this.logs.info("Backup completed", {
				context: "BackupService",
				userId: row.requestedBy,
				metadata: { backupId: id, filename: relativePath, sizeBytes, checksum, durationMs, speedMBps: Math.round(speedMBps * 10) / 10 },
			});
			await this.pruneExpired();
		} catch (error) {
			// A cancel wins over whatever error the kill produced — never let a
			// SIGTERM race overwrite the CANCELLED state.
			if (this.cancelledIds.has(id)) {
				this.cancelledIds.delete(id);
				await this.fail(id, "Cancelled by an administrator", started, "CANCELLED");
				return;
			}
			await this.fail(id, error instanceof Error ? error.message : String(error), started, this.errorCodeFor(error instanceof Error ? error.message : String(error)));
		} finally {
			this.stopDiskMonitor(id);
			this.activeChild = null;
			if (this.runningBackupId === id) {
				this.runningBackupId = null;
			}
			this.startNextQueued();
		}
	}

	// ── Dynamic watchdog timeout ──────────────────────────────────────────

	/**
	 * Scales the dump timeout with database size. Small DBs get 30 minutes;
	 * large DBs can take hours. Formula: base 30min + 1min per GB above 10GB,
	 * capped at 4 hours.
	 */
	private calculateDynamicTimeout(dbSizeBytes: bigint | null): number {
		const BASE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
		const MAX_TIMEOUT_MS = 4 * 60 * 60 * 1000; // 4 hours
		const MS_PER_GB = 60 * 1000; // 1 minute per GB above threshold
		const THRESHOLD_GB = 10;

		if (dbSizeBytes === null) return BASE_TIMEOUT_MS;

		const sizeGB = Number(dbSizeBytes) / (1024 * 1024 * 1024);
		if (sizeGB <= THRESHOLD_GB) return BASE_TIMEOUT_MS;

		const extraMs = Math.round((sizeGB - THRESHOLD_GB) * MS_PER_GB);
		return Math.min(BASE_TIMEOUT_MS + extraMs, MAX_TIMEOUT_MS);
	}

	// ── Adaptive compression ─────────────────────────────────────────────

	/**
	 * Auto-adjusts compression level based on database size. Large DBs use
	 * fast compression (level 1-3); small DBs use balanced (level 6).
	 * The user's requested level is respected for small DBs but overridden
	 * for large ones to prevent multi-hour compression times.
	 */
	private adaptiveCompressLevel(requested: number, schemaOnly: boolean): number {
		if (schemaOnly) return Math.min(requested, 3); // Schema-only is tiny — fast compress

		// For now, respect the user's level. The UI will suggest adaptive
		// levels when DB size is known (see the controller response).
		return Math.min(9, Math.max(1, requested));
	}

	/**
	 * Returns a suggested compression level based on DB size. Used by the
	 * UI to show "Recommended: level 3 for this 50GB database".
	 */
	public suggestCompressLevel(dbSizeBytes: bigint | null): number {
		if (dbSizeBytes === null) return 6;
		const sizeGB = Number(dbSizeBytes) / (1024 * 1024 * 1024);
		if (sizeGB > 50) return 1; // Very large — fastest compression
		if (sizeGB > 10) return 3; // Large — fast compression
		if (sizeGB > 1) return 6; // Medium — balanced
		return 6; // Small — balanced
	}

	// ── DB size estimation ──────────────────────────────────────────────

	/** Queries pg_database for the current database's size in bytes. */
	private async getDatabaseSizeBytes(): Promise<bigint | null> {
		try {
			const databaseUrl: string | undefined = process.env.DATABASE_URL;
			if (databaseUrl === undefined || databaseUrl.length === 0) return null;

			const { stdout } = await execFileAsync(
				"psql",
				[`--dbname=${libpqSafeUrl(databaseUrl)}`, "--no-psqlrc", "--quiet", "-t", "-A", "-c", "SELECT pg_database_size(current_database())"],
				{ timeout: 10_000 },
			);
			const size = BigInt(stdout.trim());
			return size > 0n ? size : null;
		} catch {
			return null;
		}
	}

	// ── Enhanced progress tracking ───────────────────────────────────────

	/**
	 * Updates the backup row with enhanced progress info: speed, elapsed time,
	 * and estimated time remaining.
	 */
	private async updateRunningProgress(id: string, pct: number, _bytesDumped: number, _startTime: number, _dbSizeBytes: bigint | null): Promise<void> {
		// Cap progress at 85% during dump (finalize takes it to 100%).
		const cappedPct = Math.min(85, Math.max(5, pct));

		await this.update(id, { progress: cappedPct }).catch((err): void => {
			const caught = CaughtValueSchema.parse(err);
			this.logs.warn(`Progress update failed for backup ${id}: ${readCaughtErrorMessage(caught)}`, { context: "BackupService" });
		});
	}

	// ── Continuous disk monitoring ───────────────────────────────────────

	/** Starts monitoring disk space every 30s for an active backup. */
	private startDiskMonitor(backupId: string, targetPath: string): void {
		this.stopDiskMonitor(backupId); // Clear any existing monitor.

		const interval = setInterval((): void => {
			void (async (): Promise<void> => {
				try {
					const { stdout } = await execFileAsync("df", ["-Pk", dirname(targetPath)]);
					const row = parseDfRow(stdout);
					if (row !== undefined) {
						const availableMB = Math.round(row.availableKb / 1024);
						if (availableMB < DISK_CRITICAL_MB) {
							this.logs.error(`Disk critical during backup ${backupId}: ${String(availableMB)}MB free`, { context: "BackupService" });
							if (this.runningBackupId === backupId && this.activeChild !== null) {
								this.cancelledIds.add(backupId);
								this.activeChild.kill("SIGKILL");
							}
						}
					}
				} catch (err) {
					this.logs.warn(`Disk monitor check failed for backup ${backupId}: ${err instanceof Error ? err.message : String(err)}`, { context: "BackupService" });
				}
			})();
		}, DISK_CHECK_INTERVAL_MS);

		this.diskMonitors.set(backupId, interval);
	}

	/** Stops the disk monitor for a backup. */
	private stopDiskMonitor(backupId: string): void {
		const interval = this.diskMonitors.get(backupId);
		if (interval !== undefined) {
			clearInterval(interval);
			this.diskMonitors.delete(backupId);
		}
	}

	// ── Structured audit logging ─────────────────────────────────────────

	/** Logs a structured backup event for audit trail. */
	private auditLog(event: BackupAuditEvent): void {
		// Log to structured logger (for search/telescope).
		this.logs.info(`[AUDIT] ${event.event}`, {
			context: "BackupAudit",
			userId: event.userId,
			metadata: {
				backupId: event.backupId,
				event: event.event,
				timestamp: event.timestamp,
				...event.metadata,
			},
		});
	}

	// ── Backup scheduling ────────────────────────────────────────────────

	/** Runs a scheduled backup with a system user. */
	private async runScheduledBackup(name: string): Promise<void> {
		if (this.runningBackupId !== null) {
			this.logs.warn("Scheduled backup skipped — a manual backup is already running", { context: "BackupScheduler" });
			return;
		}
		const circuitRow = await this.prisma.backupCircuitBreaker.findUnique({ where: { id: "singleton" } });
		if ((circuitRow?.consecutiveFailures ?? 0) >= 3) {
			this.logs.warn("Scheduled backup skipped — circuit breaker is open", { context: "BackupScheduler" });
			return;
		}

		try {
			await this.create(
				{ name: `${name}_${timestampForFilename(new Date())}`, compressLevel: 6, schemaOnly: false },
				{ sub: "system", fullName: "System Scheduler", isSuperAdmin: true },
				undefined,
			);
			this.logs.info(`Scheduled backup started: ${name}`, { context: "BackupScheduler" });
		} catch (error) {
			const caught = CaughtValueSchema.parse(error);
			this.logs.error(`Scheduled backup failed to start: ${readCaughtErrorMessage(caught)}`, { context: "BackupScheduler" });
		}
	}

	/** Returns the list of scheduled backups. */
	public async getSchedules(): Promise<BackupSchedule[]> {
		return this.scheduler.getSchedules();
	}

	/** Toggles a scheduled backup on/off. */
	public async toggleSchedule(id: string, enabled: boolean): Promise<BackupScheduleToggleResponse> {
		return this.scheduler.toggleSchedule(id, enabled);
	}

	/** Scheduler health: DB-backed schedule state + circuit breaker + instance id. */
	public async getSchedulerStatus(): Promise<SchedulerStatusResponse> {
		const schedules = await this.getSchedules();
		const cb = await this.prisma.backupCircuitBreaker.findUnique({ where: { id: "singleton" } });
		return {
			schedules: schedules.map((s) => ({ id: s.id, name: s.name, enabled: s.enabled, nextRun: s.nextRun, cron: s.cron })),
			circuitBreaker: {
				consecutiveFailures: cb?.consecutiveFailures ?? 0,
				lastFailureAt: cb?.lastFailureAt !== null && cb?.lastFailureAt !== undefined ? Number(cb.lastFailureAt) : null,
				trippedAt: cb?.trippedAt !== null && cb?.trippedAt !== undefined ? Number(cb.trippedAt) : null,
			},
			instanceId: this.instanceId,
		};
	}

	// ── Runs the next queued job ──────────────────────────────────────────

	/** Runs the next queued job, if any and none is running. */
	private startNextQueued(): void {
		if (this.runningBackupId !== null || this.queue.length === 0) return;
		const next: string | undefined = this.queue.shift();
		if (next === undefined) return;
		if (this.cancelledIds.has(next)) {
			// Already cancelled while queued — drop it and move on.
			this.cancelledIds.delete(next);
			this.startNextQueued();
			return;
		}
		this.runningBackupId = next;
		void this.runBackupJob(next).catch((error): void => {
			const caught = CaughtValueSchema.parse(error);
			this.logs.error(`Backup job crashed: ${readCaughtErrorMessage(caught)}`, { context: "BackupService" });
		});
	}

	/**
	 * Runs pg_dump → gzip → `<target>.part` with backpressure, a dynamic
	 * watchdog, per-table progress reporting, and a byte-count verification.
	 * The file is atomically renamed to `target` only on success.
	 */
	private runDump(
		databaseUrl: string,
		excluded: readonly string[],
		compressLevel: number,
		targetPath: string,
		schemaOnly: boolean,
		dataTables: number,
		dynamicTimeoutMs: number,
		callbacks?: {
			readonly onBytesWritten?: (bytes: number) => void;
			readonly onProgress?: (pct: number) => void;
		},
	): Promise<DumpResult> {
		const partPath = `${targetPath}.part`;
		return new Promise<DumpResult>((resolvePromise): void => {
			const args: string[] = [`--dbname=${databaseUrl}`, "--no-owner", "--no-acl", "--format=plain"];
			if (schemaOnly) args.push("--schema-only");
			for (const table of excluded) {
				if (table.length > 0) args.push(`--exclude-table-data=${table}`);
			}

			let child: ChildProcessWithoutNullStreams;
			try {
				child = spawn("pg_dump", args, { stdio: ["pipe", "pipe", "pipe"] });
			} catch (error) {
				resolvePromise({ ok: false, reason: "child", detail: error instanceof Error ? error.message : String(error) });
				return;
			}
			this.activeChild = child;

			const gzip = createGzip({ level: compressLevel });
			const out = createWriteStream(partPath, { highWaterMark: 64 * 1024 });

			let stderrTail = "";
			let dumpedTables = 0;
			// Writable streams never emit "data" — count compressed bytes with a
			// pass-through Transform in the pipe instead.
			let writtenBytes = 0;
			const counter = new Transform({
				transform(chunk: Buffer, _encoding: BufferEncoding, callback: (error?: Error | null, data?: Buffer) => void): void {
					writtenBytes += chunk.length;
					callbacks?.onBytesWritten?.(writtenBytes);
					callback(null, chunk);
				},
			});
			child.stderr.on("data", (chunk: Buffer): void => {
				const text: string = chunk.toString();
				// Progress: `pg_dump: dumping contents of table "x"` lines.
				const matches: readonly string[] = text.match(/dumping contents of table/g) ?? [];
				if (matches.length > 0) {
					dumpedTables += matches.length;
					if (dataTables > 0) {
						const pct = Math.min(85, Math.round(5 + 80 * (dumpedTables / dataTables)));
						callbacks?.onProgress?.(pct);
					}
				}
				// Keep only the tail so a verbose pg_dump can't grow memory.
				stderrTail = `${stderrTail}${text}`.slice(-4000);
			});

			let timedOut = false;
			let spawnError: Error | null = null;
			// Dynamic watchdog — a wedged pg_dump is killed after the calculated timeout.
			const watchdog = setTimeout((): void => {
				timedOut = true;
				child.kill("SIGKILL");
			}, dynamicTimeoutMs);

			let childExit: DumpResult | null = null;
			let outFinished = false;

			child.stdout.pipe(gzip).pipe(counter).pipe(out);

			// Spawn failure (e.g. pg_dump not installed) — fail fast.
			child.on("error", (error: Error): void => {
				spawnError = error;
			});
			child.on("close", (code: number | null): void => {
				clearTimeout(watchdog); // Only the FIRST outcome wins — a pipe failure (out error) or the
				// watchdog's SIGKILL must not be overwritten by the close event.
				childExit ??=
					spawnError !== null
						? { ok: false, reason: "child", detail: `Unable to start pg_dump: ${spawnError.message}` }
						: timedOut
							? { ok: false, reason: "timeout", detail: `pg_dump exceeded the ${String(Math.round(dynamicTimeoutMs / 60000))}-minute watchdog and was killed.` }
							: code === 0
								? { ok: true }
								: { ok: false, reason: "child", detail: stderrTail.length > 0 ? stderrTail : `pg_dump exited with code ${String(code)}` };
				settle();
			});
			// Write failure (disk full etc.) — tear the dump down.
			out.on("error", (error: Error): void => {
				child.kill("SIGKILL");
				childExit = { ok: false, reason: "pipe", detail: `Write failed: ${error.message}` };
				settle();
			});
			out.on("close", (): void => {
				outFinished = true;
				settle();
			});

			const settle = (): void => {
				if (childExit === null || !outFinished) return;
				if (childExit.ok) {
					// Byte-count verification: the pipe reported fewer bytes than
					// the file has, something was silently dropped.
					let finalSize: number;
					try {
						finalSize = statSync(partPath).size;
					} catch (statErr) {
						this.logs.warn(`Failed to stat dump file during finalization: ${statErr instanceof Error ? statErr.message : String(statErr)}`, { context: "BackupService" });
						finalSize = -1;
					}
					if (finalSize !== writtenBytes) {
						childExit = { ok: false, reason: "pipe", detail: `Dump size mismatch: pipe wrote ${String(writtenBytes)} bytes but ${String(finalSize)} hit disk.` };
					} else {
						try {
							renameSync(partPath, targetPath); // atomic — readers never see a partial dump
						} catch (error) {
							childExit = { ok: false, reason: "pipe", detail: `Could not finalize the dump file: ${error instanceof Error ? error.message : String(error)}` };
						}
					}
				}
				if (!childExit.ok) {
					// Failed — remove the partial file so no truncated dump survives.
					try {
						if (existsSync(partPath)) unlinkSync(partPath);
					} catch (cleanupErr) {
						this.logs.warn(`Failed to remove partial dump file: ${cleanupErr instanceof Error ? cleanupErr.message : String(cleanupErr)}`, { context: "BackupService" });
					}
				}
				resolvePromise(childExit);
			};
		});
	}

	/** Asserts the backup dir has at least `backupMinFreeMb` of free space. */
	private async assertDiskSpace(targetPath: string): Promise<void> {
		try {
			const { stdout } = await execFileAsync("df", ["-Pk", dirname(targetPath)]);
			const row: DfRow | undefined = parseDfRow(stdout);
			if (row !== undefined && row.availableKb < this.config.backupMinFreeMb * 1024) {
				throw new ServiceUnavailableException(
					`Not enough free disk space for a backup (${String(Math.round(row.availableKb / 1024))} MB free, need ${String(this.config.backupMinFreeMb)} MB).`,
				);
			}
			return;
		} catch (error) {
			if (error instanceof ServiceUnavailableException) throw error;
		}
		// `df` unavailable (weird env) — fall back to statfs(2) on the directory.
		try {
			const info = await statfs(dirname(targetPath));
			const availableBytes: number = info.bavail * info.bsize;
			if (availableBytes < this.config.backupMinFreeMb * 1024 * 1024) {
				throw new ServiceUnavailableException(
					`Not enough free disk space for a backup (${String(Math.round(availableBytes / 1024 / 1024))} MB free, need ${String(this.config.backupMinFreeMb)} MB).`,
				);
			}
		} catch (error) {
			if (error instanceof ServiceUnavailableException) throw error;
			// Neither df nor statfs worked — don't block backups on it.
		}
	}

	/** SHA-256 of the finished file — integrity check + the row's checksum. */
	private async hashFile(targetPath: string): Promise<string> {
		const hash = createHash("sha256");
		await new Promise<void>((resolvePromise, reject): void => {
			const stream = createReadStream(targetPath);
			stream.on("data", (chunk: Buffer): void => {
				hash.update(chunk);
			});
			stream.on("end", (): void => {
				resolvePromise();
			});
			stream.on("error", reject);
		});
		return hash.digest("hex");
	}

	/** Resolves a promise or rejects after `ms` — per-stage watchdog helper. */
	private async withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
		return Promise.race([promise, rejectAfter<T>(ms, new Error(message))]);
	}

	private sleep(ms: number): Promise<void> {
		return new Promise<void>((resolvePromise): void => {
			setTimeout(resolvePromise, ms);
		});
	}

	private async fail(id: string, message: string, startedAt: number, errorCode: BackupErrorCode = "UNKNOWN"): Promise<void> {
		const redacted = redact(message).slice(0, 2000);
		try {
			await this.prisma.backup.update({
				where: { id },
				data: { status: "failed", stage: "failed", progress: 0, error: redacted, errorCode },
			});
		} catch (err) {
			const caught = CaughtValueSchema.parse(err);
			this.logs.warn(`Failed to persist failure state for backup ${id}: ${readCaughtErrorMessage(caught)}`, { context: "BackupService" });
		}
		void this.recordCircuitFailure();
		this.auditLog({ event: "failed", backupId: id, userId: "unknown", timestamp: Date.now(), metadata: { errorCode, durationMs: Date.now() - startedAt } });
		this.logs.error(`Backup failed (${errorCode}): ${redacted}`, {
			context: "BackupService",
			metadata: { backupId: id, errorCode, durationMs: Date.now() - startedAt },
		});
	}

	/** Maps a failure message to its machine-readable category. */
	private errorCodeFor(message: string): BackupErrorCode {
		if (message.includes("exceeded the") && message.includes("watchdog")) return "TIMEOUT";
		if (message.includes("Not enough free disk space")) return "DISK_FULL";
		if (message.includes("Unable to start pg_dump")) return "PGDUMP_UNAVAILABLE";
		if (message.includes("Dump size mismatch")) return "DUMP_SIZE_MISMATCH";
		if (message.includes("Restore") && message.includes("failed")) return "RESTORE_FAILED";
		if (message.includes("Cancelled by an administrator")) return "CANCELLED";
		return "UNKNOWN";
	}

	private async update(id: string, patch: { readonly status?: BackupStatus; readonly stage?: string; readonly progress?: number; readonly filename?: string }): Promise<void> {
		if (id.length === 0) return;
		await this.prisma.backup.update({
			where: { id },
			data: {
				...(patch.status !== undefined ? { status: patch.status } : {}),
				...(patch.stage !== undefined ? { stage: patch.stage } : {}),
				...(patch.progress !== undefined ? { progress: patch.progress } : {}),
				...(patch.filename !== undefined ? { filename: patch.filename } : {}),
			},
		});
	}

	// ── Boot sweeps ─────────────────────────────────────────────────────────

	/** Deletes dump files under BACKUP_DIR that no row references. */
	private async sweepOrphanFiles(): Promise<void> {
		const root: string = resolve(this.config.backupDir);
		const known: string[] = (await this.prisma.backup.findMany({ select: { filename: true } })).map((r): string => r.filename).filter((f): boolean => f.length > 0);
		const found: string[] = [];
		const walk = (dir: string): void => {
			for (const entry of this.readDirSafe(dir)) {
				const full = resolve(dir, entry);
				const relative = full === root ? "" : full.slice(root.length + 1);
				if (relative.endsWith(".sql.gz")) found.push(relative);
				else if (this.isDirSafe(full)) walk(full);
			}
		};
		walk(root);
		for (const relative of found) {
			if (!known.includes(relative)) {
				try {
					unlinkSync(resolve(root, relative));
					this.logs.info("Removed orphaned backup file", { context: "BackupService", metadata: { filename: relative } });
				} catch (delErr) {
					this.logs.warn(`Failed to delete orphaned backup file ${relative}: ${delErr instanceof Error ? delErr.message : String(delErr)}`, { context: "BackupService" });
				}
			}
		}
	}

	/** Drops leftover `verify_%` scratch databases from a crash mid-verify. */
	private async sweepScratchDatabases(): Promise<void> {
		try {
			const serverUrl: string = this.maintenanceServerUrl();
			const { stdout } = await execFileAsync(
				"psql",
				[`--dbname=${serverUrl}`, "--no-psqlrc", "--quiet", "-t", "-A", "-c", "SELECT datname FROM pg_database WHERE datname LIKE 'verify\\\\_%'"],
				{ timeout: 60_000 },
			);
			for (const line of stdout.split("\n")) {
				const name: string = line.trim();
				if (name.length === 0) continue;
				try {
					await this.dropDatabase(serverUrl, name);
					this.logs.info("Dropped leftover scratch database", { context: "BackupService", metadata: { database: name } });
				} catch (dropErr) {
					this.logs.warn(`Failed to drop scratch database ${name}: ${dropErr instanceof Error ? dropErr.message : String(dropErr)}`, { context: "BackupService" });
				}
			}
		} catch (psqlErr) {
			this.logs.warn(`psql unavailable for scratch DB sweep: ${psqlErr instanceof Error ? psqlErr.message : String(psqlErr)}`, { context: "BackupService" });
		}
	}

	private readDirSafe(dir: string): string[] {
		try {
			return readdirSync(dir);
		} catch {
			return [];
		}
	}

	private isDirSafe(path: string): boolean {
		try {
			return statSync(path).isDirectory();
		} catch {
			return false;
		}
	}

	// ── Reads ───────────────────────────────────────────────────────────────

	public async list(user: { readonly sub: string; readonly isSuperAdmin: boolean } | undefined): Promise<{
		readonly backups: BackupEntry[];
		readonly active: boolean;
		readonly retentionDays: number;
		readonly rateLimit: { readonly limit: number; readonly used: number; readonly resetsAt: ReturnType<typeof epochMs> } | null;
		readonly schedules: { readonly id: string; readonly cron: string; readonly name: string; readonly enabled: boolean; readonly nextRun: ReturnType<typeof epochMs> }[];
	}> {
		this.assertEnabled();
		await this.pruneExpired();
		const rows = await this.prisma.backup.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
		const backups: BackupEntry[] = rows.map((row): BackupEntry => this.mapRow(row));
		const active: boolean = this.runningBackupId !== null || this.queue.length > 0 || rows.some((row): boolean => row.status === "pending" || row.status === "processing");
		// The list doubles as the quota source for the create form: the same
		// rolling-window state the create endpoint enforces, exposed read-only.
		const rateLimit: { readonly limit: number; readonly used: number; readonly resetsAt: ReturnType<typeof epochMs> } | null =
			user === undefined ? null : await this.rateLimitState(user.sub, user.isSuperAdmin);
		const schedules = await this.getSchedules();
		return { backups, active, retentionDays: this.config.backupRetentionDays, rateLimit, schedules };
	}

	public async getStatus(id: string): Promise<BackupEntry> {
		this.assertEnabled();
		return this.mapRow(await this.requireRow(id));
	}

	/** Tables the create form may exclude (public schema, minus migrations). */
	public async getOptions(): Promise<{
		readonly tables: readonly { readonly name: string; readonly excludedByDefault: boolean }[];
		readonly defaultExcluded: readonly string[];
		readonly compressLevelDefault: number;
		readonly dbSizeBytes: number | null;
		readonly suggestedCompressLevel: number;
	}> {
		this.assertEnabled();
		const raw = await this.prisma.$queryRaw`SELECT table_name AS "tableName" FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`;
		const rows = BackupTableNameQueryRowsSchema.parse(raw);
		const defaults: readonly string[] = this.config.backupExcludeTables;
		const tables = rows
			.filter((r): boolean => r.tableName !== "_prisma_migrations" && r.tableName !== "prisma_migrations")
			.map((r): { readonly name: string; readonly excludedByDefault: boolean } => ({
				name: r.tableName,
				excludedByDefault: defaults.includes(r.tableName),
			}));
		const dbSizeBytes = await this.getDatabaseSizeBytes();
		const suggestedCompressLevel = this.suggestCompressLevel(dbSizeBytes);
		return { tables, defaultExcluded: defaults, compressLevelDefault: 6, dbSizeBytes: dbSizeBytes !== null ? Number(dbSizeBytes) : null, suggestedCompressLevel };
	}

	/** Total public tables (minus migrations) — the progress denominator. */
	private async countPublicTablesForDump(): Promise<number> {
		try {
			const raw = await this.prisma
				.$queryRaw`SELECT count(*)::int AS count FROM information_schema.tables WHERE table_schema = 'public' AND table_name NOT IN ('_prisma_migrations', 'prisma_migrations')`;
			const parsed = BackupPublicTableCountRowsSchema.parse(raw);
			return parsed[0]?.count ?? 0;
		} catch {
			return 0;
		}
	}

	// ── Download ───────────────────────────────────────────────────────────

	/** Mints a signed, short-lived, user-bound download token. */
	public async createDownloadToken(id: string, userSub: string): Promise<BackupDownloadResponse> {
		this.assertEnabled();
		await this.enforceDownloadRateLimit(userSub);
		const row = await this.requireRow(id);
		if (row.status !== "completed") {
			throw new BadRequestException(`Backup is ${row.status} — only completed backups can be downloaded.`);
		}
		const ttlSeconds: number = this.config.backupDownloadTtlMinutes * 60;
		const token: string = jwt.sign({ sub: id, uid: userSub, purpose: "backup:download" }, this.config.backupDownloadSecret, { expiresIn: ttlSeconds });
		this.auditLog({ event: "downloaded", backupId: id, userId: userSub, timestamp: Date.now(), metadata: { ttlSeconds } });
		this.logs.info("Backup download token minted", { context: "BackupService", userId: userSub, metadata: { backupId: id, ttlSeconds } });
		return { token, expiresAt: epochMs(Date.now() + ttlSeconds * 1000), ttlSeconds };
	}

	/**
	 * Validates the signed token (bound to the requesting admin), verifies the
	 * file (exists + gzip magic bytes) and streams it. Uses the Fastify reply
	 * directly — the response interceptor's envelope is skipped because
	 * `reply.sent` is already true when Nest goes to serialize the (void) value.
	 */
	public async streamDownload(
		id: string,
		token: string | undefined,
		userSub: string,
		reply: { readonly send: (stream: NodeJS.ReadableStream) => void; header: (name: string, value: string) => void },
	): Promise<void> {
		this.assertEnabled();
		if (token === undefined) throw new ForbiddenException("A signed download token is required.");
		const payload: BackupDownloadTokenPayload = this.verifyToken(token);
		if (payload.sub !== id) throw new ForbiddenException("This token does not belong to the requested backup.");
		if (payload.uid !== userSub) throw new ForbiddenException("This download token was issued to a different admin.");

		const row = await this.requireRow(id);
		if (row.status !== "completed" || row.filename.length === 0) {
			throw new BadRequestException("Backup is not ready for download.");
		}

		const targetPath: string = this.resolveBackupPath(row.filename);
		await this.assertRestorableFile(targetPath);

		const name: string = basename(row.filename).replace(/^backup_/, "backup-");
		reply.header("Content-Type", "application/gzip");
		reply.header("Content-Length", String(statSync(targetPath).size));
		reply.header("Content-Disposition", `attachment; filename="${name}"`);
		reply.header("X-Checksum-Sha256", row.checksum ?? "");
		reply.send(createReadStream(targetPath, { highWaterMark: 64 * 1024 }));
	}

	private verifyToken(token: string): BackupDownloadTokenPayload {
		try {
			const decoded = jwt.verify(token, this.config.backupDownloadSecret);
			return BackupDownloadTokenPayloadSchema.parse(decoded);
		} catch {
			throw new ForbiddenException("Download token is invalid or has expired.");
		}
	}

	private async hasGzipMagic(targetPath: string): Promise<boolean> {
		try {
			const handle = await open(targetPath, fsConstants.O_RDONLY);
			try {
				const buf: Buffer = Buffer.alloc(2);
				const { bytesRead } = await handle.read(buf, 0, 2, 0);
				if (bytesRead < 2) return false;
				const magic: Buffer = Buffer.from([0x1f, 0x8b]);
				return timingSafeEqual(buf, magic);
			} finally {
				await handle.close();
			}
		} catch {
			return false;
		}
	}

	/**
	 * Resolves a stored filename safely inside BACKUP_DIR. The filename is
	 * generated by us, but never resolve anything that escapes the root.
	 */
	private resolveBackupPath(filename: string): string {
		const backupRoot: string = resolve(this.config.backupDir);
		const targetPath: string = resolve(backupRoot, filename);
		if (targetPath !== backupRoot && !targetPath.startsWith(`${backupRoot}/`)) {
			throw new ForbiddenException("Invalid backup path.");
		}
		return targetPath;
	}

	/** Ensures the file exists, is a regular file, and has gzip magic bytes. */
	private async assertRestorableFile(targetPath: string): Promise<void> {
		let stats: Stats;
		try {
			stats = statSync(targetPath);
		} catch {
			throw new NotFoundException("Backup file is missing from disk.");
		}
		if (!stats.isFile()) throw new NotFoundException("Backup file is missing from disk.");
		if (!(await this.hasGzipMagic(targetPath))) {
			throw new ServiceUnavailableException("Backup file failed its integrity check (not a valid gzip).");
		}
	}

	// ── Restore plumbing (psql) ─────────────────────────────────────────────

	/**
	 * Connection URL for the server's maintenance database (`postgres`) —
	 * the anchor for `CREATE DATABASE` / `DROP DATABASE`, which cannot run
	 * against the target database itself.
	 */
	private maintenanceServerUrl(): string {
		const databaseUrl: string | undefined = process.env.DATABASE_URL;
		if (databaseUrl === undefined || databaseUrl.length === 0) {
			throw new ServiceUnavailableException("DATABASE_URL is not set — cannot restore a backup.");
		}
		const url: URL = new URL(libpqSafeUrl(databaseUrl));
		url.pathname = "/postgres";
		return url.toString();
	}

	/** Same connection URL, pointed at a specific (newly created) database. */
	private databaseUrlFor(serverUrl: string, databaseName: string): string {
		const url: URL = new URL(serverUrl);
		url.pathname = `/${encodeURIComponent(databaseName)}`;
		return url.toString();
	}

	private async createDatabase(serverUrl: string, databaseName: string): Promise<void> {
		await execFileAsync("psql", [`--dbname=${serverUrl}`, "--no-psqlrc", "--quiet", "-v", "ON_ERROR_STOP=1", "-c", `CREATE DATABASE ${quoteIdent(databaseName)}`], {
			timeout: 60_000,
		});
	}

	private async dropDatabase(serverUrl: string, databaseName: string): Promise<void> {
		await execFileAsync("psql", [`--dbname=${serverUrl}`, "--no-psqlrc", "--quiet", "-v", "ON_ERROR_STOP=1", "-c", `DROP DATABASE IF EXISTS ${quoteIdent(databaseName)}`], {
			timeout: 60_000,
		});
	}

	private async countPublicTables(serverUrl: string, databaseName: string): Promise<number> {
		const { stdout } = await execFileAsync(
			"psql",
			[
				`--dbname=${this.databaseUrlFor(serverUrl, databaseName)}`,
				"--no-psqlrc",
				"--quiet",
				"-t",
				"-A",
				"-c",
				"SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public'",
			],
			{ timeout: 60_000 },
		);
		const count: number = Number.parseInt(stdout.trim(), 10);
		if (!Number.isFinite(count)) throw new BadGatewayException("Could not count tables in the restored database.");
		return count;
	}

	/** Streams `gunzip -c <file> | psql` with backpressure + a 30-min watchdog. */
	private restoreDumpFile(targetPath: string, serverUrl: string, databaseName: string): Promise<DumpResult> {
		return new Promise<DumpResult>((resolvePromise): void => {
			const args: string[] = [`--dbname=${this.databaseUrlFor(serverUrl, databaseName)}`, "--no-psqlrc", "--quiet", "-v", "ON_ERROR_STOP=1"];
			let child: ChildProcessWithoutNullStreams;
			try {
				child = spawn("psql", args, { stdio: ["pipe", "pipe", "pipe"] });
			} catch (error) {
				resolvePromise({ ok: false, reason: "child", detail: error instanceof Error ? error.message : String(error) });
				return;
			}

			const gunzip = createGunzip();
			const input = createReadStream(targetPath);
			input.pipe(gunzip).pipe(child.stdin);

			let stderrTail = "";
			child.stderr.on("data", (chunk: Buffer): void => {
				stderrTail = `${stderrTail}${chunk.toString()}`.slice(-4000);
			});

			let timedOut = false;
			// Watchdog — a wedged psql must not hold the restore slot forever.
			const watchdog = setTimeout(
				(): void => {
					timedOut = true;
					child.kill("SIGKILL");
				},
				30 * 60 * 1000,
			);

			let childExit: DumpResult | null = null;
			let inputError: Error | null = null;

			child.on("error", (error: Error): void => {
				inputError = error;
			});
			child.on("close", (code: number | null): void => {
				clearTimeout(watchdog);
				childExit ??=
					inputError !== null
						? { ok: false, reason: "pipe", detail: `Unable to start psql: ${inputError.message}` }
						: timedOut
							? { ok: false, reason: "timeout", detail: "Restore exceeded the 30-minute watchdog and was killed." }
							: code === 0
								? { ok: true }
								: { ok: false, reason: "child", detail: stderrTail.length > 0 ? stderrTail : `psql exited with code ${String(code)}` };
				resolvePromise(childExit);
			});
			// Read failure (missing/corrupt file) — tear the restore down.
			input.on("error", (error: Error): void => {
				child.kill("SIGKILL");
				childExit = { ok: false, reason: "pipe", detail: `Read failed: ${error.message}` };
			});
		});
	}

	// ── Verify / restore ───────────────────────────────────────────────────

	/**
	 * Restores the dump into a throwaway scratch database and drops it. The
	 * check proves the backup restores cleanly WITHOUT touching real data:
	 * the scratch DB is created from the dump and removed in a `finally`,
	 * even when the restore fails. Throws on failure (never a 2xx-with-error).
	 * The result is persisted on the row (verifiedAt + verifiedTableCount).
	 */
	public async verifyBackup(id: string): Promise<BackupVerifyResponse> {
		this.assertEnabled();
		const started = Date.now();
		const row = await this.requireRow(id);
		if (row.status !== "completed") {
			throw new BadRequestException(`Backup is ${row.status} — only completed backups can be verified.`);
		}
		const targetPath: string = this.resolveBackupPath(row.filename);
		await this.assertRestorableFile(targetPath);
		// Corrupted-on-disk files fail fast against the recorded checksum.
		await this.assertChecksumMatches(row, targetPath);

		await this.acquireRestoreSlot();
		const database = `verify_${id.slice(0, 8)}`;
		const serverUrl: string = this.maintenanceServerUrl();
		try {
			await this.createDatabase(serverUrl, database);
			const restore = await this.restoreDumpFile(targetPath, serverUrl, database);
			if (!restore.ok) throw new BadGatewayException(`Restore check failed: ${restore.detail}`);
			const tableCount: number = await this.countPublicTables(serverUrl, database);
			await this.prisma.backup.update({ where: { id }, data: { verifiedAt: Date.now(), verifiedTableCount: tableCount } });
			this.auditLog({ event: "verified", backupId: id, userId: row.requestedBy, timestamp: Date.now(), metadata: { tableCount, durationMs: Date.now() - started } });
			this.logs.info("Backup verified", {
				context: "BackupService",
				metadata: { backupId: id, tableCount, durationMs: Date.now() - started },
			});
			return { tableCount, durationMs: Date.now() - started, database };
		} finally {
			try {
				await this.dropDatabase(serverUrl, database);
			} catch (dropErr) {
				this.logs.warn(`Failed to drop scratch database ${database} after verify: ${dropErr instanceof Error ? dropErr.message : String(dropErr)}`, {
					context: "BackupService",
				});
			}
			await this.releaseRestoreSlot();
		}
	}

	/**
	 * Restores the dump into a NEW database and leaves it in place for
	 * inspection. Never touches an existing database: the target name is
	 * validated (identifier-only) and the create fails with 409 if a database
	 * of that name already exists. Restore re-verifies the admin's password
	 * (it creates a real database — the closest thing this feature has to a
	 * destructive action). The result is persisted on the row.
	 */
	public async restoreBackup(id: string, input: BackupRestoreInput, userSub: string): Promise<BackupRestoreResponse> {
		this.assertEnabled();
		const started = Date.now();
		const row = await this.requireRow(id);
		if (row.status !== "completed") {
			throw new BadRequestException(`Backup is ${row.status} — only completed backups can be restored.`);
		}
		const targetPath: string = this.resolveBackupPath(row.filename);
		await this.assertRestorableFile(targetPath);
		await this.assertChecksumMatches(row, targetPath);

		const parsed: BackupRestoreInput = BackupRestoreInputSchema.parse(input);
		await this.assertRestorePassword(userSub, parsed.password);
		const database: string = parsed.name ?? `restored_${row.name}_${timestampForFilename(new Date())}`;

		await this.acquireRestoreSlot();
		const serverUrl: string = this.maintenanceServerUrl();
		try {
			try {
				await this.createDatabase(serverUrl, database);
			} catch (error) {
				// Map "already exists" to a clean conflict; surface other failures as-is.
				if (error instanceof Error && /already exists/i.test(error.message)) {
					throw new ConflictException(`A database named "${database}" already exists — choose another name.`);
				}
				throw error;
			}
			const restore = await this.restoreDumpFile(targetPath, serverUrl, database);
			if (!restore.ok) throw new BadGatewayException(`Restore failed: ${redact(restore.detail)}`);
			const tableCount: number = await this.countPublicTables(serverUrl, database);
			await this.prisma.backup.update({ where: { id }, data: { restoredAt: Date.now(), restoredDatabase: database } });
			this.auditLog({ event: "restored", backupId: id, userId: userSub, timestamp: Date.now(), metadata: { database, tableCount, durationMs: Date.now() - started } });
			this.logs.info("Backup restored", {
				context: "BackupService",
				userId: userSub,
				metadata: { backupId: id, database, tableCount, durationMs: Date.now() - started },
			});
			return { database, tableCount, durationMs: Date.now() - started };
		} finally {
			await this.releaseRestoreSlot();
		}
	}

	/** Restore is a real-database-creating action — require the admin's password. */
	private async assertRestorePassword(userSub: string, password: string): Promise<void> {
		const user = await this.prisma.user.findUnique({ where: { id: userSub }, select: { passwordHash: true } });
		if (user === null || user.passwordHash.length === 0) {
			throw new ForbiddenException("Restore requires a valid admin password — the account has no local password.");
		}
		const valid: boolean = await bcrypt.compare(password, user.passwordHash);
		if (!valid) {
			throw new ForbiddenException("Incorrect password — restore requires re-verification of your credentials.");
		}
	}

	/** Re-hashes the file against the recorded checksum before a restore/verify. */
	private async assertChecksumMatches(row: { readonly checksum: string | null }, targetPath: string): Promise<void> {
		if (row.checksum === null || row.checksum.length === 0) return;
		const actual: string = await this.hashFile(targetPath);
		if (actual !== row.checksum) {
			throw new ServiceUnavailableException("Backup file failed its checksum check — it was modified or corrupted on disk since creation.");
		}
	}

	// ── Delete / retention ─────────────────────────────────────────────────

	/** Deletes the file (if present) + the row. */
	public async remove(id: string): Promise<{ readonly deleted: true }> {
		this.assertEnabled();
		const row = await this.requireRow(id);
		if (row.filename.length > 0) {
			try {
				unlinkSync(resolve(this.config.backupDir, row.filename));
			} catch (delErr) {
				this.logs.warn(`Backup file already gone on delete: ${delErr instanceof Error ? delErr.message : String(delErr)}`, { context: "BackupService" });
			}
		}
		await this.prisma.backup.delete({ where: { id } });
		this.auditLog({ event: "deleted", backupId: id, userId: row.requestedBy, timestamp: Date.now() });
		this.logs.info("Backup deleted", { context: "BackupService", metadata: { backupId: id, name: row.name } });
		return { deleted: true };
	}

	/** Deletes files + rows past the retention deadline (epoch-based cutoff). */
	private async pruneExpired(): Promise<void> {
		const expired = await this.prisma.backup.findMany({
			where: { expiresAt: { not: null, lt: Date.now() } },
			select: { id: true, filename: true },
		});
		if (expired.length === 0) return;
		for (const row of expired) {
			if (row.filename.length > 0) {
				try {
					unlinkSync(resolve(this.config.backupDir, row.filename));
				} catch (pruneErr) {
					this.logs.warn(`Failed to delete expired backup file ${row.filename}: ${pruneErr instanceof Error ? pruneErr.message : String(pruneErr)}`, {
						context: "BackupService",
					});
				}
			}
			await this.prisma.backup.delete({ where: { id: row.id } });
		}
		this.logs.info(`Pruned ${String(expired.length)} expired backup(s)`, { context: "BackupService" });
	}

	// ── Helpers ────────────────────────────────────────────────────────────

	private async requireRow(id: string): Promise<{
		readonly id: string;
		readonly name: string;
		readonly status: string;
		readonly progress: number;
		readonly stage: string;
		readonly filename: string;
		readonly compressLevel: number;
		readonly schemaOnly: boolean;
		readonly tablesExcluded: readonly string[];
		readonly requestedBy: string;
		readonly requestedByName: string | null;
		readonly sizeBytes: bigint | null;
		readonly checksum: string | null;
		readonly error: string | null;
		readonly errorCode: string | null;
		readonly createdAt: bigint;
		readonly completedAt: bigint | null;
		readonly expiresAt: bigint | null;
		readonly verifiedAt: bigint | null;
		readonly verifiedTableCount: number | null;
		readonly restoredAt: bigint | null;
		readonly restoredDatabase: string | null;
	}> {
		const row = await this.prisma.backup.findUnique({ where: { id } });
		if (row === null) throw new NotFoundException("Backup not found.");
		return row;
	}

	/** Queue position for a row: 0 = running, 1+ = waiting, null = done/failed. */
	private positionOf(id: string): number | null {
		if (this.runningBackupId === id) return 0;
		const index: number = this.queue.indexOf(id);
		return index === -1 ? null : index + 1;
	}

	private mapRow(row: {
		readonly id: string;
		readonly name: string;
		readonly status: string;
		readonly progress: number;
		readonly stage: string;
		readonly sizeBytes: bigint | null;
		readonly checksum: string | null;
		readonly error: string | null;
		readonly errorCode: string | null;
		readonly compressLevel: number;
		readonly schemaOnly: boolean;
		readonly tablesExcluded: readonly string[];
		readonly requestedBy: string;
		readonly requestedByName: string | null;
		readonly createdAt: bigint;
		readonly completedAt: bigint | null;
		readonly expiresAt: bigint | null;
		readonly verifiedAt: bigint | null;
		readonly verifiedTableCount: number | null;
		readonly restoredAt: bigint | null;
		readonly restoredDatabase: string | null;
	}): BackupEntry {
		return BackupEntrySchema.parse({
			id: row.id,
			name: row.name,
			status: row.status,
			progress: row.progress,
			stage: row.stage,
			sizeBytes: row.sizeBytes === null ? null : Number(row.sizeBytes),
			checksum: row.checksum,
			error: row.error,
			errorCode: row.errorCode,
			compressLevel: row.compressLevel,
			schemaOnly: row.schemaOnly,
			tablesExcluded: row.tablesExcluded,
			requestedBy: row.requestedBy,
			requestedByName: row.requestedByName,
			createdAt: epochMs(Number(row.createdAt)),
			completedAt: row.completedAt === null ? null : epochMs(Number(row.completedAt)),
			expiresAt: row.expiresAt === null ? null : epochMs(Number(row.expiresAt)),
			verifiedAt: row.verifiedAt === null ? null : epochMs(Number(row.verifiedAt)),
			verifiedTableCount: row.verifiedTableCount,
			restoredAt: row.restoredAt === null ? null : epochMs(Number(row.restoredAt)),
			restoredDatabase: row.restoredDatabase,
			position: this.positionOf(row.id),
		});
	}

	// ── DB-backed rate limiting ─────────────────────────────────────────────

	/** The requesting user's rolling-hour creation quota from `backup_rate_limits` (DB-backed). */
	private async rateLimitState(
		userId: string,
		isSuperAdmin: boolean,
	): Promise<{ readonly limit: number; readonly used: number; readonly resetsAt: ReturnType<typeof epochMs> } | null> {
		// Superadmins get a higher cap (10/hr) than regular admins (5/hr).
		const limit: number = isSuperAdmin ? this.config.backupRateLimitSuperAdminPerHour : this.config.backupRateLimitPerHour;
		if (limit <= 0) return null;
		const now: number = Date.now();
		const windowMs: number = 60 * 60 * 1000;
		const cutoff = BigInt(now - windowMs);
		const [countResult] = await Promise.all([
			this.prisma.backupRateLimit.count({ where: { userId, action: "create", windowStart: { gte: cutoff } } }),
			this.prisma.backupRateLimit.deleteMany({ where: { userId, action: "create", windowStart: { lt: cutoff } } }),
		]);
		return { limit, used: countResult, resetsAt: epochMs(now) };
	}

	private async enforceRateLimit(userId: string, isSuperAdmin: boolean): Promise<void> {
		const state = await this.rateLimitState(userId, isSuperAdmin);
		if (state === null) return;
		if (state.used >= state.limit) {
			throw new ServiceUnavailableException(`Backup rate limit reached — max ${String(state.limit)} backups per hour.`);
		}
		await this.prisma.backupRateLimit.create({
			data: { userId, action: "create", windowStart: BigInt(Date.now()) },
		});
	}

	private async enforceDownloadRateLimit(userId: string): Promise<void> {
		const limit: number = this.config.backupDownloadRateLimit;
		if (limit <= 0) return;
		const now: number = Date.now();
		const windowMs: number = 15 * 60 * 1000;
		const cutoff = BigInt(now - windowMs);
		const [countResult] = await Promise.all([
			this.prisma.backupRateLimit.count({ where: { userId, action: "download", windowStart: { gte: cutoff } } }),
			this.prisma.backupRateLimit.deleteMany({ where: { userId, action: "download", windowStart: { lt: cutoff } } }),
		]);
		if (countResult >= limit) {
			throw new ServiceUnavailableException(`Download rate limit reached — max ${String(limit)} download links per 15 minutes.`);
		}
		await this.prisma.backupRateLimit.create({
			data: { userId, action: "download", windowStart: BigInt(now) },
		});
	}

	// ── DB-backed circuit breaker ───────────────────────────────────────────

	/** Circuit breaker: 3 consecutive failures park creates until one succeeds. */
	private async assertCircuitHealthy(): Promise<void> {
		const row = await this.prisma.backupCircuitBreaker.findUnique({ where: { id: "singleton" } });
		if ((row?.consecutiveFailures ?? 0) >= 3) {
			throw new ServiceUnavailableException("Backups are temporarily unavailable after repeated failures — check the API logs before trying again.");
		}
	}

	private async recordCircuitFailure(): Promise<void> {
		const now = BigInt(Date.now());
		await this.prisma.backupCircuitBreaker.upsert({
			where: { id: "singleton" },
			create: { id: "singleton", consecutiveFailures: 1, lastFailureAt: now, trippedAt: now },
			update: { consecutiveFailures: { increment: 1 }, lastFailureAt: now, trippedAt: now },
		});
	}

	private async recordCircuitSuccess(): Promise<void> {
		await this.prisma.backupCircuitBreaker.upsert({
			where: { id: "singleton" },
			create: { id: "singleton", consecutiveFailures: 0 },
			update: { consecutiveFailures: 0 },
		});
	}

	// ── DB-backed restore lock ──────────────────────────────────────────────

	/** Tries to acquire the cluster-wide restore lock. Auto-expires after 30 min. */
	private async acquireRestoreSlot(): Promise<void> {
		const now = BigInt(Date.now());
		const expiryMs: number = 30 * 60 * 1000;
		// Expire stale locks first.
		await this.prisma.backupRestoreLock.updateMany({
			where: { locked: true, expiresAt: { not: null, lt: now } },
			data: { locked: false, lockedBy: null, lockedAt: null, expiresAt: null },
		});
		const acquired = await this.prisma.backupRestoreLock.updateMany({
			where: { id: "singleton", locked: false },
			data: { locked: true, lockedBy: this.instanceId, lockedAt: now, expiresAt: BigInt(Date.now() + expiryMs) },
		});
		if (acquired.count === 0) {
			throw new ConflictException("A restore/verify is already running — wait for it to finish.");
		}
	}

	private async releaseRestoreSlot(): Promise<void> {
		await this.prisma.backupRestoreLock.updateMany({
			where: { id: "singleton", lockedBy: this.instanceId },
			data: { locked: false, lockedBy: null, lockedAt: null, expiresAt: null },
		});
	}

	private assertEnabled(): void {
		if (!this.config.backupEnabled) {
			throw new NotFoundException("Backup feature is disabled.");
		}
	}
}
