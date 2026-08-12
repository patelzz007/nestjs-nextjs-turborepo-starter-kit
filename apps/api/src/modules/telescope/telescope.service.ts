import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { nanoid } from "nanoid";
import { z } from "zod";

import {
	EmailLogEntrySchema,
	TelescopeDumpInputSchema,
	TelescopeExceptionListQuerySchema,
	TelescopeOverviewQuerySchema,
	TelescopeRangeSchema,
	TelescopeRequestListQuerySchema,
	TelescopeSqlListQuerySchema,
	type DumpEntry,
	type EmailLogEntry,
	type ExceptionLogEntry,
	type TelescopeExceptionListQuery,
	type TelescopeExceptionListResponse,
	type TelescopeOverview,
	type TelescopeOverviewQuery,
	type TelescopeRange,
	type TelescopeRequestDetailResponse,
	type TelescopeRequestListQuery,
	type TelescopeRequestListResponse,
	type TelescopeSqlListQuery,
	type TelescopeSqlListResponse,
} from "@workspace/shared";

import { PrismaService } from "../../prisma/prisma.service.js";

import { RequestSpanContext } from "./request-span-context.js";
import { TELESCOPE_STORE } from "./telescope.options.js";
import type { TelescopeStore } from "./telescope.store.js";

const RANGE_MS: Readonly<Record<TelescopeRange, number>> = {
	"15m": 15 * 60 * 1000,
	"1h": 60 * 60 * 1000,
	"6h": 6 * 60 * 60 * 1000,
	"24h": 24 * 60 * 60 * 1000,
};

/**
 * Parses a raw query-string object through a shared Zod schema (coerces
 * numbers). Invalid values fall back to the schema defaults rather than
 * 400ing — this is a dev tool; a bad filter must not block the dashboard.
 */
function parseQuery<T>(schema: z.ZodType<T>, raw: unknown): T {
	const parsed = schema.safeParse(raw);
	if (parsed.success) {
		return parsed.data;
	}
	const fallback = schema.safeParse({});
	if (fallback.success) {
		return fallback.data;
	}
	return schema.parse(raw);
}

/**
 * Read side of Telescope. All list/detail/overview reads go through the
 * `TelescopeStore` interface (memory today, Postgres later); the only Prisma
 * touch is the Mail tab, which reuses the existing `email_logs` table.
 */
@Injectable()
export class TelescopeService {
	public constructor(
		@Inject(TELESCOPE_STORE) private readonly store: TelescopeStore,
		private readonly prisma: PrismaService,
	) {}

	public async overview(rawQuery: unknown): Promise<TelescopeOverview> {
		const query: TelescopeOverviewQuery = parseQuery(TelescopeOverviewQuerySchema, rawQuery);
		const range: TelescopeRange = TelescopeRangeSchema.parse(query.range);
		const fromIso: string = new Date(Date.now() - RANGE_MS[range]).toISOString();

		const [stats, mailSent, mailDelivered] = await Promise.all([
			Promise.resolve(this.store.overviewStats(fromIso)),
			this.prisma.emailLog.count(),
			this.prisma.emailLog.count({ where: { status: "delivered" } }),
		]);

		return {
			range,
			requests: stats.requests,
			avgDurationMs: stats.avgDurationMs,
			p95DurationMs: stats.p95DurationMs,
			slowest: stats.slowest,
			errorCount: stats.errorCount,
			sqlCount: stats.sqlCount,
			slowSqlCount: stats.slowSqlCount,
			mailSent,
			mailDelivered,
			exceptionGroups: stats.exceptionGroups,
		};
	}

	public listRequests(rawQuery: unknown): TelescopeRequestListResponse {
		const query: TelescopeRequestListQuery = parseQuery(TelescopeRequestListQuerySchema, rawQuery);
		return this.store.listRequests(query);
	}

	public getRequestDetail(id: string): TelescopeRequestDetailResponse {
		const request = this.store.getRequest(id);
		if (request === undefined) {
			throw new NotFoundException({ message: `Telescope request ${id} not found.`, error: "TELESCOPE_REQUEST_NOT_FOUND" });
		}
		return {
			request,
			queries: this.store.listQueriesByCorrelationId(request.correlationId),
			dumps: this.store.listDumpsByCorrelationId(request.correlationId),
		};
	}

	public listSql(rawQuery: unknown): TelescopeSqlListResponse {
		const query: TelescopeSqlListQuery = parseQuery(TelescopeSqlListQuerySchema, rawQuery);
		return this.store.listQueries(query);
	}

	public listExceptions(rawQuery: unknown): TelescopeExceptionListResponse {
		const query: TelescopeExceptionListQuery = parseQuery(TelescopeExceptionListQuerySchema, rawQuery);
		return this.store.listExceptions(query);
	}

	public getException(id: string): ExceptionLogEntry {
		const entry = this.store.getException(id);
		if (entry === undefined) {
			throw new NotFoundException({ message: `Telescope exception ${id} not found.`, error: "TELESCOPE_EXCEPTION_NOT_FOUND" });
		}
		return entry;
	}

	public async listMail(): Promise<{ readonly logs: readonly EmailLogEntry[] }> {
		const rows = await this.prisma.emailLog.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
		const mapped = rows.map((row) => ({
			id: row.id,
			templateKey: row.templateKey,
			to: row.to,
			subject: row.subject,
			status: row.status,
			resendId: row.resendId ?? undefined,
			error: row.error ?? undefined,
			createdAt: row.createdAt.toISOString(),
			updatedAt: row.updatedAt.toISOString(),
		}));
		return { logs: EmailLogEntrySchema.array().parse(mapped) };
	}

	/** The `dd()` probe — records an arbitrary value under a name. */
	public pushDump(rawBody: unknown): { readonly id: string } {
		const input = TelescopeDumpInputSchema.parse(rawBody);
		const spanStore = RequestSpanContext.getStore();
		const entry: DumpEntry = {
			id: nanoid(),
			name: input.name,
			value: input.value,
			correlationId: spanStore !== undefined && spanStore.captured ? spanStore.correlationId : null,
			createdAt: new Date().toISOString(),
		};
		this.store.pushDump(entry);
		return { id: entry.id };
	}

	public storeMode(): string {
		return this.store.mode;
	}
}
