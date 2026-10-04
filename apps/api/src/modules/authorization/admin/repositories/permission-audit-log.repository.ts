import { Injectable } from "@nestjs/common";
import type { PermissionAuditLog, Prisma } from "@prisma/client";
import { auditLogListQuery, type AuditLogListSortField, type AuditLogQueryInput } from "@workspace/shared";

import { fetchListPage } from "../../../../platform/persistence/list-page";
import { timestampIdKeyset, type ListKeyset } from "../../../../platform/persistence/list-query/keyset-cursor";
import { buildListOrder, type ListOrder, type SortColumns } from "../../../../platform/persistence/list-query/list-order";
import { fieldWhere, toPrismaComparableFilter, toPrismaEqualityFilter, toPrismaStringFilter } from "../../../../platform/persistence/list-query/prisma-filter";
import type { RepositoryListResult } from "../../../../platform/persistence/types";

// ── List query → Prisma (explicit field → column mapping; see docs/technical/api/list-queries.md) ──

const AUDIT_LOG_SORT_COLUMNS: SortColumns<AuditLogListSortField, Prisma.PermissionAuditLogOrderByWithRelationInput> = {
	createdAt: (direction) => ({ createdAt: direction }),
};

/** Keyset for the default order (`createdAt desc, id desc`). */
const AUDIT_LOG_LIST_KEYSET: ListKeyset<PermissionAuditLog, Prisma.PermissionAuditLogWhereInput> = timestampIdKeyset(
	(row: PermissionAuditLog) => ({ at: Number(row.createdAt), id: row.id }),
	({ at, id }): Prisma.PermissionAuditLogWhereInput => ({ OR: [{ createdAt: { lt: at } }, { createdAt: at, id: { lt: id } }] }),
);

/** Non-deleted rows + the filter AST, one explicit column per whitelisted field. */
export function buildAuditLogListWhere(query: AuditLogQueryInput): Prisma.PermissionAuditLogWhereInput {
	const filter = query.filter;
	return {
		AND: [
			{ isDeleted: false },
			...fieldWhere(toPrismaStringFilter(filter?.action), (action) => ({ action })),
			...fieldWhere(toPrismaEqualityFilter(filter?.actorId), (actorId) => ({ actorId })),
			...fieldWhere(toPrismaEqualityFilter(filter?.targetUserId), (targetUserId) => ({ targetUserId })),
			...fieldWhere(toPrismaEqualityFilter(filter?.targetRoleId), (targetRoleId) => ({ targetRoleId })),
			...fieldWhere(toPrismaComparableFilter(filter?.createdAt), (createdAt) => ({ createdAt })),
		],
	};
}

export function buildAuditLogListOrder(query: AuditLogQueryInput): ListOrder<Prisma.PermissionAuditLogOrderByWithRelationInput> {
	return buildListOrder(auditLogListQuery.resolveSort(query.sort), {
		columns: AUDIT_LOG_SORT_COLUMNS,
		tieBreaker: (direction) => ({ id: direction }),
	});
}

/**
 * Read-side access to `permission_audit_logs` for the admin audit viewer.
 * Append-only, bypass-only table: this repository never writes, and reads run
 * on the caller's `authorization.audit_log.read` system-operation transaction.
 */
@Injectable()
export class PermissionAuditLogRepository {
	/** One page of non-deleted entries matching the (already validated) list query. */
	public async list(query: AuditLogQueryInput, db: Prisma.TransactionClient): Promise<RepositoryListResult<PermissionAuditLog>> {
		return fetchListPage(query, {
			where: buildAuditLogListWhere(query),
			order: buildAuditLogListOrder(query),
			keyset: AUDIT_LOG_LIST_KEYSET,
			and: (left, right) => ({ AND: [left, right] }),
			count: (where) => db.permissionAuditLog.count({ where }),
			findMany: (args) => db.permissionAuditLog.findMany(args),
		});
	}
}
