import { Inject, Injectable, type OnModuleInit } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { z } from "zod";

import {
	DumpEntrySchema,
	ExceptionLogEntrySchema,
	QueryLogEntrySchema,
	RequestLogEntrySchema,
	TelescopeJsonValueSchema,
	TelescopeLogEntrySchema,
	TelescopeSpanSchema,
	type DumpEntry,
	type ExceptionLogEntry,
	type QueryLogEntry,
	type RequestLogEntry,
	type RequestLogSummary,
	type TelescopeExceptionListQuery,
	type TelescopeJsonValue,
	type TelescopeLogEntry,
	type TelescopeOptions,
	type TelescopeRequestListQuery,
	type TelescopeSpan,
	type TelescopeSqlListQuery,
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
// eslint-disable-next-line @darraghor/nestjs-typed/injectable-should-be-provided -- Registered in TelescopeModule.register()'s dynamic providers; the typed plugin only scans static @Module decorators.
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
		const [requests, queries, exceptions, dumps] = await Promise.all([
			this.prisma.telescopeRequest.findMany({ orderBy: { createdAt: "desc" }, take: this.options.maxRequests }),
			this.prisma.telescopeQuery.findMany({ orderBy: { createdAt: "desc" }, take: this.options.maxRequests * 4 }),
			this.prisma.telescopeException.findMany({ orderBy: { createdAt: "desc" }, take: this.options.maxRequests }),
			this.prisma.telescopeDump.findMany({ orderBy: { createdAt: "desc" }, take: this.options.maxRequests }),
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
		// firstSeenAt; every repeat bumps occurrences + lastSeenAt).
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
