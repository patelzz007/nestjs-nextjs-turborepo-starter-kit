import { Injectable } from "@nestjs/common";
import type { AuditLog, Prisma } from "@prisma/client";
import { httpAuditLogListQuery, type HttpAuditLogListQuery, type HttpAuditLogListSortField } from "@workspace/shared";

import { fetchListPage } from "../../../platform/persistence/list-page";
import { timestampIdKeyset, type ListKeyset } from "../../../platform/persistence/list-query/keyset-cursor";
import { buildListOrder, type ListOrder, type SortColumns } from "../../../platform/persistence/list-query/list-order";
import {
	fieldWhere,
	toPrismaComparableFilter,
	toPrismaEqualityFilter,
	toPrismaNullableEqualityFilter,
	toPrismaNullableStringFilter,
	toPrismaStringFilter,
} from "../../../platform/persistence/list-query/prisma-filter";
import type { RepositoryListResult } from "../../../platform/persistence/types";

/** Every `audit_logs` column except the (up to 16 KiB each) payloads — what a list page reads. */
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
	organizationId: true,
	storeId: true,
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

/** A user an audit row names, as the viewer shows it. */
export type AuditLogUserRow = Prisma.UserGetPayload<{ select: { id: true; email: true; fullName: true } }>;

/** An organization an audit row is scoped to, as the viewer shows it. */
export type AuditLogOrganizationRow = Prisma.OrganizationGetPayload<{ select: { id: true; displayName: true } }>;

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
			...fieldWhere(toPrismaNullableEqualityFilter(filter?.organizationId), (organizationId) => ({ organizationId })),
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
 * Read-side access to the global HTTP audit trail (`audit_logs`) for the admin
 * viewer. The table is append-only and bypass-only under RLS: this repository
 * never writes, and every read runs on the caller's `audit.http_request.read`
 * system-operation transaction (`db`). It also resolves the user and
 * organization names the rows reference — there are no foreign keys, so a
 * reference that no longer resolves is simply absent from the result.
 */
@Injectable()
export class HttpAuditLogRepository {
	/** One page of rows matching the (already validated) list query, payloads excluded. */
	public async list(query: HttpAuditLogListQuery, db: Prisma.TransactionClient): Promise<RepositoryListResult<AuditLogSummaryRow>> {
		return fetchListPage(query, {
			where: buildHttpAuditLogListWhere(query),
			order: buildHttpAuditLogListOrder(query),
			keyset: AUDIT_LOG_LIST_KEYSET,
			and: (left, right) => ({ AND: [left, right] }),
			count: (where) => db.auditLog.count({ where }),
			findMany: (args) => db.auditLog.findMany({ ...args, select: AUDIT_LOG_SUMMARY_SELECT }),
		});
	}

	/** One complete row, or `null` when no row has this id. */
	public async findById(id: string, db: Prisma.TransactionClient): Promise<AuditLog | null> {
		return db.auditLog.findUnique({ where: { id } });
	}

	/** The users with these ids — soft-deleted ones included: an audit record outlives its actor. */
	public async findUsers(ids: readonly string[], db: Prisma.TransactionClient): Promise<readonly AuditLogUserRow[]> {
		if (ids.length === 0) {
			return [];
		}
		return db.user.findMany({ where: { id: { in: [...ids] } }, select: { id: true, email: true, fullName: true } });
	}

	/** The organizations with these ids — soft-deleted ones included. */
	public async findOrganizations(ids: readonly string[], db: Prisma.TransactionClient): Promise<readonly AuditLogOrganizationRow[]> {
		if (ids.length === 0) {
			return [];
		}
		return db.organization.findMany({ where: { id: { in: [...ids] } }, select: { id: true, displayName: true } });
	}
}
