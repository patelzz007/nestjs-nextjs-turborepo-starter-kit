import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { nanoid } from "nanoid";
import { z } from "zod";

import { Subject } from "rxjs";

import { hostname } from "node:os";

import {
	EmailLogEntrySchema,
	TelescopeCompareQuerySchema,
	TelescopeExceptionListQuerySchema,
	TelescopeJobsListQuerySchema,
	TelescopeLeaderboardQuerySchema,
	TelescopeLogsListQuerySchema,
	TelescopeOverviewQuerySchema,
	TelescopeRangeSchema,
	TelescopeRequestListQuerySchema,
	TelescopeSqlListQuerySchema,
	TelescopeTrendsQuerySchema,
	type DumpEntry,
	type EmailLogEntry,
	type ExceptionLogEntry,
	type RequestLogEntry,
	type TelescopeAlertEntry,
	type TelescopeAlertsResponse,
	type TelescopeAnnotation,
	type TelescopeAnnotationInput,
	type TelescopeCompareResponse,
	type TelescopeDiffField,
	type TelescopeDumpInput,
	type TelescopeEnvironment,
	type TelescopeExceptionListQuery,
	type TelescopeExceptionListResponse,
	type TelescopeJobLogEntry,
	type TelescopeJobsListQuery,
	type TelescopeJobsListResponse,
	type TelescopeLeaderboardEntry,
	type TelescopeLeaderboardQuery,
	type TelescopeLeaderboardResponse,
	type TelescopeOptions,
	type TelescopeLogsListQuery,
	type TelescopeLogsListResponse,
	type TelescopeOverview,
	type TelescopeOverviewQuery,
	type TelescopeRange,
	type TelescopeReplayInput,
	type TelescopeReplayResponse,
	type TelescopeRequestDetailResponse,
	type TelescopeRequestListQuery,
	type TelescopeRequestListResponse,
	type TelescopeScheduleLog,
	type TelescopeSchedulesResponse,
	type TelescopeSqlListQuery,
	type TelescopeSqlListResponse,
	type TelescopeStreamEvent,
	type TelescopeTrendsQuery,
	type TelescopeTrendsResponse,
} from "@workspace/shared";

import { PrismaService } from "../../prisma/prisma.service.js";

import { detectN1Warnings } from "./n1-detector.js";
import { RequestSpanContext } from "./request-span-context.js";
import { TelescopeAlertService } from "./telescope-alert.service.js";
import { TelescopeEventBus } from "./telescope-event-bus.js";
import { TELESCOPE_OPTIONS, TELESCOPE_STORE } from "./telescope.options.js";
import type { TelescopeStore } from "./telescope.store.js";

const RANGE_MS: Readonly<Record<TelescopeRange, number>> = {
	"15m": 15 * 60 * 1000,
	"1h": 60 * 60 * 1000,
	"6h": 6 * 60 * 60 * 1000,
	"24h": 24 * 60 * 60 * 1000,
};

/** Raw Express query-string object as Nest delivers it to `@Query()`. */
type RawQuery = Record<string, string | string[] | undefined>;

/**
 * Parses a raw query-string object through a shared Zod schema (coerces
 * numbers). Invalid values fall back to the schema defaults rather than
 * 400ing — this is a dev tool; a bad filter must not block the dashboard.
 */
