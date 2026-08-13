import type {
	DumpEntry,
	ExceptionLogEntry,
	QueryLogEntry,
	RequestLogEntry,
	RequestLogSummary,
	TelescopeAlertEntry,
	TelescopeAlertStatus,
	TelescopeAnnotation,
	TelescopeExceptionListQuery,
	TelescopeExceptionStatus,
	TelescopeJobLogEntry,
	TelescopeJobsListQuery,
	TelescopeLeaderboardEntry,
	TelescopeLogRow,
	TelescopeLogsListQuery,
	TelescopeRange,
	TelescopeRequestListQuery,
	TelescopeScheduleLog,
	TelescopeSearchExceptionMatch,
	TelescopeSearchLogMatch,
	TelescopeSearchQuery,
	TelescopeSearchRequestMatch,
	TelescopeSearchResponse,
	TelescopeSearchSqlMatch,
	TelescopeSqlListQuery,
	TelescopeStatusCounts,
	TelescopeStorage,
	TelescopeTrafficPoint,
	TelescopeTrendPoint,
	TelescopeUserSummary,
	TelescopeUsersQuery,
	TelescopeWebhookDelivery,
} from "@workspace/shared";

import { detectN1Warnings } from "./n1-detector.js";

// ── Filter / result shapes ─────────────────────────────────────────────────

export interface ListResult<T> {
	readonly items: readonly T[];
	readonly total: number;
	readonly page: number;
	readonly pageSize: number;
}

/** Sync-only overview stats — mail counts are merged in the service (Prisma). */
export interface OverviewStats {
	readonly requests: number;
	readonly avgDurationMs: number;
	readonly p95DurationMs: number;
	readonly slowest: RequestLogSummary | null;
	readonly errorCount: number;
	readonly sqlCount: number;
	readonly slowSqlCount: number;
	readonly exceptionGroups: number;
	/** Requests with ≥1 N+1 warning in range (improvement 4). */
	readonly n1RequestCount: number;
	/** Requests with PII flags in range (improvement 15). */
	readonly piiRequestCount: number;
	/** Request volume over the range (24 fixed buckets) — powers the sparkline. */
	readonly traffic: readonly TelescopeTrafficPoint[];
	/** Status-class counts over the range. */
	readonly statusCounts: TelescopeStatusCounts;
}

/** Capture-pipeline health snapshot (improvement 19) — options merge in the service. */
export interface StoreHealth {
	readonly mode: TelescopeStorage;
	readonly bufferRequests: number;
	readonly bufferCap: number;
}

/**
 * The read/write surface the rest of the system depends on. The API layer and
 * the admin UI cannot tell whether the backing store is memory or Postgres —
 * this interface is what makes `storage: "postgres"` a drop-in later
 * (docs/telescope.md §6).
 */
export interface TelescopeStore {
	readonly mode: string;
	pushRequest(entry: RequestLogEntry): void;
	pushQuery(entry: QueryLogEntry): void;
	pushException(entry: ExceptionLogEntry): void;
	pushDump(entry: DumpEntry): void;
	listRequests(query: TelescopeRequestListQuery): ListResult<RequestLogSummary>;
	getRequest(id: string): RequestLogEntry | undefined;
	listQueries(query: TelescopeSqlListQuery): ListResult<QueryLogEntry>;
	listQueriesByCorrelationId(correlationId: string): readonly QueryLogEntry[];
	listExceptions(query: TelescopeExceptionListQuery): ListResult<ExceptionLogEntry>;
	getException(id: string): ExceptionLogEntry | undefined;
	listDumpsByCorrelationId(correlationId: string): readonly DumpEntry[];
	overviewStats(fromIso: string): OverviewStats;
	// Feature 12 — slow-endpoint leaderboard over the range.
	leaderboard(fromIso: string, limit: number): readonly TelescopeLeaderboardEntry[];
	// Feature 13 — hourly trend buckets (longer error-rate windows).
	trends(fromIso: string, bucketCount: number): readonly TelescopeTrendPoint[];
	// Feature 3 — jobs.
	pushJob(entry: TelescopeJobLogEntry): void;
	listJobs(query: TelescopeJobsListQuery): ListResult<TelescopeJobLogEntry>;
	getJob(id: string): TelescopeJobLogEntry | undefined;
	// Feature 4 — schedules.
	upsertSchedule(entry: TelescopeScheduleLog): void;
	listSchedules(): readonly TelescopeScheduleLog[];
	// Feature 14 — per-request annotations (star/comment).
	setAnnotation(requestId: string, annotation: TelescopeAnnotation | null): void;
	getAnnotation(requestId: string): TelescopeAnnotation | null;
	// Feature 20 — logs browser (console output flattened across requests).
	listLogs(query: TelescopeLogsListQuery): ListResult<TelescopeLogRow>;
	// Feature 18 — threshold alerts (memory-scoped; survives via the alert service).
	pushAlert(entry: TelescopeAlertEntry): void;
	listAlerts(limit: number): readonly TelescopeAlertEntry[];
	// Feature 13 — webhook delivery records for the alert service.
	pushWebhookDelivery(entry: TelescopeWebhookDelivery): void;
	listWebhookDeliveries(limit: number): readonly TelescopeWebhookDelivery[];
	// Feature 1 — global search across requests/sql/exceptions/logs. `emailUserIds`
	// (resolved server-side by the service) ORs in requests whose authenticated
	// user's email matches the query, so a fragment like "alice@" finds her traffic.
	search(query: TelescopeSearchQuery, emailUserIds?: ReadonlySet<string>): TelescopeSearchResponse;
	// Feature 3 — per-user request aggregation.
	listUsers(query: TelescopeUsersQuery): ListResult<TelescopeUserSummary>;
	/** Improvement 5 — ack or snooze an alert by id. */
	setAlertStatus(id: string, status: TelescopeAlertStatus, snoozedUntil: string | null): void;
	/** Improvement 6 — set the triage status of an exception group. */
	setExceptionStatus(errorGroup: string, status: TelescopeExceptionStatus): void;
	/** Improvement 12 — neighbor ids around a request in capture order. */
	getAdjacentRequestIds(id: string): { readonly prevId: string | null; readonly nextId: string | null };
	/** Improvement 18 — nearest earlier request with the same method+path. */
	findPreviousRequest(id: string): RequestLogEntry | undefined;
	/** Improvement 19 — capture-pipeline health snapshot. */
	health(): StoreHealth;
	/** Drops entries older than `retentionMinutes`; returns how many were removed. */
	pruneRetention(retentionMinutes: number): number;
	clear(): void;
}

