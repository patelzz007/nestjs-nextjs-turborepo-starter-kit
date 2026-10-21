import type { Prisma } from "@prisma/client";
import {
	httpAuditLogListQuery,
	type HttpAuditLogDetail,
	type HttpAuditLogListQuery,
	type HttpAuditLogListSortField,
	type HttpAuditLogSummary,
	type PaginatedServiceResult,
} from "@workspace/shared";

import type { HttpAuditLogReader } from "../../application/ports/audit-read-session.port";
import { fetchListPage, mapListResult, toPaginatedServiceResult } from "../../../../platform/infrastructure/persistence/list-page";
import { timestampIdKeyset, type ListKeyset } from "../../../../platform/infrastructure/persistence/list-query/keyset-cursor";
import { buildListOrder, type ListOrder, type SortColumns } from "../../../../platform/infrastructure/persistence/list-query/list-order";
import {
	fieldWhere,
	toPrismaComparableFilter,
	toPrismaEqualityFilter,
	toPrismaNullableEqualityFilter,
	toPrismaNullableStringFilter,
	toPrismaStringFilter,
} from "../../../../platform/infrastructure/persistence/list-query/prisma-filter";
import { httpAuditLogReferenceIds, toHttpAuditLogDetail, toHttpAuditLogSummary } from "./http-audit-log.mapper";
import type { PrismaAuditReferenceReader } from "./prisma-audit-reference.reader";

/** Every `AuditLog` column except the (up to 16 KiB each) payloads — what a list page reads. */
export const AUDIT_LOG_SUMMARY_SELECT = {
	id: true,
	correlationId: true,
	occurredAt: true,
	completedAt: true,
	method: true,
	endpoint: true,
	path: true,
	outcome: true,
	responseStatus: true,
	errorCode: true,
	authMethod: true,
	actorUserId: true,
	impersonatorUserId: true,
	apiKeyId: true,
	terminalId: true,
	tenantId: true,
	locationId: true,
	ipAddress: true,
	userAgent: true,
	browserName: true,
	browserVersion: true,
	osName: true,
	osVersion: true,
	deviceType: true,
	deviceModel: true,
	ipVersion: true,
	ipScope: true,
	geoCountry: true,
	geoRegion: true,
	geoCity: true,
	geoTimeZone: true,
	clientType: true,
} satisfies Prisma.AuditLogSelect;

/** One list row (no payloads, no detail-only metadata). */
export type AuditLogSummaryRow = Prisma.AuditLogGetPayload<{ select: typeof AUDIT_LOG_SUMMARY_SELECT }>;

// ── List query → Prisma (explicit field → column mapping; see docs/technical/api/list-queries.md) ──

const AUDIT_LOG_SORT_COLUMNS: SortColumns<HttpAuditLogListSortField, Prisma.AuditLogOrderByWithRelationInput> = {
	occurredAt: (direction) => ({ occurredAt: direction }),
	responseStatus: (direction) => ({ responseStatus: direction }),
	method: (direction) => ({ method: direction }),
	endpoint: (direction) => ({ endpoint: direction }),
};

/** Keyset for the default order (`occurredAt desc, id desc`). */
const AUDIT_LOG_LIST_KEYSET: ListKeyset<AuditLogSummaryRow, Prisma.AuditLogWhereInput> = timestampIdKeyset(
	(row: AuditLogSummaryRow) => ({ at: Number(row.occurredAt), id: row.id }),
	({ at, id }): Prisma.AuditLogWhereInput => ({ OR: [{ occurredAt: { lt: at } }, { occurredAt: at, id: { lt: id } }] }),
);

/**
 * The filter AST + search, one explicit column per whitelisted field. There is
 * no soft-delete condition: audit rows are append-only and never deleted. The
 * substring searches (ILIKE '%…%') are served by the `audit_logs_*_trgm_idx`
 * trigram GIN indexes.
 */