function parseQuery<T>(schema: z.ZodType<T>, raw: RawQuery): T {
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
// eslint-disable-next-line @darraghor/nestjs-typed/injectable-should-be-provided -- Registered in TelescopeModule.register()'s dynamic providers; the typed plugin only scans static @Module decorators.
export class TelescopeService {
	public constructor(
		@Inject(TELESCOPE_STORE) private readonly store: TelescopeStore,
		@Inject(TELESCOPE_OPTIONS) private readonly options: TelescopeOptions,
		private readonly prisma: PrismaService,
		private readonly eventBus: TelescopeEventBus,
		private readonly alertService: TelescopeAlertService,
	) {}

	public async overview(rawQuery: RawQuery): Promise<TelescopeOverview> {
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
			traffic: stats.traffic,
			statusCounts: stats.statusCounts,
			// Feature 8 — environment tag of the capturing process.
			environment: this.environment(),
		};
	}

	public listRequests(rawQuery: RawQuery): TelescopeRequestListResponse {
		const query: TelescopeRequestListQuery = parseQuery(TelescopeRequestListQuerySchema, rawQuery);
		return this.store.listRequests(query);
	}

	public getRequestDetail(id: string): TelescopeRequestDetailResponse {
		const request = this.store.getRequest(id);
		if (request === undefined) {
			throw new NotFoundException({ message: `Telescope request ${id} not found.`, error: "TELESCOPE_REQUEST_NOT_FOUND" });
		}
		const queries = this.store.listQueriesByCorrelationId(request.correlationId);
		return {
			request,
			queries,
			dumps: this.store.listDumpsByCorrelationId(request.correlationId),
			// Improvement 7: N+1 warnings computed from this request's queries.
			n1Warnings: detectN1Warnings(queries),
			// Feature 14 — star/comment annotation (null until first set).
			annotation: this.store.getAnnotation(id),
		};
	}

	public listSql(rawQuery: RawQuery): TelescopeSqlListResponse {
		const query: TelescopeSqlListQuery = parseQuery(TelescopeSqlListQuerySchema, rawQuery);
		return this.store.listQueries(query);
	}

	public listExceptions(rawQuery: RawQuery): TelescopeExceptionListResponse {
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

	/**
	 * The `dd()` probe — records an arbitrary value under a name. The body is
	 * validated at the HTTP boundary by `ZodValidationPipe(TelescopeDumpInputSchema)`
	 * (repo convention, see root-users.controller.ts), so the typed input arrives
	 * here already parsed.
	 */
	public pushDump(input: TelescopeDumpInput): { readonly id: string } {
		const spanStore = RequestSpanContext.getStore();
		const entry: DumpEntry = {
			id: nanoid(),
			name: input.name,
			value: input.value,
			correlationId: spanStore?.captured === true ? spanStore.correlationId : null,
			createdAt: new Date().toISOString(),
		};
		this.store.pushDump(entry);
		return { id: entry.id };
	}

	/**
	 * Improvement 6 — request diffing: two full entries plus a scalar diff
	 * table (method/path/status/duration/user/correlation/timing). `same`
	 * flags identical values so the UI can fade unchanged rows.
	 */
	public compare(rawQuery: RawQuery): TelescopeCompareResponse {
		const query = TelescopeCompareQuerySchema.parse({ a: rawQuery.a ?? "", b: rawQuery.b ?? "" });

		const requestA: RequestLogEntry = this.requireRequest(query.a);
		const requestB: RequestLogEntry = this.requireRequest(query.b);

		const field = (name: string, valueA: string | number | null, valueB: string | number | null): TelescopeDiffField => ({
			field: name,
			valueA: valueA !== null ? String(valueA) : null,
			valueB: valueB !== null ? String(valueB) : null,
			same: String(valueA) === String(valueB),
		});

		const diffs: readonly TelescopeDiffField[] = [
			field("method", requestA.method, requestB.method),
			field("path", requestA.path, requestB.path),
			field("status", requestA.statusCode, requestB.statusCode),
			field("duration (ms)", requestA.durationMs, requestB.durationMs),
			field("user", requestA.userId, requestB.userId),
			field("correlation", requestA.correlationId, requestB.correlationId),
			field("created at", requestA.createdAt, requestB.createdAt),
		];

		// Feature 15 — side-by-side diff: each side's SQL for the visual comparison.
		return {
			a: requestA,
			b: requestB,
			diffs,
			queriesA: this.store.listQueriesByCorrelationId(requestA.correlationId),
			queriesB: this.store.listQueriesByCorrelationId(requestB.correlationId),
		};
	}

	/** The SSE subject — the controller maps it into `MessageEvent` frames. */
	public stream(): Subject<TelescopeStreamEvent> {
		return this.eventBus.subscribe();
	}

	public storeMode(): string {
		return this.store.mode;
	}

	/** Feature 12 — slow-endpoint leaderboard over the range. */
	public leaderboard(rawQuery: RawQuery): TelescopeLeaderboardResponse {
		const query: TelescopeLeaderboardQuery = parseQuery(TelescopeLeaderboardQuerySchema, rawQuery);
		const range: TelescopeRange = TelescopeRangeSchema.parse(query.range);
		const fromIso: string = new Date(Date.now() - RANGE_MS[range]).toISOString();
		const entries: readonly TelescopeLeaderboardEntry[] = this.store.leaderboard(fromIso, 10);
		return { range, entries };
	}

	/** Feature 13 — hourly trend buckets for the error-rate chart. */
	public trends(rawQuery: RawQuery): TelescopeTrendsResponse {
		const query: TelescopeTrendsQuery = parseQuery(TelescopeTrendsQuerySchema, rawQuery);
		const range: TelescopeRange = TelescopeRangeSchema.parse(query.range);
		const fromIso: string = new Date(Date.now() - RANGE_MS[range]).toISOString();
		// Hourly buckets: 6h → 6, 24h → 24 (15m/1h fall back to 12 for readability).
		const bucketCount: number = range === "15m" ? 12 : range === "1h" ? 12 : range === "6h" ? 6 : 24;
		const points = this.store.trends(fromIso, bucketCount);
		return { range, points };
	}

	/** Feature 3 — jobs. */
	public listJobs(rawQuery: RawQuery): TelescopeJobsListResponse {
		const query: TelescopeJobsListQuery = parseQuery(TelescopeJobsListQuerySchema, rawQuery);
		return this.store.listJobs(query);
	}

	public getJob(id: string): TelescopeJobLogEntry {
		const job = this.store.getJob(id);
		if (job === undefined) {
			throw new NotFoundException({ message: `Telescope job ${id} not found.`, error: "TELESCOPE_JOB_NOT_FOUND" });
		}
		return job;
	}

	/** Feature 4 — schedules. */
	public listSchedules(): TelescopeSchedulesResponse {
		const items: readonly TelescopeScheduleLog[] = this.store.listSchedules();
		return { items };
	}

	/** Feature 14 — star/comment a request. */
	public setAnnotation(requestId: string, input: TelescopeAnnotationInput): TelescopeAnnotation {
		this.requireRequest(requestId);
		const current: TelescopeAnnotation | null = this.store.getAnnotation(requestId);
		const annotation: TelescopeAnnotation = {
			starred: input.starred ?? current?.starred ?? false,
			comment: input.comment ?? current?.comment ?? "",
			updatedAt: new Date().toISOString(),
		};
		this.store.setAnnotation(requestId, annotation);
		return annotation;
	}

	/** Feature 20 — logs browser. */
	public listLogs(rawQuery: RawQuery): TelescopeLogsListResponse {
		const query: TelescopeLogsListQuery = parseQuery(TelescopeLogsListQuerySchema, rawQuery);
		return this.store.listLogs(query);
	}

	/** Feature 18 — recent threshold alerts. */
	public listAlerts(): TelescopeAlertsResponse {
		const items: readonly TelescopeAlertEntry[] = this.alertService.listAlerts(50);
		return { items };
	}

	/** Feature 7 — replay a captured request against a configured target. */
	public async replay(requestId: string, input: TelescopeReplayInput): Promise<TelescopeReplayResponse> {
		const request: RequestLogEntry = this.requireRequest(requestId);
		const targets: Record<string, string> = { local: this.localBaseUrl(), ...this.options.replayTargets };
		const baseUrl: string = targets[input.target];
		if (!Object.prototype.hasOwnProperty.call(targets, input.target)) {
			throw new NotFoundException({
				message: `Unknown replay target "${input.target}". Configured targets: ${Object.keys(targets).join(", ")}.`,
				error: "TELESCOPE_REPLAY_TARGET_UNKNOWN",
			});
		}

		const url: string = request.queryString !== null ? `${baseUrl}${request.path}?${request.queryString}` : `${baseUrl}${request.path}`;
		const headers: Record<string, string> = {};
		if (request.requestHeaders !== null) {
			for (const [key, value] of Object.entries(request.requestHeaders)) {
				// Never forward credentials on a replay — the captured whitelist
				// excludes them, but re-check here as defense in depth.
				if (key.toLowerCase() === "authorization" || key.toLowerCase() === "cookie" || key.toLowerCase() === "set-cookie") {
					continue;
				}
				headers[key] = value;
			}
		}

		const start: number = performance.now();
		try {
			const response: Response = await fetch(url, {
				method: request.method,
				headers,
				body: request.method === "GET" || request.method === "HEAD" ? undefined : JSON.stringify(request.requestBody),
				signal: AbortSignal.timeout(10_000),
			});
			const rawText: string = await response.text();
			return {
				ok: response.ok,
				status: response.status,
				statusText: response.statusText,
				durationMs: Math.round(performance.now() - start),
				responsePreview: rawText.length > 500 ? `${rawText.slice(0, 497)}…` : rawText,
			};
		} catch (error) {
			return {
				ok: false,
				status: null,
				statusText: "fetch failed",
				durationMs: Math.round(performance.now() - start),
				responsePreview: error instanceof Error ? error.message.slice(0, 500) : "replay failed",
			};
		}
	}

	/** Feature 8 — the environment tag used across overview + entries. */
	private environment(): TelescopeEnvironment {
		return {
			nodeEnv: process.env.NODE_ENV ?? "development",
			host: hostname(),
		};
	}

	/** Feature 7 — the API's own origin is always the `local` replay target. */
	private localBaseUrl(): string {
		return process.env.TELESCOPE_LOCAL_BASE_URL ?? `http://localhost:${process.env.PORT ?? "8080"}`;
	}

	private requireRequest(id: string): RequestLogEntry {
		const request: RequestLogEntry | undefined = this.store.getRequest(id);
		if (request === undefined) {
			throw new NotFoundException({ message: `Telescope request ${id} not found.`, error: "TELESCOPE_REQUEST_NOT_FOUND" });
		}
		return request;
	}
}
