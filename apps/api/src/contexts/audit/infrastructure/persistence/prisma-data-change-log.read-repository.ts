import type { Prisma } from "@prisma/client";
import {
	dataChangeLogListQuery,
	type DataChangeLogDetail,
	type DataChangeLogListQuery,
	type DataChangeLogListSortField,
	type DataChangeLogSummary,
	type PaginatedServiceResult,
} from "@workspace/shared";
import { z } from "zod";

import type { DataChangeLogReader } from "../../application/ports/audit-read-session.port";
import { fetchListPage, mapListResult, toPaginatedServiceResult } from "../../../../platform/infrastructure/persistence/list-page";
import { defineKeyset, type ListKeyset } from "../../../../platform/infrastructure/persistence/list-query/keyset-cursor";
import { buildListOrder, type ListOrder, type SortColumns } from "../../../../platform/infrastructure/persistence/list-query/list-order";
import {
	fieldWhere,
	toPrismaComparableFilter,
	toPrismaEqualityFilter,
	toPrismaNullableEqualityFilter,
} from "../../../../platform/infrastructure/persistence/list-query/prisma-filter";
import { dataChangeLogReferenceIds, toDataChangeLogDetail, toDataChangeLogSummary } from "./data-change-log.mapper";
import type { PrismaAuditReferenceReader } from "./prisma-audit-reference.reader";

/** Every `DataChangeLog` column except the row images (up to 16 KiB per value) and connection details — what a list page reads. */
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
 * indexes (`table_name, row_id`, `correlationId`, `actorUserId`,
 * `organizationId`, `actorKind`, `transactionId`, `occurredAt`).
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
 * Read-side access to the row-level data-change trail (`DataChangeLog`,
 * ADR 051) for the admin viewer. The table is written only by the capture
 * triggers and is bypass-only under RLS: this repository never writes, and is
 * bound to one `audit.data_change.read` system-operation transaction (`db`).
 * The names its rows reference are resolved by
 * {@link PrismaAuditReferenceReader} on the same transaction.
 */
export class PrismaDataChangeLogReadRepository implements DataChangeLogReader {
	public constructor(
		private readonly db: Prisma.TransactionClient,
		private readonly references: PrismaAuditReferenceReader,
	) {}

	/** One page of rows matching the (already validated) list query, row images excluded, actor and organization names resolved. */
	public async list(query: DataChangeLogListQuery): Promise<PaginatedServiceResult<DataChangeLogSummary>> {
		const rows = await fetchListPage(query, {
			where: buildDataChangeLogListWhere(query),
			order: buildDataChangeLogListOrder(query),
			keyset: DATA_CHANGE_LOG_LIST_KEYSET,
			and: (left, right) => ({ AND: [left, right] }),
			count: (where) => this.db.dataChangeLog.count({ where }),
			findMany: (args) => this.db.dataChangeLog.findMany({ ...args, select: DATA_CHANGE_LOG_SUMMARY_SELECT }),
		});
		const references = await this.references.load(dataChangeLogReferenceIds(rows.items));
		return toPaginatedServiceResult(
			mapListResult(rows, (row: DataChangeLogSummaryRow): DataChangeLogSummary => toDataChangeLogSummary(row, references)),
			query,
		);
	}

	/** One complete change record, or `null` when no row has this id. */
	public async findById(id: string): Promise<DataChangeLogDetail | null> {
		const row = await this.db.dataChangeLog.findUnique({ where: { id } });
		return row === null ? null : toDataChangeLogDetail(row, await this.references.load(dataChangeLogReferenceIds([row])));
	}
}
