import { z } from "zod";

import { EpochMsSchema } from "../api/common";

/**
 * Database backup — shared contract.
 *
 * The single source of truth for the backup API (create / list / status /
 * download / delete / options) consumed by the NestJS backup module and the
 * admin panel. All timestamps are epoch milliseconds (see `EpochMsSchema`).
 */

// ── Statuses ───────────────────────────────────────────────────────────────

/** Lifecycle of one backup job. */
export const BackupStatusSchema = z.enum(["pending", "processing", "completed", "failed"]);

export type BackupStatus = z.output<typeof BackupStatusSchema>;

/** What the backup is doing right now — drives the UI progress label. */
export const BackupStageSchema = z.enum(["queued", "dumping", "compressing", "finalizing", "done", "failed"]);

export type BackupStage = z.output<typeof BackupStageSchema>;

// ── Create input ───────────────────────────────────────────────────────────

/** User-controlled backup options. Everything has a safe default. */
export const BackupCreateInputSchema = z
	.object({
		/** Optional human label; sanitized to `[a-zA-Z0-9_-]` when absent. */
		name: z
			.string()
			.regex(/^[a-zA-Z0-9_-]+$/, "Only letters, numbers, underscore and hyphen are allowed")
			.max(50)
			.optional(),
		/** gzip level 1–9 (6 = default balance). */
		compressLevel: z.number().int().min(1).max(9).default(6),
		/** Tables whose ROWS are skipped (schema kept) — e.g. high-volume audit tables. */
		tablesToExclude: z.array(z.string().min(1).max(100)).max(200).optional(),
		/** `true` = structure only (`pg_dump --schema-only`); `false` (default) = full dump. */
		schemaOnly: z.boolean().default(false),
	})
	.strict();

export type BackupCreateInput = z.output<typeof BackupCreateInputSchema>;

// ── Backup entry (one row) ─────────────────────────────────────────────────

/** One `backups` row as exposed to the admin panel. */
export const BackupEntrySchema = z
	.object({
		id: z.string().min(1),
		name: z.string().min(1),
		status: BackupStatusSchema,
		progress: z.number().int().min(0).max(100),
		stage: BackupStageSchema,
		/** Compressed file size in bytes — null until the dump finishes. */
		sizeBytes: z.number().int().nonnegative().nullable(),
		/** SHA-256 hex digest of the `.sql.gz` file. */
		checksum: z.string().nullable(),
		error: z.string().nullable(),
		/** Machine-readable failure category — UI maps this to actionable copy. */
		errorCode: z.string().nullable(),
		compressLevel: z.number().int().min(1).max(9),
		/** `true` when the dump was schema-only (`pg_dump --schema-only`). */
		schemaOnly: z.boolean(),
		/** Tables excluded from this dump (rows skipped, schema kept). */
		tablesExcluded: z.array(z.string()).readonly(),
		requestedBy: z.string().nullable(),
		requestedByName: z.string().nullable(),
		createdAt: EpochMsSchema,
		completedAt: EpochMsSchema.nullable(),
		/** Retention deadline — the file + row are deleted after this. */
		expiresAt: EpochMsSchema.nullable(),
		/** Last successful scratch-DB verify (the check ran and the DB was dropped). */
		verifiedAt: EpochMsSchema.nullable(),
		/** Table count from that verify. */
		verifiedTableCount: z.number().int().nonnegative().nullable(),
		/** Last successful restore-into-new-DB. */
		restoredAt: EpochMsSchema.nullable(),
		/** Name of the database created by that restore. */
		restoredDatabase: z.string().nullable(),
		/** Queue position — 0 = running now, 1+ = waiting, null = done/failed. */
		position: z.number().int().min(0).nullable(),
	})
	.strict();

export type BackupEntry = z.output<typeof BackupEntrySchema>;

// ── Responses ──────────────────────────────────────────────────────────────

/** `POST /backup` — accepted for async processing (HTTP 202). */
export const BackupCreateResponseSchema = z
	.object({
		backupId: z.string().min(1),
		status: z.literal("pending"),
		/** Queue position — 0 = running now, 1+ = waiting behind other jobs. */
		position: z.number().int().min(0).nullable(),
	})
	.strict();

export type BackupCreateResponse = z.output<typeof BackupCreateResponseSchema>;

