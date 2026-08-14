import { Inject, Injectable, type OnModuleInit } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { z } from "zod";

import {
	DumpEntrySchema,
	ExceptionLogEntrySchema,
	QueryLogEntrySchema,
	RequestLogEntrySchema,
	TelescopeAlertEntrySchema,
	TelescopeJobLogEntrySchema,
	TelescopeJsonValueSchema,
	TelescopeLogEntrySchema,
	TelescopeSpanSchema,
	type DumpEntry,
	type ExceptionLogEntry,
	type QueryLogEntry,
	type RequestLogEntry,
	type RequestLogSummary,
	type TelescopeAlertEntry,
	type TelescopeAlertStatus,
	type TelescopeAnnotation,
	type TelescopeExceptionListQuery,
	type TelescopeExceptionStatus,
	type TelescopeJobLogEntry,
	type TelescopeJobsListQuery,
	type TelescopeJsonValue,
	type TelescopeLeaderboardEntry,
	type TelescopeLogEntry,
	type TelescopeLogRow,
	type TelescopeLogsListQuery,
	type TelescopeOptions,
	type TelescopeRequestListQuery,
	type TelescopeScheduleLog,
	type TelescopeSearchQuery,
	type TelescopeSearchResponse,
	type TelescopeSpan,
	type TelescopeSqlListQuery,
	type TelescopeTrendPoint,
	type TelescopeUserSummary,
	type TelescopeUsersQuery,
	type TelescopeWebhookDelivery,
} from "@workspace/shared";

import { PrismaService } from "../../prisma/prisma.service.js";

import { TELESCOPE_OPTIONS } from "./telescope.options.js";
import { TelescopeMemoryStore, type ListResult, type OverviewStats, type TelescopeStore } from "./telescope.store.js";

/**
 * Improvement 1 — durable Postgres store (opt-in via `TELESCOPE_MODE=postgres`).
 *
 * Design: a memory ring-buffer stays the read/query surface (sync, instant,
 * identical filter semantics), while every write is ALSO persisted to Prisma
 * fire-and-forget and the buffer is hydrated from the DB at boot. This keeps
 * the `TelescopeStore` interface sync (zero ripple through the capture chain)
 * and gives "history survives restarts" for free.
 *
 * Retention (improvement 4) prunes both the buffer and the DB tables.
 */
@Injectable()
export class TelescopePostgresStore implements TelescopeStore, OnModuleInit {
	public readonly mode: string = "postgres";

	/** All reads delegate to this buffer; writes persist through it. */
	private readonly memory: TelescopeMemoryStore;

	public constructor(
		private readonly prisma: PrismaService,
		@Inject(TELESCOPE_OPTIONS) private readonly options: TelescopeOptions,
	) {
		this.memory = new TelescopeMemoryStore(options.maxRequests);
	}

	/** Hydrates the buffer from the DB at boot so history survives restarts. */
	public async onModuleInit(): Promise<void> {
		// Static-registered unconditionally (the TELESCOPE_STORE factory picks
		// memory instead when storage is not postgres) — never touch the DB
		// unless this store is actually the active backend.
		if (this.options.storage !== "postgres") {
			return;
		}
		const [requests, queries, exceptions, dumps, jobs, alerts, annotations] = await Promise.all([
			this.prisma.telescopeRequest.findMany({ orderBy: { createdAt: "desc" }, take: this.options.maxRequests }),
			this.prisma.telescopeQuery.findMany({ orderBy: { createdAt: "desc" }, take: this.options.maxRequests * 4 }),
			this.prisma.telescopeException.findMany({ orderBy: { createdAt: "desc" }, take: this.options.maxRequests }),
			this.prisma.telescopeDump.findMany({ orderBy: { createdAt: "desc" }, take: this.options.maxRequests }),
			this.prisma.telescopeJob.findMany({ orderBy: { createdAt: "desc" }, take: 500 }),
			this.prisma.telescopeAlert.findMany({ orderBy: { createdAt: "desc" }, take: 200 }),
			this.prisma.telescopeAnnotation.findMany(),
		]);

		// Oldest-first push restores the same ordering the memory store produces.
		for (const row of requests.reverse()) {
			this.memory.pushRequest(mapRequestRow(row));
		}
		for (const row of queries.reverse()) {
			this.memory.pushQuery(mapQueryRow(row));
		}
		for (const row of exceptions.reverse()) {
			this.memory.pushException(mapExceptionRow(row));
		}
		for (const row of dumps.reverse()) {
			this.memory.pushDump(mapDumpRow(row));
		}
		for (const row of jobs.reverse()) {
			this.memory.pushJob(mapJobRow(row));
		}
		for (const row of alerts.reverse()) {
			this.memory.pushAlert(mapAlertRow(row));
		}
		for (const row of annotations) {
			this.memory.setAnnotation(row.requestId, {
				starred: row.starred,
				comment: row.comment ?? "",
				updatedAt: row.updatedAt.toISOString(),
			});
		}
	}