// ── Time helpers ───────────────────────────────────────────────────────────

function parseIso(value: string): number {
	const ms: number = Date.parse(value);
	return Number.isFinite(ms) ? ms : 0;
}

function isAfter(iso: string, fromIso: string | undefined): boolean {
	return fromIso === undefined || parseIso(iso) >= parseIso(fromIso);
}

function isBefore(iso: string, toIso: string | undefined): boolean {
	return toIso === undefined || parseIso(iso) <= parseIso(toIso);
}

/** Range → window start (ms before now) for the users aggregation (feature 3). */
function rangeToWindowStartMs(range: TelescopeRange): number {
	return Date.now() - (range === "15m" ? 15 * 60 * 1000 : range === "1h" ? 60 * 60 * 1000 : range === "6h" ? 6 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000);
}

// ── Pure filter predicates (unit-testable in isolation) ────────────────────

function matchesRequest(request: RequestLogEntry, query: TelescopeRequestListQuery): boolean {
	if (query.method !== undefined && request.method.toLowerCase() !== query.method.toLowerCase()) {
		return false;
	}
	if (query.path !== undefined && !request.path.toLowerCase().includes(query.path.toLowerCase())) {
		return false;
	}
	if (query.status !== undefined && request.statusCode !== query.status) {
		return false;
	}
	if (query.minDurationMs !== undefined && request.durationMs < query.minDurationMs) {
		return false;
	}
	if (query.userId !== undefined && request.userId !== query.userId) {
		return false;
	}
	if (query.correlationId !== undefined && request.correlationId !== query.correlationId) {
		return false;
	}
	// Feature 8 — environment tag filter (nodeEnv, e.g. "development"/"production").
	if (query.env !== undefined && request.environment?.nodeEnv !== query.env) {
		return false;
	}
	// Feature 2 — free-text search over path, query-string, sanitized body text
	// and the authenticated user id (so a UUID paste finds that user's traffic).
	if (query.q !== undefined && query.q.length > 0) {
		const needle: string = query.q.toLowerCase();
		const haystack: string = `${request.method} ${request.path} ${request.queryString ?? ""} ${requestBodyText(request)} ${request.userId ?? ""}`.toLowerCase();
		if (!haystack.includes(needle)) {
			return false;
		}
	}
	return isAfter(request.createdAt, query.from) && isBefore(request.createdAt, query.to);
}

/** Flattens the sanitized request body into searchable text (feature 2). */
function requestBodyText(request: RequestLogEntry): string {
	if (request.requestBody === null) {
		return "";
	}
	try {
		return typeof request.requestBody === "string" ? request.requestBody : JSON.stringify(request.requestBody);
	} catch {
		return "";
	}
}

function matchesQuery(entry: QueryLogEntry, query: TelescopeSqlListQuery): boolean {
	if (query.model !== undefined && entry.model !== query.model) {
		return false;
	}
	if (query.operation !== undefined && entry.operation !== query.operation) {
		return false;
	}
	if (query.minDurationMs !== undefined && entry.durationMs < query.minDurationMs) {
		return false;
	}
	if (query.correlationId !== undefined && entry.correlationId !== query.correlationId) {
		return false;
	}
	return isAfter(entry.createdAt, query.from) && isBefore(entry.createdAt, query.to);
}

function matchesException(entry: ExceptionLogEntry, query: TelescopeExceptionListQuery): boolean {
	if (query.errorGroup !== undefined && entry.errorGroup !== query.errorGroup) {
		return false;
	}
	if (query.statusCode !== undefined && entry.statusCode !== query.statusCode) {
		return false;
	}
	if (query.status !== undefined && entry.status !== query.status) {
		return false;
	}
	return isAfter(entry.createdAt, query.from) && isBefore(entry.createdAt, query.to);
}

function sortRequestsByQuery(items: RequestLogSummary[], query: TelescopeRequestListQuery): void {
	items.sort((a, b): number => {
		if (query.sort === "duration") {
			return b.durationMs - a.durationMs;
		}
		return parseIso(b.createdAt) - parseIso(a.createdAt);
	});
}

function sortQueriesByQuery(items: QueryLogEntry[], query: TelescopeSqlListQuery): void {
	items.sort((a, b): number => {
		if (query.sort === "newest") {
			return parseIso(b.createdAt) - parseIso(a.createdAt);
		}
		return b.durationMs - a.durationMs;
	});
}

function sortExceptionsNewestFirst(items: ExceptionLogEntry[]): void {
	items.sort((a, b): number => parseIso(b.createdAt) - parseIso(a.createdAt));
}

/** Slices a sorted array into the requested page. */
function paginate<T>(items: readonly T[], page: number, pageSize: number): ListResult<T> {
	const offset: number = (page - 1) * pageSize;
	return {
		items: items.slice(offset, offset + pageSize),
		total: items.length,
		page,
		pageSize,
	};
}