/** `GET /backup` — history + a couple of operational facts the page header shows. */
export const BackupListResponseSchema = z
	.object({
		backups: z.array(BackupEntrySchema),
		/** True while a job is pending/processing — the UI polls while this is set. */
		active: z.boolean(),
		/** How long completed backups are kept (days). */
		retentionDays: z.number().int().positive(),
		/**
		 * The requesting admin's remaining creation quota (rolling hour).
		 * `null` when the cap is disabled for that user's tier (`0` env value).
		 */
		rateLimit: z
			.object({
				/** The tier cap in effect (superadmins get a higher one). */
				limit: z.number().int().positive(),
				/** Backups created in the current rolling window. */
				used: z.number().int().nonnegative(),
				/** Epoch-ms when the oldest entry falls out of the window — quota refills then. */
				resetsAt: EpochMsSchema,
			})
			.strict()
			.nullable(),
		/** Active backup schedules. */
		schedules: z.array(
			z
				.object({
					id: z.string().min(1),
					cron: z.string().min(1),
					name: z.string().min(1),
					enabled: z.boolean(),
					nextRun: EpochMsSchema,
				})
				.strict(),
		),
	})
	.strict();

export type BackupListResponse = z.output<typeof BackupListResponseSchema>;

/** `GET /backup/:id` — the same shape as a list row, for polling. */
export const BackupStatusResponseSchema = BackupEntrySchema;

export type BackupStatusResponse = z.output<typeof BackupStatusResponseSchema>;

/** `POST /backup/:id/download` — mints a short-lived download token. */
export const BackupDownloadResponseSchema = z
	.object({
		/** Signed JWT, valid for `ttlSeconds` — exchanged for the file via the admin proxy. */
		token: z.string().min(1),
		expiresAt: EpochMsSchema,
		/** How long the token stays valid (seconds). */
		ttlSeconds: z.number().int().positive(),
	})
	.strict();

export type BackupDownloadResponse = z.output<typeof BackupDownloadResponseSchema>;

/** `GET /backup/options` — what the create form may exclude. */
export const BackupOptionsResponseSchema = z
	.object({
		tables: z
			.array(
				z
					.object({
						name: z.string().min(1),
						/** True when the row already carries a default exclusion. */
						excludedByDefault: z.boolean(),
					})
					.strict(),
			)
			.readonly(),
		/** The env-driven default exclusion list (pre-checked in the form). */
		defaultExcluded: z.array(z.string()).readonly(),
		compressLevelDefault: z.number().int().min(1).max(9),
		/** Current database size in bytes (queried from pg_database_size). */
		dbSizeBytes: z.number().int().nonnegative().nullable(),
		/** Suggested compression level based on DB size. */
		suggestedCompressLevel: z.number().int().min(1).max(9),
	})
	.strict();

export type BackupOptionsResponse = z.output<typeof BackupOptionsResponseSchema>;

/** `DELETE /backup/:id` — file + row removed. */
export const BackupDeleteResponseSchema = z
	.object({
		deleted: z.literal(true),
	})
	.strict();
export type BackupDeleteResponse = z.output<typeof BackupDeleteResponseSchema>;

// ── Restore / verify ───────────────────────────────────────────────────────

/**
 * Restore target name. Optional — defaults to a generated
 * `restored_<name>_<timestamp>`. PostgreSQL identifiers only, so the value
 * is safe to embed in `CREATE DATABASE` (it is also double-quote escaped).
 *
 * `password` re-verifies the requesting admin's credentials (a restore
 * creates a real database — the closest thing this feature has to a
 * destructive action — so it requires a fresh confirmation).
 */
export const BackupRestoreInputSchema = z
	.object({
		name: z
			.string()
			.regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, "Letters, numbers and underscore only, must start with a letter or underscore")
			.max(63)
			.optional(),
		password: z.string().min(1).max(200),
	})
	.strict();
export type BackupRestoreInput = z.output<typeof BackupRestoreInputSchema>;

/** `POST /backup/:id/cancel` — gracefully stops a pending/running job. */
export const BackupCancelResponseSchema = z
	.object({
		cancelled: z.literal(true),
	})
	.strict();
export type BackupCancelResponse = z.output<typeof BackupCancelResponseSchema>;

/**
 * `POST /backup/:id/verify` — restores the dump into a throwaway scratch
 * database, confirms it, and drops it. A failed restore throws (never a
 * 2xx with `ok: false`), so a resolved response always proves restorability.
 */
export const BackupVerifyResponseSchema = z
	.object({
		/** Number of tables that came back in the restored scratch DB. */
		tableCount: z.number().int().nonnegative(),
		/** How long the restore took (ms). */
		durationMs: z.number().int().nonnegative(),
		/** Scratch database used (always dropped after the check). */
		database: z.string().min(1),
	})
	.strict();
export type BackupVerifyResponse = z.output<typeof BackupVerifyResponseSchema>;

/**
 * `POST /backup/:id/restore` — restores the dump into a NEW database
 * (never an existing one). The database is left in place for inspection;
 * dropping it is a manual `DROP DATABASE`.
 */
export const BackupRestoreResponseSchema = z
	.object({
		/** Name of the newly created database. */
		database: z.string().min(1),
		tableCount: z.number().int().nonnegative(),
		durationMs: z.number().int().nonnegative(),
	})
	.strict();
export type BackupRestoreResponse = z.output<typeof BackupRestoreResponseSchema>;