	// ── Writes: buffer + fire-and-forget persistence ────────────────────────

	public pushRequest(entry: RequestLogEntry): void {
		this.memory.pushRequest(entry);
		void this.prisma.telescopeRequest.create({ data: toRequestRow(entry) }).catch((err: Error): void => {
			this.logPersistError("request", err);
		});
	}

	public pushQuery(entry: QueryLogEntry): void {
		this.memory.pushQuery(entry);
		void this.prisma.telescopeQuery.create({ data: toQueryRow(entry) }).catch((err: Error): void => {
			this.logPersistError("query", err);
		});
	}

	public pushException(entry: ExceptionLogEntry): void {
		// Group aggregation must be reflected in Postgres too: instead of a
		// blind insert, upsert on the errorGroup (first insert wins the id +
		// firstSeenAt; every repeat bumps occurrences + lastSeenAt). A repeat
		// also re-opens a resolved/ignored group (triage status is per-lifetime).
		this.memory.pushException(entry);
		const row = toExceptionRow(entry);
		void this.prisma.telescopeException
			.upsert({
				where: { errorGroup: row.errorGroup },
				create: row,
				update: {
					occurrences: { increment: 1 },
					lastSeenAt: new Date(entry.createdAt),
					message: entry.message,
					stack: entry.stack ?? null,
					status: "open",
				},
			})
			.catch((err: Error): void => {
				this.logPersistError("exception", err);
			});
	}

	public pushDump(entry: DumpEntry): void {
		this.memory.pushDump(entry);
		void this.prisma.telescopeDump.create({ data: toDumpRow(entry) }).catch((err: Error): void => {
			this.logPersistError("dump", err);
		});
	}

	// ── Feature surfaces: buffer + persistence (improvement 1) ──────────────

	public pushJob(entry: TelescopeJobLogEntry): void {
		this.memory.pushJob(entry);
		// Upsert on id — the runner pushes the same entry twice (running + terminal).
		void this.prisma.telescopeJob
			.upsert({
				where: { id: entry.id },
				create: toJobRow(entry),
				update: {
					status: entry.status,
					durationMs: entry.durationMs,
					error: entry.error,
					startedAt: entry.startedAt !== null ? new Date(entry.startedAt) : null,
					finishedAt: entry.finishedAt !== null ? new Date(entry.finishedAt) : null,
				},
			})
			.catch((err: Error): void => {
				this.logPersistError("job", err);
			});
	}

	public listJobs(query: TelescopeJobsListQuery): ListResult<TelescopeJobLogEntry> {
		return this.memory.listJobs(query);
	}

	public getJob(id: string): TelescopeJobLogEntry | undefined {
		return this.memory.getJob(id);
	}

	public pushAlert(entry: TelescopeAlertEntry): void {
		this.memory.pushAlert(entry);
		void this.prisma.telescopeAlert.create({ data: toAlertRow(entry) }).catch((err: Error): void => {
			this.logPersistError("alert", err);
		});
	}

	public listAlerts(limit: number): readonly TelescopeAlertEntry[] {
		return this.memory.listAlerts(limit);
	}

	/** Feature 13 — webhook delivery records are ephemeral diagnostics; memory-scoped. */
	public pushWebhookDelivery(entry: TelescopeWebhookDelivery): void {
		this.memory.pushWebhookDelivery(entry);
	}