function toSummary(entry: RequestLogEntry, starred: boolean, n1WarningCount: number): RequestLogSummary {
	return {
		id: entry.id,
		method: entry.method,
		path: entry.path,
		statusCode: entry.statusCode,
		userId: entry.userId,
		// Email is resolved by the service via the users table (the store is
		// intentionally DB-free); null until then.
		userEmail: null,
		durationMs: entry.durationMs,
		createdAt: entry.createdAt,
		environment: entry.environment,
		starred,
		n1WarningCount,
	};
}

/** True when the request is starred and the query asks for starred-only rows (feature 4). */
function matchesStarred(starred: boolean, queryStarred: "true" | "false" | undefined): boolean {
	if (queryStarred === undefined) {
		return true;
	}
	return queryStarred === "true" ? starred : !starred;
}

/** How many distinct N+1 warning groups a request's queries trigger (improvement 4). */
function n1WarningCountFor(entry: RequestLogEntry, queriesByCorrelationId: Map<string, QueryLogEntry[]>): number {
	const queries: readonly QueryLogEntry[] | undefined = queriesByCorrelationId.get(entry.correlationId);
	if (queries === undefined || queries.length === 0) {
		return 0;
	}
	return detectN1Warnings(queries).length;
}

// ── Overview time-series + status counts (improvement v2) ───────────────────

/** Fixed bucket count for the overview traffic sparkline. */
const TRAFFIC_BUCKETS = 24;

/**
 * Buckets `inRange` requests into 24 equal-width slots between `fromMs` and
 * `nowMs`, counting requests and errors (status ≥ 500) per slot. Empty slots
 * are still emitted so the sparkline is a continuous axis.
 */
function buildTraffic(inRange: readonly RequestLogEntry[], fromMs: number, nowMs: number): readonly TelescopeTrafficPoint[] {
	const spanMs: number = Math.max(1, nowMs - fromMs);
	const bucketMs: number = spanMs / TRAFFIC_BUCKETS;
	const requests: number[] = new Array<number>(TRAFFIC_BUCKETS).fill(0);
	const errors: number[] = new Array<number>(TRAFFIC_BUCKETS).fill(0);

	for (const entry of inRange) {
		const offsetMs: number = parseIso(entry.createdAt) - fromMs;
		const index: number = Math.min(TRAFFIC_BUCKETS - 1, Math.max(0, Math.floor(offsetMs / bucketMs)));
		requests[index] += 1;
		if ((entry.statusCode ?? 500) >= 500) {
			errors[index] += 1;
		}
	}

	const points: TelescopeTrafficPoint[] = [];
	for (let index = 0; index < TRAFFIC_BUCKETS; index += 1) {
		points.push({
			t: new Date(fromMs + index * bucketMs).toISOString(),
			requests: requests[index] ?? 0,
			errors: errors[index] ?? 0,
		});
	}
	return points;
}

/** Counts status classes (2xx/3xx/4xx/5xx + aborted/unknown as "other"). */
function buildStatusCounts(inRange: readonly RequestLogEntry[]): TelescopeStatusCounts {
	const counts: TelescopeStatusCounts = { "2xx": 0, "3xx": 0, "4xx": 0, "5xx": 0, other: 0 };
	for (const entry of inRange) {
		const status: number | null = entry.statusCode;
		if (status === null) {
			counts.other += 1;
		} else if (status < 300) {
			counts["2xx"] += 1;
		} else if (status < 400) {
			counts["3xx"] += 1;
		} else if (status < 500) {
			counts["4xx"] += 1;
		} else {
			counts["5xx"] += 1;
		}
	}
	return counts;
}

// ── Bounded in-memory store ────────────────────────────────────────────────

/** Requests at/over this duration (ms) are "slow" and protected from eviction. */
const SLOW_REQUEST_MS = 1000;

/** Bounds for the new feature buffers (jobs/schedules/alerts). */
const MAX_JOBS = 500;
const MAX_ALERTS = 200;

// ── Leaderboard (feature 12) ───────────────────────────────────────────────

interface RouteBucket {
	readonly route: string;
	readonly method: string;
	readonly path: string;
	readonly durations: number[];
	errorCount: number;
}

function percentile(sorted: readonly number[], pct: number): number {
	if (sorted.length === 0) {
		return 0;
	}
	return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * pct))] ?? 0;
}

/**
 * Groups in-range requests by `METHOD path`, computes avg/p95/max + error
 * count per route, sorts by p95 desc and returns the top `limit`.
 */
function buildLeaderboard(inRange: readonly RequestLogEntry[], limit: number): readonly TelescopeLeaderboardEntry[] {
	const buckets = new Map<string, RouteBucket>();
	for (const entry of inRange) {
		const key = `${entry.method} ${entry.path}`;
		const existing: RouteBucket | undefined = buckets.get(key);
		if (existing !== undefined) {
			existing.durations.push(entry.durationMs);
			if ((entry.statusCode ?? 500) >= 500) {
				existing.errorCount += 1;
			}
		} else {
			buckets.set(key, { route: key, method: entry.method, path: entry.path, durations: [entry.durationMs], errorCount: (entry.statusCode ?? 500) >= 500 ? 1 : 0 });
		}
	}

	return [...buckets.values()]
		.map((bucket: RouteBucket): TelescopeLeaderboardEntry => {
			const sorted: number[] = [...bucket.durations].sort((a: number, b: number): number => a - b);
			const totalMs: number = sorted.reduce((sum: number, value: number): number => sum + value, 0);
			return {
				route: bucket.route,
				method: bucket.method,
				path: bucket.path,
				count: bucket.durations.length,
				avgMs: sorted.length > 0 ? totalMs / sorted.length : 0,
				p95Ms: percentile(sorted, 0.95),
				maxMs: sorted.length > 0 ? (sorted[sorted.length - 1] ?? 0) : 0,
				errorCount: bucket.errorCount,
				errorRatePct: bucket.durations.length > 0 ? (bucket.errorCount / bucket.durations.length) * 100 : 0,
			};
		})
		.sort((a: TelescopeLeaderboardEntry, b: TelescopeLeaderboardEntry): number => b.p95Ms - a.p95Ms)
		.slice(0, limit);
}

