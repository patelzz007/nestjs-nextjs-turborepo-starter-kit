import type {
	AuditTrailEntry,
	DataChangeLogDetail,
	DataChangeLogSummary,
	HttpAuditLogDetail,
	HttpAuditLogSummary,
	JsonValue,
	PaginatedServiceResult,
} from "@workspace/shared";

import type {
	AuditReadRequest,
	AuditReadScope,
	AuditReadSession,
	AuditTrailReader,
	DataChangeLogReader,
	HttpAuditLogReader,
	SensitiveReadRecorder,
} from "../../ports/audit-read-session.port";

/** One page of `items` the way the real readers answer: offset paging over the stored records, newest first as given. */
function pageOf<TItem>(items: readonly TItem[], query: { readonly page: number; readonly limit: number }): PaginatedServiceResult<TItem> {
	const start = (query.page - 1) * query.limit;
	const slice = items.slice(start, start + query.limit);
	const totalPages = Math.ceil(items.length / query.limit);
	return {
		items: slice,
		limit: query.limit,
		total: items.length,
		page: query.page,
		totalPages,
		nextCursor: null,
		hasNext: query.page < totalPages,
		hasPrevious: query.page > 1,
	};
}

/** The HTTP audit store as a list of already-mapped records. */
export class InMemoryHttpAuditLogReader implements HttpAuditLogReader {
	public constructor(
		public readonly summaries: HttpAuditLogSummary[] = [],
		public readonly details: HttpAuditLogDetail[] = [],
	) {}

	public list(query: { readonly page: number; readonly limit: number }): Promise<PaginatedServiceResult<HttpAuditLogSummary>> {
		return Promise.resolve(pageOf(this.summaries, query));
	}

	public findById(id: string): Promise<HttpAuditLogDetail | null> {
		return Promise.resolve(this.details.find((detail) => detail.id === id) ?? null);
	}
}

/** The data-change store as a list of already-mapped records. */
export class InMemoryDataChangeLogReader implements DataChangeLogReader {
	public constructor(
		public readonly summaries: DataChangeLogSummary[] = [],
		public readonly details: DataChangeLogDetail[] = [],
	) {}

	public list(query: { readonly page: number; readonly limit: number }): Promise<PaginatedServiceResult<DataChangeLogSummary>> {
		return Promise.resolve(pageOf(this.summaries, query));
	}

	public findById(id: string): Promise<DataChangeLogDetail | null> {
		return Promise.resolve(this.details.find((detail) => detail.id === id) ?? null);
	}
}

/** The timeline as a list of already-built entries. */
export class InMemoryAuditTrailReader implements AuditTrailReader {
	public constructor(public readonly entries: AuditTrailEntry[] = []) {}

	public list(query: { readonly page: number; readonly limit: number }): Promise<PaginatedServiceResult<AuditTrailEntry>> {
		return Promise.resolve(pageOf(this.entries, query));
	}
}

/** Keeps the summaries a read recorded; `failWith` makes the next write fail the way a database error would. */
export class RecordingSensitiveReadRecorder implements SensitiveReadRecorder {
	public readonly pending: JsonValue[] = [];
	public failWith: Error | null = null;

	public record(summary: JsonValue): Promise<void> {
		if (this.failWith !== null) {
			return Promise.reject(this.failWith);
		}
		this.pending.push(summary);
		return Promise.resolve();
	}
}

/**
 * A real {@link AuditReadSession}: runs the work on in-memory readers and keeps what committed.
 * A sensitive-read row exists only for a read that committed — exactly the transaction semantics
 * of the Prisma session (the row commits with the read or not at all).
 */
export class InMemoryAuditReadSession implements AuditReadSession {
	public readonly opened: AuditReadRequest[] = [];
	public readonly committedSummaries: JsonValue[] = [];
	public readonly rolledBack: AuditReadRequest[] = [];
	public readonly httpAuditLogs: InMemoryHttpAuditLogReader = new InMemoryHttpAuditLogReader();
	public readonly dataChangeLogs: InMemoryDataChangeLogReader = new InMemoryDataChangeLogReader();
	public readonly auditTrail: InMemoryAuditTrailReader = new InMemoryAuditTrailReader();
	public readonly sensitiveReads: RecordingSensitiveReadRecorder = new RecordingSensitiveReadRecorder();

	public async read<TResult>(request: AuditReadRequest, work: (scope: AuditReadScope) => Promise<TResult>): Promise<TResult> {
		this.opened.push(request);
		this.sensitiveReads.pending.splice(0, this.sensitiveReads.pending.length);
		try {
			const result = await work({
				httpAuditLogs: this.httpAuditLogs,
				dataChangeLogs: this.dataChangeLogs,
				auditTrail: this.auditTrail,
				sensitiveReads: this.sensitiveReads,
			});
			this.committedSummaries.push(...this.sensitiveReads.pending);
			return result;
		} catch (error) {
			this.rolledBack.push(request);
			throw error;
		} finally {
			this.sensitiveReads.pending.splice(0, this.sensitiveReads.pending.length);
		}
	}
}
