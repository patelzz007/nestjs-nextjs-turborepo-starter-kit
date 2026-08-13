import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { nanoid } from "nanoid";
import { z } from "zod";

import { type Observable } from "rxjs";

import { hostname } from "node:os";

import {
	EmailLogEntrySchema,
	TelescopeAlertSnoozeInputSchema,
	TelescopeCompareQuerySchema,
	TelescopeExceptionListQuerySchema,
	TelescopeExceptionStatusInputSchema,
	TelescopeJobsListQuerySchema,
	TelescopeLeaderboardQuerySchema,
	TelescopeLogsListQuerySchema,
	TelescopeOverviewQuerySchema,
	TelescopeRangeSchema,
	TelescopeRequestListQuerySchema,
	TelescopeScheduleRunInputSchema,
	TelescopeSearchQuerySchema,
	TelescopeSqlListQuerySchema,
	TelescopeTrendsQuerySchema,
	TelescopeUsersQuerySchema,
	type BufferedStreamEvent,
	type DumpEntry,
	type EmailLogEntry,
	type ExceptionLogEntry,
	type RequestLogEntry,
	type TelescopeAlertEntry,
	type TelescopeAlertsResponse,
	type TelescopeAlertSnoozeInput,
	type TelescopeAnnotation,
	type TelescopeAnnotationInput,
	type TelescopeCompareResponse,
	type TelescopeDiffField,
	type TelescopeDumpInput,
	type TelescopeEnvironment,
	type TelescopeExceptionListQuery,
	type TelescopeExceptionListResponse,
	type TelescopeExceptionStatusInput,
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
	type TelescopeRequestSqlResponse,
	type TelescopeScheduleLog,
	type TelescopeSchedulesResponse,
	type TelescopeSearchQuery,
	type TelescopeSearchResponse,
	type TelescopeSqlListQuery,
	type TelescopeSqlListResponse,
	type TelescopeStatus,
	type TelescopeTrendsQuery,
	type TelescopeTrendsResponse,
	type TelescopeUserSummary,
	type TelescopeUsersQuery,
	type TelescopeUsersResponse,
	type TelescopeWebhookDeliveriesResponse,
	type TelescopeWebhookDelivery,
} from "@workspace/shared";
import { PrismaService } from "../../prisma/prisma.service.js";