	public listWebhookDeliveries(limit: number): readonly TelescopeWebhookDelivery[] {
		return this.memory.listWebhookDeliveries(limit);
	}

	/** Feature 1 — search + feature 3 — user aggregation read the memory buffer. */
	public search(query: TelescopeSearchQuery, emailUserIds?: ReadonlySet<string>): TelescopeSearchResponse {
		return this.memory.search(query, emailUserIds);
	}

	public listUsers(query: TelescopeUsersQuery): ListResult<TelescopeUserSummary> {
		return this.memory.listUsers(query);
	}

	public setAlertStatus(id: string, status: TelescopeAlertStatus, snoozedUntil: string | null): void {
		this.memory.setAlertStatus(id, status, snoozedUntil);
		void this.prisma.telescopeAlert
			.update({
				where: { id },
				data: { status, snoozedUntil: snoozedUntil !== null ? new Date(snoozedUntil) : null },
			})
			.catch((err: Error): void => {
				this.logPersistError("alert-status", err);
			});
	}

	public setAnnotation(requestId: string, annotation: TelescopeAnnotation | null): void {
		this.memory.setAnnotation(requestId, annotation);
		if (annotation === null) {
			void this.prisma.telescopeAnnotation.delete({ where: { requestId } }).catch((err: Error): void => {
				this.logPersistError("annotation-delete", err);
			});
			return;
		}
		void this.prisma.telescopeAnnotation
			.upsert({
				where: { requestId },
				create: { requestId, starred: annotation.starred, comment: annotation.comment, updatedAt: new Date(annotation.updatedAt) },
				update: { starred: annotation.starred, comment: annotation.comment, updatedAt: new Date(annotation.updatedAt) },
			})
			.catch((err: Error): void => {
				this.logPersistError("annotation", err);
			});
	}

	public getAnnotation(requestId: string): TelescopeAnnotation | null {
		return this.memory.getAnnotation(requestId);
	}

	public setExceptionStatus(errorGroup: string, status: TelescopeExceptionStatus): void {
		this.memory.setExceptionStatus(errorGroup, status);
		void this.prisma.telescopeException.updateMany({ where: { errorGroup }, data: { status } }).catch((err: Error): void => {
			this.logPersistError("exception-status", err);
		});
	}

	public getAdjacentRequestIds(id: string): { readonly prevId: string | null; readonly nextId: string | null } {
		return this.memory.getAdjacentRequestIds(id);
	}

	public findPreviousRequest(id: string): RequestLogEntry | undefined {
		return this.memory.findPreviousRequest(id);
	}

	public health(): { readonly mode: "postgres"; readonly bufferRequests: number; readonly bufferCap: number } {
		// The Postgres store persists rows to the DB; the "buffer" surface shown
		// on the health card reflects the in-memory ring that backs live reads.
		const memoryHealth = this.memory.health();
		return {
			mode: "postgres",
			bufferRequests: memoryHealth.bufferRequests,
			bufferCap: memoryHealth.bufferCap,
		};
	}

	// ── Reads: pure delegation ──────────────────────────────────────────────

	public listRequests(query: TelescopeRequestListQuery): ListResult<RequestLogSummary> {
		return this.memory.listRequests(query);
	}

	public getRequest(id: string): RequestLogEntry | undefined {
		return this.memory.getRequest(id);
	}

	public listQueries(query: TelescopeSqlListQuery): ListResult<QueryLogEntry> {
		return this.memory.listQueries(query);
	}

	public listQueriesByCorrelationId(correlationId: string): readonly QueryLogEntry[] {
		return this.memory.listQueriesByCorrelationId(correlationId);
	}

	public listExceptions(query: TelescopeExceptionListQuery): ListResult<ExceptionLogEntry> {
		return this.memory.listExceptions(query);
	}

	public getException(id: string): ExceptionLogEntry | undefined {
		return this.memory.getException(id);
	}

	public listDumpsByCorrelationId(correlationId: string): readonly DumpEntry[] {
		return this.memory.listDumpsByCorrelationId(correlationId);
	}

	public overviewStats(fromIso: string): OverviewStats {
		return this.memory.overviewStats(fromIso);
	}

