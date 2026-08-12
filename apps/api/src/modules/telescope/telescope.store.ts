import type {
	DumpEntry,
	ExceptionLogEntry,
	QueryLogEntry,
	RequestLogEntry,
	RequestLogSummary,
	TelescopeExceptionListQuery,
	TelescopeRequestListQuery,
	TelescopeSqlListQuery,
} from "@workspace/shared";

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
	return isAfter(request.createdAt, query.from) && isBefore(request.createdAt, query.to);
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

function toSummary(entry: RequestLogEntry): RequestLogSummary {
	return {
		id: entry.id,
		method: entry.method,
		path: entry.path,
		statusCode: entry.statusCode,
		userId: entry.userId,
		durationMs: entry.durationMs,
		createdAt: entry.createdAt,
	};
}

// ── Bounded in-memory store ────────────────────────────────────────────────

/**
 * Ring-buffer store (docs/telescope.md §6.1): bounded arrays with LRU
 * eviction, keyed lookups for the detail views. An API restart clears the
 * buffer — that is a feature for a dev tool, not a bug.
 */
export class TelescopeMemoryStore implements TelescopeStore {
	public readonly mode: string = "memory";

	private readonly requests: RequestLogEntry[] = [];
	private readonly queries: QueryLogEntry[] = [];
	private readonly exceptions: ExceptionLogEntry[] = [];
	private readonly dumps: DumpEntry[] = [];

	private readonly byRequestId: Map<string, RequestLogEntry> = new Map();
	private readonly byCorrelationId: Map<string, RequestLogEntry> = new Map();
	private readonly queriesByCorrelationId: Map<string, QueryLogEntry[]> = new Map();
	private readonly dumpsByCorrelationId: Map<string, DumpEntry[]> = new Map();

	public constructor(private readonly maxRequests: number) {}

	public pushRequest(entry: RequestLogEntry): void {
		this.requests.unshift(entry);
		this.byRequestId.set(entry.id, entry);
		this.byCorrelationId.set(entry.correlationId, entry);
		if (this.requests.length > this.maxRequests) {
			const evicted: RequestLogEntry | undefined = this.requests.pop();
			if (evicted !== undefined) {
				this.byRequestId.delete(evicted.id);
				this.byCorrelationId.delete(evicted.correlationId);
			}
		}
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

	public pushException(entry: ExceptionLogEntry): void {
		this.exceptions.unshift(entry);
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
		const filtered: RequestLogSummary[] = this.requests.filter((entry: RequestLogEntry): boolean => matchesRequest(entry, query)).map(toSummary);
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

	public overviewStats(fromIso: string): OverviewStats {
		const inRange: RequestLogEntry[] = this.requests.filter((entry: RequestLogEntry): boolean => parseIso(entry.createdAt) >= parseIso(fromIso));
		const durations: number[] = inRange.map((entry: RequestLogEntry): number => entry.durationMs).sort((a: number, b: number): number => a - b);

		const requests: number = inRange.length;
		const avgDurationMs: number = durations.length > 0 ? durations.reduce((sum: number, value: number): number => sum + value, 0) / durations.length : 0;
		const p95DurationMs: number = durations.length > 0 ? durations[Math.min(durations.length - 1, Math.floor(durations.length * 0.95))] ?? 0 : 0;
		const slowestEntry: RequestLogEntry | undefined =
			inRange.length > 0 ? inRange.reduce((slowest: RequestLogEntry, entry: RequestLogEntry): RequestLogEntry => (entry.durationMs > slowest.durationMs ? entry : slowest)) : undefined;

		return {
			requests,
			avgDurationMs,
			p95DurationMs,
			slowest: slowestEntry !== undefined ? toSummary(slowestEntry) : null,
			errorCount: inRange.filter((entry: RequestLogEntry): boolean => (entry.statusCode ?? 500) >= 500).length,
			sqlCount: this.queries.filter((entry: QueryLogEntry): boolean => parseIso(entry.createdAt) >= parseIso(fromIso)).length,
			slowSqlCount: this.queries.filter((entry: QueryLogEntry): boolean => parseIso(entry.createdAt) >= parseIso(fromIso) && entry.durationMs >= 500).length,
			exceptionGroups: new Set(
				this.exceptions.filter((entry: ExceptionLogEntry): boolean => parseIso(entry.createdAt) >= parseIso(fromIso)).map((entry: ExceptionLogEntry): string => entry.errorGroup),
			).size,
		};
	}

	public clear(): void {
		this.requests.length = 0;
		this.queries.length = 0;
		this.exceptions.length = 0;
		this.dumps.length = 0;
		this.byRequestId.clear();
		this.byCorrelationId.clear();
		this.queriesByCorrelationId.clear();
		this.dumpsByCorrelationId.clear();
	}
}