import { detectN1Warnings } from "./n1-detector.js";
import { RequestSpanContext } from "./request-span-context.js";
import { TelescopeAlertService } from "./telescope-alert.service.js";
import { TelescopeEventBus } from "./telescope-event-bus.js";
import { TelescopeJobRunner } from "./telescope-job-runner.js";
import { TELESCOPE_OPTIONS, TELESCOPE_STORE } from "./telescope.options.js";
import { TelescopeSchedulerService } from "./telescope-scheduler.js";
import type { ListResult, TelescopeStore } from "./telescope.store.js";

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
		private readonly jobRunner: TelescopeJobRunner,
		private readonly schedulerService: TelescopeSchedulerService,
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
		// Improvement 19 — capture-pipeline health (store snapshot + options).
		const health = this.store.health();

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
			n1RequestCount: stats.n1RequestCount,
			piiRequestCount: stats.piiRequestCount,
			traffic: stats.traffic,
			statusCounts: stats.statusCounts,
			// Feature 8 — environment tag of the capturing process.
			environment: this.environment(),
			// Improvement 19 — buffer usage + mode + retention window.
			health: {
				mode: health.mode,
				enabled: this.options.enabled,
				bufferRequests: health.bufferRequests,
				bufferCap: health.bufferCap,
				retentionMinutes: this.options.retentionMinutes,
			},
		};
	}

	public async listRequests(rawQuery: RawQuery): Promise<TelescopeRequestListResponse> {
		const query: TelescopeRequestListQuery = parseQuery(TelescopeRequestListQuerySchema, rawQuery);
		const list: TelescopeRequestListResponse = this.store.listRequests(query);
		return { ...list, items: await this.enrichWithEmails(list.items) };
	}

	public async getRequestDetail(id: string): Promise<TelescopeRequestDetailResponse> {
		const request = this.store.getRequest(id);
		if (request === undefined) {
			throw new NotFoundException({ message: `Telescope request ${id} not found.`, error: "TELESCOPE_REQUEST_NOT_FOUND" });
		}
		// Improvement 3 — SQL/dumps/N+1 moved to the lazy `requestSql` endpoint.
		// Improvement 12 — neighbor ids for prev/next navigation.
		// Improvement 18 — nearest earlier request with the same route for compare.
		const previous: RequestLogEntry | undefined = this.store.findPreviousRequest(id);
		const enriched: RequestLogEntry = await this.enrichRequestWithEmail(request);
		return {
			request: enriched,
			// Feature 14 — star/comment annotation (null until first set).
			annotation: this.store.getAnnotation(id),
			adjacent: this.store.getAdjacentRequestIds(id),
			previousRequestId: previous?.id ?? null,
		};
	}

	/** Improvement 3 — the lazy SQL/dumps/N+1 payload for a request detail. */
	public requestSql(id: string): TelescopeRequestSqlResponse {
		const request = this.store.getRequest(id);
		if (request === undefined) {
			throw new NotFoundException({ message: `Telescope request ${id} not found.`, error: "TELESCOPE_REQUEST_NOT_FOUND" });
		}
		const queries = this.store.listQueriesByCorrelationId(request.correlationId);
		return {
			queries,
			dumps: this.store.listDumpsByCorrelationId(request.correlationId),
			// Improvement 7: N+1 warnings computed from this request's queries.
			n1Warnings: detectN1Warnings(queries),
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

	/** The SSE observable — replays buffered frames past `afterSeq`, then live. */
	public stream(afterSeq: number): Observable<BufferedStreamEvent> {
		return this.eventBus.subscribe(afterSeq);
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

	/** Improvement 5 — acknowledge (resolve) an alert by id. */
	public acknowledgeAlert(id: string): TelescopeAlertEntry {
		const updated: TelescopeAlertEntry | null = this.alertService.acknowledge(id);
		if (updated === null) {
			throw new NotFoundException({ message: `Telescope alert ${id} not found.`, error: "TELESCOPE_ALERT_NOT_FOUND" });
		}
		return updated;
	}

	/** Improvement 5 — snooze an alert by id until now + N minutes. */
	public snoozeAlert(id: string, rawBody: Record<string, string | number | undefined>): TelescopeAlertEntry {
		const input: TelescopeAlertSnoozeInput = TelescopeAlertSnoozeInputSchema.parse(rawBody);
		const updated: TelescopeAlertEntry | null = this.alertService.snooze(id, input.minutes);
		if (updated === null) {
			throw new NotFoundException({ message: `Telescope alert ${id} not found.`, error: "TELESCOPE_ALERT_NOT_FOUND" });
		}
		return updated;
	}

	/** Improvement 6 — set the triage status of an exception group. */
	public setExceptionStatus(id: string, rawBody: Record<string, string | undefined>): ExceptionLogEntry {
		const input: TelescopeExceptionStatusInput = TelescopeExceptionStatusInputSchema.parse(rawBody);
		const entry: ExceptionLogEntry = this.getException(id);
		this.store.setExceptionStatus(entry.errorGroup, input.status);
		return { ...entry, status: input.status };
	}

	/** Improvement 17 — re-run a failed job from the UI (new entry). */
	public async retryJob(id: string): Promise<TelescopeJobLogEntry> {
		const retried: TelescopeJobLogEntry | null = await this.jobRunner.retry(id);
		if (retried === null) {
			throw new NotFoundException({
				message: `Telescope job ${id} not found or not retryable (its fn is not registered).`,
				error: "TELESCOPE_JOB_NOT_RETRYABLE",
			});
		}
		return retried;
	}

	/** Feature 18 — recent threshold alerts. */
	public listAlerts(): TelescopeAlertsResponse {
		const items: readonly TelescopeAlertEntry[] = this.alertService.listAlerts(50);
		return { items };
	}

	/** Feature 13 — webhook delivery records for the alerts panel. */
	public listWebhookDeliveries(): TelescopeWebhookDeliveriesResponse {
		const items: readonly TelescopeWebhookDelivery[] = this.store.listWebhookDeliveries(50);
		return { items };
	}

	/**
	 * Feature 1 — global free-text search across every captured surface. The
	 * store matches method/path/body/userId text; this layer additionally
	 * resolves an email fragment (e.g. "alice@") against the `users` table and
	 * ORs in those users' requests, so searching by email works too.
	 */
	public async search(rawQuery: RawQuery): Promise<TelescopeSearchResponse> {
		const query: TelescopeSearchQuery = parseQuery(TelescopeSearchQuerySchema, rawQuery);
		const emailUserIds: ReadonlySet<string> = await this.resolveEmailUserIds(query.q.trim());
		const result: TelescopeSearchResponse = this.store.search(query, emailUserIds);
		// Attach emails to the matched request rows (the store scan is DB-free).
		return { ...result, requests: await this.enrichWithEmails(result.requests) };
	}

	/** Attach each summary's resolved user email (null for anonymous/unknown ids). */
	private async enrichWithEmails<T extends { readonly userId: string | null; readonly userEmail: string | null }>(items: readonly T[]): Promise<readonly T[]> {
		const ids: readonly string[] = items.map((item: T): string => item.userId ?? "").filter((value: string): boolean => value.length > 0);
		const emailById: ReadonlyMap<string, string> = await this.resolveEmails(ids);
		return items.map((item: T): T => {
			if (item.userId === null) {
				return item;
			}
			const email: string | null = emailById.get(item.userId) ?? null;
			return email === null ? item : { ...item, userEmail: email };
		});
	}

	/** Resolve one request's userId → email (spread over the detail payload). */
	private async enrichRequestWithEmail(request: RequestLogEntry): Promise<RequestLogEntry> {
		const [enriched]: readonly RequestLogEntry[] = await this.enrichWithEmails([request]);
		return enriched;
	}

	/** Batch userId → email lookup (empty set = no lookups, degrades to raw ids). */
	private async resolveEmails(ids: readonly string[]): Promise<ReadonlyMap<string, string>> {
		if (ids.length === 0) {
			return new Map<string, string>();
		}
		try {
			const rows: readonly { readonly id: string; readonly email: string }[] = await this.prisma.user.findMany({
				where: { id: { in: [...ids] } },
				select: { id: true, email: true },
			});
			return new Map(rows.map((row: { readonly id: string; readonly email: string }): [string, string] => [row.id, row.email]));
		} catch {
			return new Map<string, string>();
		}
	}

	/** Users whose email contains the fragment → their id set (empty for blank/unknown). */
	private async resolveEmailUserIds(fragment: string): Promise<ReadonlySet<string>> {
		const trimmed: string = fragment.trim().toLowerCase();
		if (trimmed.length === 0) {
			return new Set<string>();
		}
		try {
			const rows: readonly { readonly id: string }[] = await this.prisma.user.findMany({
				where: { email: { contains: trimmed, mode: "insensitive" } },
				select: { id: true },
				take: 25,
			});
			return new Set(rows.map((row: { readonly id: string }): string => row.id));
		} catch {
			// Telescope must never break because the users table is unreachable —
			// email search degrades to text-only matching.
			return new Set<string>();
		}
	}

	/**
	 * Feature 3 — per-user request aggregation. The store groups by `userId`
	 * (a JWT `sub`, opaque); this layer resolves each id to the user's email
	 * from the `users` table so the UI shows a friendly identity instead of a
	 * raw UUID. Unknown/deleted ids keep `email: null`.
	 */
	public async listUsers(rawQuery: RawQuery): Promise<TelescopeUsersResponse> {
		const query: TelescopeUsersQuery = parseQuery(TelescopeUsersQuerySchema, rawQuery);
		const list: ListResult<TelescopeUserSummary> = this.store.listUsers(query);
		const ids: readonly string[] = list.items.map((item: TelescopeUserSummary): string => item.userId);
		const emailById = new Map<string, string>();
		if (ids.length > 0) {
			try {
				const rows: readonly { readonly id: string; readonly email: string }[] = await this.prisma.user.findMany({
					where: { id: { in: [...ids] } },
					select: { id: true, email: true },
				});
				for (const row of rows) {
					emailById.set(row.id, row.email);
				}
			} catch {
				// Telescope must never break because the users table is unreachable
				// (e.g. Postgres down) — the list degrades to raw ids.
			}
		}
		return {
			items: list.items.map((item: TelescopeUserSummary): TelescopeUserSummary => ({ ...item, email: emailById.get(item.userId) ?? null })),
			total: list.total,
			page: list.page,
			pageSize: list.pageSize,
		};
	}

	/** Feature 12 — run a registered schedule on demand (the "Run now" button). */
	public async runSchedule(name: string, rawBody: Record<string, string | undefined> | undefined): Promise<TelescopeScheduleLog> {
		// Validate the optional trigger label — the body is tolerant (an empty
		// POST body is `undefined` at runtime), defaults apply.
		TelescopeScheduleRunInputSchema.parse(rawBody ?? {});
		const updated: TelescopeScheduleLog | undefined = await this.schedulerService.runNow(name);
		if (updated === undefined) {
			throw new NotFoundException({ message: `Telescope schedule ${name} not registered.`, error: "TELESCOPE_SCHEDULE_NOT_FOUND" });
		}
		return updated;
	}

	/**
	 * Feature 8 — manual retention pruning. Prunes entries older than the
	 * configured retention window and returns how many were removed. Passing
	 * `?force=true` drops EVERYTHING older than one minute (the "Clear all
	 * history" escape hatch behind the health card).
	 */
	public prune(rawQuery: RawQuery): { readonly removed: number } {
		const force: boolean = rawQuery.force === "true";
		const minutes: number = force ? 1 : this.options.retentionMinutes;
		return { removed: this.store.pruneRetention(minutes) };
	}

	/** Feature 8 — empty every buffer (requests, SQL, exceptions, jobs, …). */
	public clearAll(): { readonly cleared: true } {
		this.store.clear();
		return { cleared: true };
	}

	/** Feature 9 — the fully-resolved capture config + pipeline health snapshot. */
	public status(): TelescopeStatus {
		const health = this.store.health();
		return {
			enabled: this.options.enabled,
			storage: this.options.storage,
			bufferRequests: health.bufferRequests,
			bufferCap: health.bufferCap,
			retentionMinutes: this.options.retentionMinutes,
			maxRequests: this.options.maxRequests,
			maxBodyChars: this.options.maxBodyChars,
			maxSpansPerRequest: this.options.maxSpansPerRequest,
			maxConsoleEntriesPerRequest: this.options.maxConsoleEntriesPerRequest,
			piiMode: this.options.piiMode,
			captureBody: this.options.captureBody,
			captureHeaders: this.options.captureHeaders,
			ignorePaths: this.options.ignorePaths,
			redactPaths: this.options.redactPaths,
			capturePaths: this.options.capturePaths ?? [],
			sampleRateDev: this.options.sampling.dev,
			sampleRateProd: this.options.sampling.prod,
			alertWebhookUrl: this.options.alertWebhookUrl ?? null,
			alertDurationMs: this.options.alertDurationMs,
			alertWindowMinutes: this.options.alertWindowMinutes,
			environment: this.environment(),
		};
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