	// ── Aggregate reads: delegated (identical filter semantics via the buffer) ──

	public leaderboard(fromIso: string, limit: number): readonly TelescopeLeaderboardEntry[] {
		return this.memory.leaderboard(fromIso, limit);
	}

	public trends(fromIso: string, bucketCount: number): readonly TelescopeTrendPoint[] {
		return this.memory.trends(fromIso, bucketCount);
	}

	public upsertSchedule(entry: TelescopeScheduleLog): void {
		this.memory.upsertSchedule(entry);
	}

	public listSchedules(): readonly TelescopeScheduleLog[] {
		return this.memory.listSchedules();
	}

	public listLogs(query: TelescopeLogsListQuery): ListResult<TelescopeLogRow> {
		return this.memory.listLogs(query);
	}

	/** Prunes both the buffer and the DB tables (improvement 4). */
	public pruneRetention(retentionMinutes: number): number {
		const removed: number = this.memory.pruneRetention(retentionMinutes);
		const cutoff: Date = new Date(Date.now() - retentionMinutes * 60 * 1000);
		void this.prisma.telescopeRequest.deleteMany({ where: { createdAt: { lt: cutoff } } }).catch((err: Error): void => {
			this.logPersistError("prune", err);
		});
		void this.prisma.telescopeQuery.deleteMany({ where: { createdAt: { lt: cutoff } } }).catch((err: Error): void => {
			this.logPersistError("prune", err);
		});
		void this.prisma.telescopeException.deleteMany({ where: { createdAt: { lt: cutoff } } }).catch((err: Error): void => {
			this.logPersistError("prune", err);
		});
		void this.prisma.telescopeDump.deleteMany({ where: { createdAt: { lt: cutoff } } }).catch((err: Error): void => {
			this.logPersistError("prune", err);
		});
		void this.prisma.telescopeJob.deleteMany({ where: { createdAt: { lt: cutoff } } }).catch((err: Error): void => {
			this.logPersistError("prune", err);
		});
		void this.prisma.telescopeAlert.deleteMany({ where: { createdAt: { lt: cutoff } } }).catch((err: Error): void => {
			this.logPersistError("prune", err);
		});
		return removed;
	}

	public clear(): void {
		this.memory.clear();
	}

	private logPersistError(kind: string, err: Error): void {
		console.warn(`[Telescope] postgres persist failed (${kind}): ${err.message}`);
	}
}

// ── Row ↔ entry mapping ─────────────────────────────────────────────────────

/** JSON-budget typing: every value that crosses the Prisma boundary is one of these. */
type StoredJson = TelescopeJsonValue | readonly TelescopeSpan[] | readonly TelescopeLogEntry[] | Record<string, string> | null;

function toJsonInput(value: StoredJson): Prisma.InputJsonValue {
	// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Library boundary: Prisma's InputJsonValue is the JSON value union; StoredJson is a strict subset.
	return value as Prisma.InputJsonValue;
}

function toRequestRow(entry: RequestLogEntry): Prisma.TelescopeRequestCreateInput {
	return {
		id: entry.id,
		correlationId: entry.correlationId,
		method: entry.method,
		path: entry.path,
		statusCode: entry.statusCode,
		userId: entry.userId,
		durationMs: entry.durationMs,
		queryString: entry.queryString,
		ip: entry.ip,
		userAgent: entry.userAgent,
		requestBody: toJsonInput(entry.requestBody),
		responseBody: toJsonInput(entry.responseBody),
		requestHeaders: toJsonInput(entry.requestHeaders),
		spans: toJsonInput(entry.spans),
		logs: toJsonInput(entry.logs),
		createdAt: new Date(entry.createdAt),
	};
}

