import { Injectable } from "@nestjs/common";
import type { DataChangeLog, Prisma } from "@prisma/client";
import { dataChangeLogListQuery, type DataChangeLogListQuery, type DataChangeLogListSortField } from "@workspace/shared";
import { z } from "zod";

import { fetchListPage } from "../../../platform/persistence/list-page";
import { defineKeyset, type ListKeyset } from "../../../platform/persistence/list-query/keyset-cursor";
import { buildListOrder, type ListOrder, type SortColumns } from "../../../platform/persistence/list-query/list-order";
import { fieldWhere, toPrismaComparableFilter, toPrismaEqualityFilter, toPrismaNullableEqualityFilter } from "../../../platform/persistence/list-query/prisma-filter";
import type { RepositoryListResult } from "../../../platform/persistence/types";

/** Every `data_change_logs` column except the row images (up to 16 KiB per value) and connection details — what a list page reads. */
export const DATA_CHANGE_LOG_SUMMARY_SELECT = {
	id: true,
	changeSequence: true,
	occurredAt: true,
	transactionId: true,
	tableName: true,
	operation: true,
	rowId: true,
	changedColumns: true,
	actorKind: true,
	actorUserId: true,
	organizationId: true,
	apiKeyId: true,
	systemOperation: true,
	correlationId: true,
	databaseRole: true,
} satisfies Prisma.DataChangeLogSelect;

/** One list row (no row images, no connection details). */
export type DataChangeLogSummaryRow = Prisma.DataChangeLogGetPayload<{ select: typeof DATA_CHANGE_LOG_SUMMARY_SELECT }>;

// ── List query → Prisma (explicit field → column mapping; see docs/technical/api/list-queries.md) ──

const DATA_CHANGE_LOG_SORT_COLUMNS: SortColumns<DataChangeLogListSortField, Prisma.DataChangeLogOrderByWithRelationInput> = {
	occurredAt: (direction) => ({ occurredAt: direction }),
};

/** Position of a row in the default order (`occurredAt desc, changeSequence desc`). */
const DataChangeLogPositionSchema = z.object({ at: z.number().int().nonnegative(), sequence: z.number().int().positive() }).strict();

/**
 * Keyset for the default order. The tie-breaker is the write sequence, not the
 * random id: changes in the same millisecond (one transaction's rows) keep the
 * exact order they were written in.
 */
const DATA_CHANGE_LOG_LIST_KEYSET: ListKeyset<DataChangeLogSummaryRow, Prisma.DataChangeLogWhereInput> = defineKeyset({
	position: DataChangeLogPositionSchema,
	read: (row: DataChangeLogSummaryRow) => ({ at: Number(row.occurredAt), sequence: Number(row.changeSequence) }),
	after: ({ at, sequence }): Prisma.DataChangeLogWhereInput => ({ OR: [{ occurredAt: { lt: at } }, { occurredAt: at, changeSequence: { lt: sequence } }] }),
});

/**
 * The filter AST + search, one explicit column per whitelisted field. No
 * soft-delete condition: change records are append-only and never deleted.
 * Identifiers (table name, system operation, correlation id, row id) are
 * compared EXACTLY — a case-insensitive comparison could not use the btree
 * indexes (`table_name, row_id`, `correlation_id`, `actor_user_id`,
 * `organization_id`, `actor_kind`, `transaction_id`, `occurred_at`).
 */
export function buildDataChangeLogListWhere(query: DataChangeLogListQuery): Prisma.DataChangeLogWhereInput {
	const filter = query.filter;
	return {
		AND: [
			...fieldWhere(toPrismaEqualityFilter(filter?.tableName), (tableName) => ({ tableName })),
			...fieldWhere(toPrismaEqualityFilter(filter?.operation), (operation) => ({ operation })),
			...fieldWhere(toPrismaEqualityFilter(filter?.actorKind), (actorKind) => ({ actorKind })),
			...fieldWhere(toPrismaNullableEqualityFilter(filter?.actorUserId), (actorUserId) => ({ actorUserId })),
			...fieldWhere(toPrismaNullableEqualityFilter(filter?.organizationId), (organizationId) => ({ organizationId })),
			...fieldWhere(toPrismaNullableEqualityFilter(filter?.apiKeyId), (apiKeyId) => ({ apiKeyId })),
			...fieldWhere(toPrismaNullableEqualityFilter(filter?.systemOperation), (systemOperation) => ({ systemOperation })),
			...fieldWhere(toPrismaNullableEqualityFilter(filter?.correlationId), (correlationId) => ({ correlationId })),
			...fieldWhere(toPrismaNullableEqualityFilter(filter?.rowId), (rowId) => ({ rowId })),
			...fieldWhere(toPrismaComparableFilter(filter?.transactionId), (transactionId) => ({ transactionId })),
			...fieldWhere(toPrismaComparableFilter(filter?.occurredAt), (occurredAt) => ({ occurredAt })),
			...(query.search !== undefined
				? [
						{
							OR: [{ tableName: { startsWith: query.search } }, { rowId: { equals: query.search } }, { correlationId: { equals: query.search } }],
						} satisfies Prisma.DataChangeLogWhereInput,
					]
				: []),
		],
	};
}

export function buildDataChangeLogListOrder(query: DataChangeLogListQuery): ListOrder<Prisma.DataChangeLogOrderByWithRelationInput> {
	return buildListOrder(dataChangeLogListQuery.resolveSort(query.sort), {
		columns: DATA_CHANGE_LOG_SORT_COLUMNS,
		tieBreaker: (direction) => ({ changeSequence: direction }),
	});
}

/**
 * Read-side access to the row-level data-change trail (`data_change_logs`,
 * ADR 051) for the admin viewer. The table is written only by the capture
 * triggers and is bypass-only under RLS: this repository never writes, and
 * every read runs on the caller's `audit.data_change.read` system-operation
 * transaction (`db`). The names its rows reference are resolved by
 * `AuditReferenceRepository`.
 */
@Injectable()
export class DataChangeLogRepository {
	/** One page of rows matching the (already validated) list query, row images excluded. */
	public async list(query: DataChangeLogListQuery, db: Prisma.TransactionClient): Promise<RepositoryListResult<DataChangeLogSummaryRow>> {
		return fetchListPage(query, {
			where: buildDataChangeLogListWhere(query),
			order: buildDataChangeLogListOrder(query),
			keyset: DATA_CHANGE_LOG_LIST_KEYSET,
			and: (left, right) => ({ AND: [left, right] }),
			count: (where) => db.dataChangeLog.count({ where }),
			findMany: (args) => db.dataChangeLog.findMany({ ...args, select: DATA_CHANGE_LOG_SUMMARY_SELECT }),
		});
	}

	/** One complete row, or `null` when no row has this id. */
	public async findById(id: string, db: Prisma.TransactionClient): Promise<DataChangeLog | null> {
		return db.dataChangeLog.findUnique({ where: { id } });
	}
}