// ── Trends (feature 13) ────────────────────────────────────────────────────

/** Hourly-style trend buckets over the range — coarser than the 24-bucket traffic. */
function buildTrends(inRange: readonly RequestLogEntry[], fromMs: number, nowMs: number, bucketCount: number): readonly TelescopeTrendPoint[] {
	const spanMs: number = Math.max(1, nowMs - fromMs);
	const bucketMs: number = spanMs / bucketCount;
	const requests: number[] = new Array<number>(bucketCount).fill(0);
	const errors: number[] = new Array<number>(bucketCount).fill(0);

	for (const entry of inRange) {
		const offsetMs: number = parseIso(entry.createdAt) - fromMs;
		const index: number = Math.min(bucketCount - 1, Math.max(0, Math.floor(offsetMs / bucketMs)));
		requests[index] += 1;
		if ((entry.statusCode ?? 500) >= 500) {
			errors[index] += 1;
		}
	}

	const points: TelescopeTrendPoint[] = [];
	for (let index = 0; index < bucketCount; index += 1) {
		const bucketRequests: number = requests[index] ?? 0;
		points.push({
			t: new Date(fromMs + index * bucketMs).toISOString(),
			requests: bucketRequests,
			errors: errors[index] ?? 0,
			errorRatePct: bucketRequests > 0 ? ((errors[index] ?? 0) / bucketRequests) * 100 : 0,
		});
	}
	return points;
}

/** Improvement 3: slow or errored requests are protected from ordinary eviction. */
function isProtectedRequest(entry: RequestLogEntry): boolean {
	return (entry.statusCode ?? 500) >= 400 || entry.durationMs >= SLOW_REQUEST_MS;
}

/**
 * Ring-buffer store (docs/telescope.md §6.1): bounded arrays with LRU
 * eviction, keyed lookups for the detail views. An API restart clears the
 * buffer — that is a feature for a dev tool, not a bug (Postgres mode
 * persists via `TelescopePostgresStore` — improvement 1).
 */
export class TelescopeMemoryStore implements TelescopeStore {
	public readonly mode: TelescopeStorage = "memory";

	private readonly requests: RequestLogEntry[] = [];
	private readonly queries: QueryLogEntry[] = [];
	private readonly exceptions: ExceptionLogEntry[] = [];
	private readonly dumps: DumpEntry[] = [];
	private readonly jobs: TelescopeJobLogEntry[] = [];
	private readonly schedules = new Map<string, TelescopeScheduleLog>();
	private readonly annotations = new Map<string, TelescopeAnnotation>();
	private readonly alerts: TelescopeAlertEntry[] = [];
	private readonly webhookDeliveries: TelescopeWebhookDelivery[] = [];

	private readonly byRequestId = new Map<string, RequestLogEntry>();
	private readonly byCorrelationId = new Map<string, RequestLogEntry>();
	private readonly queriesByCorrelationId = new Map<string, QueryLogEntry[]>();
	private readonly dumpsByCorrelationId = new Map<string, DumpEntry[]>();

	public constructor(private readonly maxRequests: number) {}

	public pushRequest(entry: RequestLogEntry): void {
		this.requests.unshift(entry);
		this.byRequestId.set(entry.id, entry);
		this.byCorrelationId.set(entry.correlationId, entry);
		if (this.requests.length > this.maxRequests) {
			const evicted: RequestLogEntry | undefined = this.evictOneRequest();
			if (evicted !== undefined) {
				this.byRequestId.delete(evicted.id);
				this.byCorrelationId.delete(evicted.correlationId);
			}
		}
	}

	/**
	 * Improvement 3 — smarter eviction: scan from the OLDEST end and drop the
	 * first entry that is neither slow nor errored. Only when the whole buffer
	 * is protected does it fall back to evicting the oldest anyway.
	 */
	private evictOneRequest(): RequestLogEntry | undefined {
		for (let i: number = this.requests.length - 1; i >= 0; i -= 1) {
			const candidate: RequestLogEntry = this.requests[i];
			if (!isProtectedRequest(candidate)) {
				return this.requests.splice(i, 1)[0];
			}
		}
		return this.requests.pop();
	}

	public pushQuery(entry: QueryLogEntry): void {
		this.queries.unshift(entry);
		const bucket: QueryLogEntry[] | undefined = this.queriesByCorrelationId.get(entry.correlationId);
		if (bucket !== undefined) {
			bucket.push(entry);
		} else {
			this.queriesByCorrelationId.set(entry.correlationId, [entry]);
		}
		// Bound the query log to 4x the request budget.
		if (this.queries.length > this.maxRequests * 4) {
			const evicted: QueryLogEntry | undefined = this.queries.pop();
			if (evicted !== undefined) {
				const evictedBucket: QueryLogEntry[] | undefined = this.queriesByCorrelationId.get(evicted.correlationId);
				if (evictedBucket !== undefined) {
					evictedBucket.shift();
					if (evictedBucket.length === 0) {
						this.queriesByCorrelationId.delete(evicted.correlationId);
					}
				}
			}
		}
	}