function mapRequestRow(row: {
	readonly id: string;
	readonly correlationId: string;
	readonly method: string;
	readonly path: string;
	readonly statusCode: number | null;
	readonly userId: string | null;
	readonly durationMs: number;
	readonly queryString: string | null;
	readonly ip: string | null;
	readonly userAgent: string | null;
	readonly requestBody: Prisma.JsonValue | null;
	readonly responseBody: Prisma.JsonValue | null;
	readonly requestHeaders: Prisma.JsonValue | null;
	readonly spans: Prisma.JsonValue;
	readonly logs: Prisma.JsonValue;
	readonly createdAt: Date;
}): RequestLogEntry {
	const parsed = RequestLogEntrySchema.safeParse({
		id: row.id,
		correlationId: row.correlationId,
		method: row.method,
		path: row.path,
		statusCode: row.statusCode,
		userId: row.userId,
		durationMs: row.durationMs,
		queryString: row.queryString,
		ip: row.ip,
		userAgent: row.userAgent,
		requestBody: parseJsonOrNull(row.requestBody),
		responseBody: parseJsonOrNull(row.responseBody),
		requestHeaders: parseHeaderMap(row.requestHeaders),
		spans: parseArraySafe(TelescopeSpanSchema.array(), row.spans),
		logs: parseArraySafe(TelescopeLogEntrySchema.array(), row.logs),
		createdAt: row.createdAt.toISOString(),
	});
	if (!parsed.success) {
		throw new Error(`[Telescope] hydrated request row failed schema validation: ${parsed.error.message}`);
	}
	return parsed.data;
}

function toQueryRow(entry: QueryLogEntry): Prisma.TelescopeQueryCreateInput {
	return {
		id: entry.id,
		correlationId: entry.correlationId,
		model: entry.model,
		operation: entry.operation,
		query: entry.query,
		params: entry.params,
		durationMs: entry.durationMs,
		createdAt: new Date(entry.createdAt),
	};
}

function mapQueryRow(row: {
	readonly id: string;
	readonly correlationId: string;
	readonly model: string;
	readonly operation: string;
	readonly query: string;
	readonly params: string | null;
	readonly durationMs: number;
	readonly createdAt: Date;
}): QueryLogEntry {
	return QueryLogEntrySchema.parse({
		id: row.id,
		correlationId: row.correlationId,
		model: row.model,
		operation: row.operation,
		query: row.query,
		params: row.params,
		durationMs: row.durationMs,
		createdAt: row.createdAt.toISOString(),
	});
}

function toExceptionRow(entry: ExceptionLogEntry): Prisma.TelescopeExceptionCreateInput {
	return {
		id: entry.id,
		correlationId: entry.correlationId,
		errorGroup: entry.errorGroup,
		name: entry.name,
		message: entry.message,
		stack: entry.stack,
		statusCode: entry.statusCode,
		path: entry.path,
		method: entry.method,
		userId: entry.userId,
		occurrences: 1,
		createdAt: new Date(entry.createdAt),
		firstSeenAt: new Date(entry.firstSeenAt),
		lastSeenAt: new Date(entry.lastSeenAt),
		status: entry.status,
	};
}

function mapExceptionRow(row: {
	readonly id: string;
	readonly correlationId: string;
	readonly errorGroup: string;
	readonly name: string;
	readonly message: string;
	readonly stack: string | null;
	readonly statusCode: number | null;
	readonly path: string | null;
	readonly method: string | null;
	readonly userId: string | null;
	readonly occurrences: number;
	readonly createdAt: Date;
	readonly firstSeenAt: Date;
	readonly lastSeenAt: Date;
	readonly status: string;
}): ExceptionLogEntry {
	return ExceptionLogEntrySchema.parse({
		id: row.id,
		correlationId: row.correlationId,
		errorGroup: row.errorGroup,
		name: row.name,
		message: row.message,
		stack: row.stack,
		statusCode: row.statusCode,
		path: row.path,
		method: row.method,
		userId: row.userId,
		occurrences: row.occurrences,
		createdAt: row.createdAt.toISOString(),
		firstSeenAt: row.firstSeenAt.toISOString(),
		lastSeenAt: row.lastSeenAt.toISOString(),
		status: row.status,
	});
}

function toDumpRow(entry: DumpEntry): Prisma.TelescopeDumpCreateInput {
	return {
		id: entry.id,
		name: entry.name,
		value: toJsonInput(entry.value),
		correlationId: entry.correlationId,
		createdAt: new Date(entry.createdAt),
	};
}