export function buildHttpAuditLogListWhere(query: HttpAuditLogListQuery): Prisma.AuditLogWhereInput {
	const filter = query.filter;
	return {
		AND: [
			...fieldWhere(toPrismaEqualityFilter(filter?.outcome), (outcome) => ({ outcome })),
			...fieldWhere(toPrismaEqualityFilter(filter?.method), (method) => ({ method })),
			...fieldWhere(toPrismaNullableEqualityFilter(filter?.authMethod), (authMethod) => ({ authMethod })),
			...fieldWhere(toPrismaComparableFilter(filter?.responseStatus), (responseStatus) => ({ responseStatus })),
			...fieldWhere(toPrismaStringFilter(filter?.endpoint), (endpoint) => ({ endpoint })),
			...fieldWhere(toPrismaNullableStringFilter(filter?.errorCode), (errorCode) => ({ errorCode })),
			...fieldWhere(toPrismaNullableEqualityFilter(filter?.actorUserId), (actorUserId) => ({ actorUserId })),
			...fieldWhere(toPrismaNullableEqualityFilter(filter?.impersonatorUserId), (impersonatorUserId) => ({ impersonatorUserId })),
			...fieldWhere(toPrismaNullableEqualityFilter(filter?.tenantId), (tenantId) => ({ tenantId })),
			...fieldWhere(toPrismaNullableEqualityFilter(filter?.apiKeyId), (apiKeyId) => ({ apiKeyId })),
			...fieldWhere(toPrismaNullableStringFilter(filter?.ipAddress), (ipAddress) => ({ ipAddress })),
			...fieldWhere(toPrismaNullableEqualityFilter(filter?.ipScope), (ipScope) => ({ ipScope })),
			...fieldWhere(toPrismaNullableEqualityFilter(filter?.deviceType), (deviceType) => ({ deviceType })),
			...fieldWhere(toPrismaNullableStringFilter(filter?.browserName), (browserName) => ({ browserName })),
			...fieldWhere(toPrismaNullableStringFilter(filter?.osName), (osName) => ({ osName })),
			...fieldWhere(toPrismaNullableStringFilter(filter?.geoCountry), (geoCountry) => ({ geoCountry })),
			...fieldWhere(toPrismaStringFilter(filter?.correlationId), (correlationId) => ({ correlationId })),
			...fieldWhere(toPrismaComparableFilter(filter?.occurredAt), (occurredAt) => ({ occurredAt })),
			...(query.search !== undefined
				? [
						{
							OR: [
								{ path: { contains: query.search, mode: "insensitive" } },
								{ endpoint: { contains: query.search, mode: "insensitive" } },
								{ correlationId: { equals: query.search } },
								{ errorCode: { contains: query.search, mode: "insensitive" } },
								{ ipAddress: { startsWith: query.search } },
								{ userAgent: { contains: query.search, mode: "insensitive" } },
							],
						} satisfies Prisma.AuditLogWhereInput,
					]
				: []),
		],
	};
}

export function buildHttpAuditLogListOrder(query: HttpAuditLogListQuery): ListOrder<Prisma.AuditLogOrderByWithRelationInput> {
	return buildListOrder(httpAuditLogListQuery.resolveSort(query.sort), {
		columns: AUDIT_LOG_SORT_COLUMNS,
		tieBreaker: (direction) => ({ id: direction }),
	});
}

/**
 * Read-side access to the global HTTP audit trail (`AuditLog`) for the admin
 * viewer. The table is append-only and bypass-only under RLS: this repository
 * never writes, and is bound to one `audit.http_request.read` system-operation
 * transaction (`db`). The names its rows reference are resolved by
 * {@link PrismaAuditReferenceReader} on the same transaction.
 */
export class PrismaHttpAuditLogReadRepository implements HttpAuditLogReader {
	public constructor(
		private readonly db: Prisma.TransactionClient,
		private readonly references: PrismaAuditReferenceReader,
	) {}

	/** One page of rows matching the (already validated) list query, payloads excluded, actor and tenant names resolved. */
	public async list(query: HttpAuditLogListQuery): Promise<PaginatedServiceResult<HttpAuditLogSummary>> {
		const rows = await fetchListPage(query, {
			where: buildHttpAuditLogListWhere(query),
			order: buildHttpAuditLogListOrder(query),
			keyset: AUDIT_LOG_LIST_KEYSET,
			and: (left, right) => ({ AND: [left, right] }),
			count: (where) => this.db.auditLog.count({ where }),
			findMany: (args) => this.db.auditLog.findMany({ ...args, select: AUDIT_LOG_SUMMARY_SELECT }),
		});
		const references = await this.references.load(httpAuditLogReferenceIds(rows.items));
		return toPaginatedServiceResult(
			mapListResult(rows, (row: AuditLogSummaryRow): HttpAuditLogSummary => toHttpAuditLogSummary(row, references)),
			query,
		);
	}

	/** One complete record, or `null` when no row has this id. */
	public async findById(id: string): Promise<HttpAuditLogDetail | null> {
		const row = await this.db.auditLog.findUnique({ where: { id } });
		return row === null ? null : toHttpAuditLogDetail(row, await this.references.load(httpAuditLogReferenceIds([row])));
	}
}