	/**
	 * Improvement 15 — group aggregation: repeats of the same `errorGroup`
	 * bump `occurrences` + `lastSeenAt` on the EXISTING entry instead of
	 * creating a duplicate row. `firstSeenAt` + the id stay stable so the
	 * exceptions list shows one row per group with a lifetime range.
	 */
	public pushException(entry: ExceptionLogEntry): void {
		const existingIndex: number = this.exceptions.findIndex((candidate: ExceptionLogEntry): boolean => candidate.errorGroup === entry.errorGroup);
		if (existingIndex >= 0) {
			const existing: ExceptionLogEntry = this.exceptions[existingIndex];
			existing.occurrences += 1;
			existing.lastSeenAt = entry.createdAt;
			existing.message = entry.message;
			existing.stack = entry.stack ?? existing.stack;
			// A new occurrence re-opens a resolved/ignored group (improvement 6).
			existing.status = "open";
			this.exceptions.splice(existingIndex, 1);
			this.exceptions.unshift(existing);
			return;
		}
		this.exceptions.unshift({ ...entry, occurrences: 1 });
		if (this.exceptions.length > this.maxRequests) {
			this.exceptions.pop();
		}
	}

	public pushDump(entry: DumpEntry): void {
		this.dumps.unshift(entry);
		const bucket: DumpEntry[] | undefined = entry.correlationId !== null ? this.dumpsByCorrelationId.get(entry.correlationId) : undefined;
		if (bucket !== undefined) {
			bucket.push(entry);
		} else if (entry.correlationId !== null) {
			this.dumpsByCorrelationId.set(entry.correlationId, [entry]);
		}
		if (this.dumps.length > this.maxRequests) {
			this.dumps.pop();
		}
	}

	public listRequests(query: TelescopeRequestListQuery): ListResult<RequestLogSummary> {
		const filtered: RequestLogSummary[] = this.requests
			.filter((entry: RequestLogEntry): boolean => {
				const starred: boolean = this.annotations.get(entry.id)?.starred === true;
				return matchesRequest(entry, query) && matchesStarred(starred, query.starred);
			})
			.map((entry: RequestLogEntry): RequestLogSummary =>
				toSummary(entry, this.annotations.get(entry.id)?.starred === true, n1WarningCountFor(entry, this.queriesByCorrelationId)),
			);
		sortRequestsByQuery(filtered, query);
		return paginate(filtered, query.page, query.pageSize);
	}

	public getRequest(id: string): RequestLogEntry | undefined {
		return this.byRequestId.get(id);
	}

	public listQueries(query: TelescopeSqlListQuery): ListResult<QueryLogEntry> {
		const filtered: QueryLogEntry[] = this.queries.filter((entry: QueryLogEntry): boolean => matchesQuery(entry, query));
		sortQueriesByQuery(filtered, query);
		return paginate(filtered, query.page, query.pageSize);
	}

	public listQueriesByCorrelationId(correlationId: string): readonly QueryLogEntry[] {
		return this.queriesByCorrelationId.get(correlationId) ?? [];
	}

	public listExceptions(query: TelescopeExceptionListQuery): ListResult<ExceptionLogEntry> {
		const filtered: ExceptionLogEntry[] = this.exceptions.filter((entry: ExceptionLogEntry): boolean => matchesException(entry, query));
		sortExceptionsNewestFirst(filtered);
		return paginate(filtered, query.page, query.pageSize);
	}

	public getException(id: string): ExceptionLogEntry | undefined {
		return this.exceptions.find((entry: ExceptionLogEntry): boolean => entry.id === id);
	}

	public listDumpsByCorrelationId(correlationId: string): readonly DumpEntry[] {
		return this.dumpsByCorrelationId.get(correlationId) ?? [];
	}

	public leaderboard(fromIso: string, limit: number): readonly TelescopeLeaderboardEntry[] {
		const fromMs: number = parseIso(fromIso);
		const inRange: RequestLogEntry[] = this.requests.filter((entry: RequestLogEntry): boolean => parseIso(entry.createdAt) >= fromMs);
		return buildLeaderboard(inRange, limit);
	}

	public trends(fromIso: string, bucketCount: number): readonly TelescopeTrendPoint[] {
		const fromMs: number = parseIso(fromIso);
		const inRange: RequestLogEntry[] = this.requests.filter((entry: RequestLogEntry): boolean => parseIso(entry.createdAt) >= fromMs);
		return buildTrends(inRange, fromMs, Date.now(), Math.max(1, Math.min(96, bucketCount)));
	}

	public pushJob(entry: TelescopeJobLogEntry): void {
		this.jobs.unshift(entry);
		if (this.jobs.length > MAX_JOBS) {
			this.jobs.pop();
		}
	}

	public listJobs(query: TelescopeJobsListQuery): ListResult<TelescopeJobLogEntry> {
		const filtered: TelescopeJobLogEntry[] = this.jobs.filter((entry: TelescopeJobLogEntry): boolean => {
			if (query.status !== undefined && entry.status !== query.status) {
				return false;
			}
			// Feature 11 — job name substring filter.
			if (query.jobName !== undefined && query.jobName.length > 0 && !entry.jobName.toLowerCase().includes(query.jobName.toLowerCase())) {
				return false;
			}
			return true;
		});
		return paginate(filtered, query.page, query.pageSize);
	}

	public getJob(id: string): TelescopeJobLogEntry | undefined {
		return this.jobs.find((entry: TelescopeJobLogEntry): boolean => entry.id === id);
	}

	public upsertSchedule(entry: TelescopeScheduleLog): void {
		this.schedules.set(entry.name, entry);
	}

	public listSchedules(): readonly TelescopeScheduleLog[] {
		return [...this.schedules.values()].sort((a: TelescopeScheduleLog, b: TelescopeScheduleLog): number => a.name.localeCompare(b.name));
	}

	public setAnnotation(requestId: string, annotation: TelescopeAnnotation | null): void {
		if (annotation === null) {
			this.annotations.delete(requestId);
		} else {
			this.annotations.set(requestId, annotation);
		}
	}

	public getAnnotation(requestId: string): TelescopeAnnotation | null {
		return this.annotations.get(requestId) ?? null;
	}