function mapDumpRow(row: {
	readonly id: string;
	readonly name: string;
	readonly value: Prisma.JsonValue;
	readonly correlationId: string | null;
	readonly createdAt: Date;
}): DumpEntry {
	return DumpEntrySchema.parse({
		id: row.id,
		name: row.name,
		value: row.value,
		correlationId: row.correlationId,
		createdAt: row.createdAt.toISOString(),
	});
}

function toJobRow(entry: TelescopeJobLogEntry): Prisma.TelescopeJobCreateInput {
	return {
		id: entry.id,
		jobName: entry.jobName,
		status: entry.status,
		durationMs: entry.durationMs,
		payloadSize: entry.payloadSize,
		error: entry.error,
		correlationId: entry.correlationId,
		enqueuedAt: new Date(entry.enqueuedAt),
		startedAt: entry.startedAt !== null ? new Date(entry.startedAt) : null,
		finishedAt: entry.finishedAt !== null ? new Date(entry.finishedAt) : null,
	};
}

function mapJobRow(row: {
	readonly id: string;
	readonly jobName: string;
	readonly status: string;
	readonly durationMs: number | null;
	readonly payloadSize: number;
	readonly error: string | null;
	readonly correlationId: string | null;
	readonly enqueuedAt: Date;
	readonly startedAt: Date | null;
	readonly finishedAt: Date | null;
}): TelescopeJobLogEntry {
	return TelescopeJobLogEntrySchema.parse({
		id: row.id,
		jobName: row.jobName,
		status: row.status,
		durationMs: row.durationMs,
		payloadSize: row.payloadSize,
		error: row.error,
		correlationId: row.correlationId,
		enqueuedAt: row.enqueuedAt.toISOString(),
		startedAt: row.startedAt !== null ? row.startedAt.toISOString() : null,
		finishedAt: row.finishedAt !== null ? row.finishedAt.toISOString() : null,
	});
}

function toAlertRow(entry: TelescopeAlertEntry): Prisma.TelescopeAlertCreateInput {
	return {
		id: entry.id,
		requestId: entry.requestId,
		jobName: entry.jobName,
		method: entry.method,
		path: entry.path,
		statusCode: entry.statusCode,
		durationMs: entry.durationMs,
		reason: entry.reason,
		status: entry.status,
		snoozedUntil: entry.snoozedUntil !== null ? new Date(entry.snoozedUntil) : null,
		firedAt: new Date(entry.firedAt),
	};
}

function mapAlertRow(row: {
	readonly id: string;
	readonly requestId: string | null;
	readonly jobName: string | null;
	readonly method: string;
	readonly path: string;
	readonly statusCode: number | null;
	readonly durationMs: number;
	readonly reason: string;
	readonly status: string;
	readonly snoozedUntil: Date | null;
	readonly firedAt: Date;
}): TelescopeAlertEntry {
	return TelescopeAlertEntrySchema.parse({
		id: row.id,
		requestId: row.requestId,
		jobName: row.jobName,
		method: row.method,
		path: row.path,
		statusCode: row.statusCode,
		durationMs: row.durationMs,
		reason: row.reason,
		status: row.status,
		snoozedUntil: row.snoozedUntil !== null ? row.snoozedUntil.toISOString() : null,
		firedAt: row.firedAt.toISOString(),
	});
}

/** Zod-parse a Json column back into `Record<string, string> | null`. */
function parseHeaderMap(value: Prisma.JsonValue | null): Record<string, string> | null {
	const parsed = z.record(z.string(), z.string()).nullable().safeParse(value);
	return parsed.success ? parsed.data : null;
}

/** Zod-parse a Json column through an array schema, defaulting to `[]`. */
function parseArraySafe<T>(schema: z.ZodType<T[]>, value: Prisma.JsonValue): T[] {
	const parsed = schema.safeParse(value);
	return parsed.success ? parsed.data : [];
}

/** Zod-parse a nullable Json column back into a JSON value or `null`. */
function parseJsonOrNull(value: Prisma.JsonValue | null): TelescopeJsonValue | null {
	if (value === null) {
		return null;
	}
	const parsed = TelescopeJsonValueSchema.safeParse(value);
	return parsed.success ? parsed.data : null;
}