	public listLogs(query: TelescopeLogsListQuery): ListResult<TelescopeLogRow> {
		const rows: TelescopeLogRow[] = [];
		for (const request of this.requests) {
			for (let index = 0; index < request.logs.length; index += 1) {
				const log = request.logs[index];
				if (query.level !== undefined && log.level !== query.level) {
					continue;
				}
				if (query.correlationId !== undefined && request.correlationId !== query.correlationId) {
					continue;
				}
				if (query.q !== undefined && query.q.length > 0 && !log.message.toLowerCase().includes(query.q.toLowerCase())) {
					continue;
				}
				rows.push({
					id: `${request.id}:${String(index)}`,
					requestId: request.id,
					correlationId: request.correlationId,
					level: log.level,
					message: log.message,
					timestamp: log.timestamp,
					method: request.method,
					path: request.path,
				});
			}
		}
		rows.sort((a: TelescopeLogRow, b: TelescopeLogRow): number => parseIso(b.timestamp) - parseIso(a.timestamp));
		return paginate(rows, query.page, query.pageSize);
	}

	public pushAlert(entry: TelescopeAlertEntry): void {
		this.alerts.unshift(entry);
		if (this.alerts.length > MAX_ALERTS) {
			this.alerts.pop();
		}
	}

	public listAlerts(limit: number): readonly TelescopeAlertEntry[] {
		return this.alerts.slice(0, Math.max(0, limit));
	}

	/** Feature 13 — webhook delivery records (bounded, newest-first). */
	public pushWebhookDelivery(entry: TelescopeWebhookDelivery): void {
		this.webhookDeliveries.unshift(entry);
		if (this.webhookDeliveries.length > 500) {
			this.webhookDeliveries.pop();
		}
	}

	public listWebhookDeliveries(limit: number): readonly TelescopeWebhookDelivery[] {
		return this.webhookDeliveries.slice(0, Math.max(0, limit));
	}

	/**
	 * Feature 1 — global free-text search across requests, SQL, exceptions and
	 * logs. Each scope matches on its own fields; the whole capture is scanned
	 * (bounded per-scope by the query limit, no pagination — top hits only).
	 */
	public search(query: TelescopeSearchQuery, emailUserIds: ReadonlySet<string> = new Set()): TelescopeSearchResponse {
		// A blank query matches everything with `includes("")` — return an
		// empty set instead (an empty search is not an error, just nothing).
		const needle: string = query.q.trim().toLowerCase();
		if (needle.length === 0) {
			return { q: "", requests: [], sql: [], exceptions: [], logs: [] };
		}
		const limit: number = query.limit;

		const requestMatches: TelescopeSearchRequestMatch[] = [];
		for (const entry of this.requests) {
			if (requestMatches.length >= limit) {
				break;
			}
			const haystackMatches: boolean = `${entry.method} ${entry.path} ${entry.queryString ?? ""} ${requestBodyText(entry)} ${entry.userId ?? ""}`
				.toLowerCase()
				.includes(needle);
			// An email fragment matches when the request's user id resolved to an
			// email containing the fragment (server-side lookup in the service).
			const emailMatches: boolean = entry.userId !== null && emailUserIds.has(entry.userId);
			if (haystackMatches || emailMatches) {
				requestMatches.push({
					id: entry.id,
					method: entry.method,
					path: entry.path,
					statusCode: entry.statusCode,
					userId: entry.userId,
					// Resolved by the service after the store scan (store is DB-free).
					userEmail: null,
					durationMs: entry.durationMs,
					createdAt: entry.createdAt,
				});
			}
		}

		const sqlMatches: TelescopeSearchSqlMatch[] = [];
		for (const entry of this.queries) {
			if (sqlMatches.length >= limit) {
				break;
			}
			if (`${entry.model} ${entry.operation} ${entry.query}`.toLowerCase().includes(needle)) {
				sqlMatches.push({
					id: entry.id,
					correlationId: entry.correlationId,
					model: entry.model,
					operation: entry.operation,
					query: entry.query,
					durationMs: entry.durationMs,
					createdAt: entry.createdAt,
				});
			}
		}

		const exceptionMatches: TelescopeSearchExceptionMatch[] = [];
		for (const entry of this.exceptions) {
			if (exceptionMatches.length >= limit) {
				break;
			}
			if (`${entry.name} ${entry.message} ${entry.path ?? ""}`.toLowerCase().includes(needle)) {
				exceptionMatches.push({
					id: entry.id,
					errorGroup: entry.errorGroup,
					name: entry.name,
					message: entry.message,
					statusCode: entry.statusCode,
					path: entry.path,
					occurrences: entry.occurrences,
					lastSeenAt: entry.lastSeenAt,
				});
			}
		}

		const logMatches: TelescopeSearchLogMatch[] = [];
		for (const entry of this.requests) {
			for (const log of entry.logs) {
				if (logMatches.length >= limit) {
					break;
				}
				if (log.message.toLowerCase().includes(needle)) {
					logMatches.push({
						id: `${entry.id}:${log.timestamp}`,
						requestId: entry.id,
						level: log.level,
						message: log.message,
						timestamp: log.timestamp,
						path: entry.path,
					});
				}
			}
			if (logMatches.length >= limit) {
				break;
			}
		}

		return { q: query.q, requests: requestMatches, sql: sqlMatches, exceptions: exceptionMatches, logs: logMatches };
	}

	/**
	 * Feature 3 — per-user aggregation: groups in-range requests by `userId`
	 * and returns count/errors/avg/p95/last-seen per user, sorted by the
	 * requested column. Users without a userId are skipped (not attributable).
	 */
	public listUsers(query: TelescopeUsersQuery): ListResult<TelescopeUserSummary> {
		const fromMs: number = rangeToWindowStartMs(query.range);
		const buckets = new Map<string, { readonly durations: number[]; errors: number; lastSeenMs: number }>();
		for (const entry of this.requests) {
			if (entry.userId === null || parseIso(entry.createdAt) < fromMs) {
				continue;
			}
			const existing = buckets.get(entry.userId);
			const createdAtMs: number = parseIso(entry.createdAt);
			if (existing !== undefined) {
				existing.durations.push(entry.durationMs);
				if ((entry.statusCode ?? 500) >= 500) {
					existing.errors += 1;
				}
				if (createdAtMs > existing.lastSeenMs) {
					existing.lastSeenMs = createdAtMs;
				}
			} else {
				buckets.set(entry.userId, {
					durations: [entry.durationMs],
					errors: (entry.statusCode ?? 500) >= 500 ? 1 : 0,
					lastSeenMs: createdAtMs,
				});
			}
		}

		const summaries: TelescopeUserSummary[] = [...buckets.entries()].map(([userId, bucket]) => {
			const sorted: number[] = [...bucket.durations].sort((a: number, b: number): number => a - b);
			const totalMs: number = sorted.reduce((sum: number, value: number): number => sum + value, 0);
			return {
				userId,
				// Email is resolved by the service via the users table (the store is
				// intentionally DB-free); null until then.
				email: null,
				count: bucket.durations.length,
				errorCount: bucket.errors,
				errorRatePct: bucket.durations.length > 0 ? (bucket.errors / bucket.durations.length) * 100 : 0,
				avgDurationMs: sorted.length > 0 ? totalMs / sorted.length : 0,
				p95DurationMs: percentile(sorted, 0.95),
				lastSeenAt: new Date(bucket.lastSeenMs).toISOString(),
			};
		});
		summaries.sort((a: TelescopeUserSummary, b: TelescopeUserSummary): number => {
			if (query.sort === "errors") {
				return b.errorCount - a.errorCount;
			}
			if (query.sort === "duration") {
				return b.p95DurationMs - a.p95DurationMs;
			}
			return b.count - a.count;
		});
		return paginate(summaries, query.page, query.pageSize);
	}

	/** Improvement 5 — ack or snooze an alert by id. */
	public setAlertStatus(id: string, status: TelescopeAlertStatus, snoozedUntil: string | null): void {
		const index: number = this.alerts.findIndex((entry: TelescopeAlertEntry): boolean => entry.id === id);
		if (index < 0) {
			return;
		}
		const current: TelescopeAlertEntry = this.alerts[index];
		const updated: TelescopeAlertEntry = { ...current, status, snoozedUntil };
		this.alerts.splice(index, 1);
		this.alerts.unshift(updated);
	}

	/** Improvement 6 — set the triage status of an exception group (all rows of the group). */
	public setExceptionStatus(errorGroup: string, status: TelescopeExceptionStatus): void {
		for (let index = 0; index < this.exceptions.length; index += 1) {
			const entry: ExceptionLogEntry = this.exceptions[index];
			if (entry.errorGroup === errorGroup) {
				this.exceptions[index] = { ...entry, status };
			}
		}
	}

	/** Improvement 12 — neighbors around a request in capture order (newest-first). */
	public getAdjacentRequestIds(id: string): { readonly prevId: string | null; readonly nextId: string | null } {
		const index: number = this.requests.findIndex((entry: RequestLogEntry): boolean => entry.id === id);
		if (index < 0) {
			return { prevId: null, nextId: null };
		}
		// The buffer is newest-first: "prev" (older) is at a higher index.
		const older: RequestLogEntry | undefined = this.requests.at(index + 1);
		const newer: RequestLogEntry | undefined = this.requests.at(index - 1);
		return { prevId: older?.id ?? null, nextId: newer?.id ?? null };
	}

	/** Improvement 18 — nearest earlier request with the same method+path. */
	public findPreviousRequest(id: string): RequestLogEntry | undefined {
		const index: number = this.requests.findIndex((entry: RequestLogEntry): boolean => entry.id === id);
		if (index < 0) {
			return undefined;
		}
		const current: RequestLogEntry = this.requests[index];
		for (let cursor = index + 1; cursor < this.requests.length; cursor += 1) {
			const candidate: RequestLogEntry | undefined = this.requests.at(cursor);
			if (candidate?.method === current.method && candidate.path === current.path) {
				return candidate;
			}
		}
		return undefined;
	}

	/** Improvement 19 — capture-pipeline health snapshot. */
	public health(): StoreHealth {
		return {
			mode: this.mode,
			bufferRequests: this.requests.length,
			bufferCap: this.maxRequests,
		};
	}

	public overviewStats(fromIso: string): OverviewStats {
		const fromMs: number = parseIso(fromIso);
		const nowMs: number = Date.now();
		const inRange: RequestLogEntry[] = this.requests.filter((entry: RequestLogEntry): boolean => parseIso(entry.createdAt) >= fromMs);
		const durations: number[] = inRange.map((entry: RequestLogEntry): number => entry.durationMs).sort((a: number, b: number): number => a - b);

		const requests: number = inRange.length;
		const avgDurationMs: number = durations.length > 0 ? durations.reduce((sum: number, value: number): number => sum + value, 0) / durations.length : 0;
		const p95DurationMs: number = durations.length > 0 ? (durations[Math.min(durations.length - 1, Math.floor(durations.length * 0.95))] ?? 0) : 0;
		const slowestEntry: RequestLogEntry | undefined =
			inRange.length > 0
				? inRange.reduce((slowest: RequestLogEntry, entry: RequestLogEntry): RequestLogEntry => (entry.durationMs > slowest.durationMs ? entry : slowest))
				: undefined;

		const errorCount: number = inRange.filter((entry: RequestLogEntry): boolean => (entry.statusCode ?? 500) >= 500).length;

		// Improvement 4 — how many requests in range trip the N+1 detector.
		let n1RequestCount = 0;
		for (const entry of inRange) {
			if (n1WarningCountFor(entry, this.queriesByCorrelationId) > 0) {
				n1RequestCount += 1;
			}
		}

		return {
			requests,
			avgDurationMs,
			p95DurationMs,
			slowest:
				slowestEntry !== undefined
					? toSummary(slowestEntry, this.annotations.get(slowestEntry.id)?.starred === true, n1WarningCountFor(slowestEntry, this.queriesByCorrelationId))
					: null,
			errorCount,
			sqlCount: this.queries.filter((entry: QueryLogEntry): boolean => parseIso(entry.createdAt) >= fromMs).length,
			slowSqlCount: this.queries.filter((entry: QueryLogEntry): boolean => parseIso(entry.createdAt) >= fromMs && entry.durationMs >= 500).length,
			exceptionGroups: new Set(
				this.exceptions.filter((entry: ExceptionLogEntry): boolean => parseIso(entry.createdAt) >= fromMs).map((entry: ExceptionLogEntry): string => entry.errorGroup),
			).size,
			n1RequestCount,
			piiRequestCount: inRange.filter((entry: RequestLogEntry): boolean => entry.piiFlags.length > 0).length,
			traffic: buildTraffic(inRange, fromMs, nowMs),
			statusCounts: buildStatusCounts(inRange),
		};
	}

	/**
	 * Improvement 4 — retention pruning: drops every entry older than
	 * `retentionMinutes` and rebuilds the lookup maps. Returns the total
	 * number of removed entries across all four buffers.
	 */
	public pruneRetention(retentionMinutes: number): number {
		const cutoffMs: number = Date.now() - retentionMinutes * 60 * 1000;
		const kept = (iso: string): boolean => parseIso(iso) >= cutoffMs;
		let removed = 0;

		const keptRequests: RequestLogEntry[] = this.requests.filter((entry: RequestLogEntry): boolean => kept(entry.createdAt));
		removed += this.requests.length - keptRequests.length;
		this.requests.length = 0;
		this.requests.push(...keptRequests);

		this.byRequestId.clear();
		this.byCorrelationId.clear();
		for (const entry of this.requests) {
			this.byRequestId.set(entry.id, entry);
			this.byCorrelationId.set(entry.correlationId, entry);
		}

		const keptQueries: QueryLogEntry[] = this.queries.filter((entry: QueryLogEntry): boolean => kept(entry.createdAt));
		removed += this.queries.length - keptQueries.length;
		this.queries.length = 0;
		this.queries.push(...keptQueries);

		this.queriesByCorrelationId.clear();
		for (const entry of this.queries) {
			const bucket: QueryLogEntry[] | undefined = this.queriesByCorrelationId.get(entry.correlationId);
			if (bucket !== undefined) {
				bucket.push(entry);
			} else {
				this.queriesByCorrelationId.set(entry.correlationId, [entry]);
			}
		}

		const keptExceptions: ExceptionLogEntry[] = this.exceptions.filter((entry: ExceptionLogEntry): boolean => kept(entry.createdAt));
		removed += this.exceptions.length - keptExceptions.length;
		this.exceptions.length = 0;
		this.exceptions.push(...keptExceptions);

		const keptDumps: DumpEntry[] = this.dumps.filter((entry: DumpEntry): boolean => kept(entry.createdAt));
		removed += this.dumps.length - keptDumps.length;
		this.dumps.length = 0;
		this.dumps.push(...keptDumps);

		this.dumpsByCorrelationId.clear();
		for (const entry of this.dumps) {
			if (entry.correlationId === null) {
				continue;
			}
			const bucket: DumpEntry[] | undefined = this.dumpsByCorrelationId.get(entry.correlationId);
			if (bucket !== undefined) {
				bucket.push(entry);
			} else {
				this.dumpsByCorrelationId.set(entry.correlationId, [entry]);
			}
		}

		// Feature buffers: jobs + alerts prune by age; annotations/schedules are
		// small keyed maps pruned by association with removed requests.
		const keptJobs: TelescopeJobLogEntry[] = this.jobs.filter((entry: TelescopeJobLogEntry): boolean => kept(entry.enqueuedAt));
		removed += this.jobs.length - keptJobs.length;
		this.jobs.length = 0;
		this.jobs.push(...keptJobs);

		const keptAlerts: TelescopeAlertEntry[] = this.alerts.filter((entry: TelescopeAlertEntry): boolean => kept(entry.firedAt));
		removed += this.alerts.length - keptAlerts.length;
		this.alerts.length = 0;
		this.alerts.push(...keptAlerts);

		const keptDeliveries: TelescopeWebhookDelivery[] = this.webhookDeliveries.filter((entry: TelescopeWebhookDelivery): boolean => kept(entry.createdAt));
		removed += this.webhookDeliveries.length - keptDeliveries.length;
		this.webhookDeliveries.length = 0;
		this.webhookDeliveries.push(...keptDeliveries);

		for (const requestId of [...this.annotations.keys()]) {
			if (!this.byRequestId.has(requestId)) {
				this.annotations.delete(requestId);
			}
		}
		for (const scheduleName of [...this.schedules.keys()]) {
			const schedule: TelescopeScheduleLog | undefined = this.schedules.get(scheduleName);
			if (schedule !== undefined && !kept(schedule.nextRunAt) && schedule.lastRunAt !== null && !kept(schedule.lastRunAt)) {
				this.schedules.delete(scheduleName);
			}
		}

		return removed;
	}

	public clear(): void {
		this.requests.length = 0;
		this.queries.length = 0;
		this.exceptions.length = 0;
		this.dumps.length = 0;
		this.jobs.length = 0;
		this.alerts.length = 0;
		this.webhookDeliveries.length = 0;
		this.schedules.clear();
		this.annotations.clear();
		this.byRequestId.clear();
		this.byCorrelationId.clear();
		this.queriesByCorrelationId.clear();
		this.dumpsByCorrelationId.clear();
	}
}
