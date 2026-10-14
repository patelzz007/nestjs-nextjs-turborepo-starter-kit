import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import {
	AUDIT_TRAIL_MAX_LISTED_TABLES,
	AuditTrailEntryKindSchema,
	auditTrailListQuery,
	type AuditTrailEntryKind,
	type AuditTrailListQuery,
	type AuditTrailListSortField,
} from "@workspace/shared";
import { z } from "zod";

import { fetchListPage } from "../../../platform/persistence/list-page";
import { timestampIdKeyset, type ListKeyset } from "../../../platform/persistence/list-query/keyset-cursor";
import { buildListOrder, type ListOrder, type SortColumns } from "../../../platform/persistence/list-query/list-order";
import type { RepositoryListResult } from "../../../platform/persistence/types";
import { DATA_CHANGE_LOG_SUMMARY_SELECT, type DataChangeLogSummaryRow } from "./data-change-log.repository";
import { AUDIT_LOG_SUMMARY_SELECT, type AuditLogSummaryRow } from "./http-audit-log.repository";

// ── The timeline: both audit stores as one ordered list ─────────────────────
//
// One page of the audit trail is a UNION ALL of two entry sources, each
// filtered by the parts of the list query that apply to it:
//   - REQUEST    — `audit_logs` rows (one per HTTP request);
//   - BACKGROUND — `data_change_logs` rows NO request made (no `audit_logs` row
//     shares their correlation id), grouped per correlation id (one job /
//     operation / seed run); changes without one are grouped per database
//     transaction (a manual SQL statement, a migration). The entry's id is its
//     first change's id (write order).
// The union yields only (kind, id, occurred_at); the page's rows are then read
// with the ordinary typed selects and joined to their change summaries.

/** One timeline position: which store, which record, when. */
export interface AuditTrailEntryRow {
	readonly kind: AuditTrailEntryKind;
	readonly id: string;
	readonly occurredAt: number;
}

const AuditTrailEntryRowSchema = z.object({ kind: AuditTrailEntryKindSchema, id: z.string(), occurred_at: z.coerce.number().int().nonnegative() });
const CountRowSchema = z.tuple([z.object({ total: z.coerce.number().int().nonnegative() })]);
const ChangeSummaryRowSchema = z.object({ group_key: z.string(), change_count: z.coerce.number().int().nonnegative(), tables: z.array(z.string()) });

/** Prefix of the group key of changes with no correlation id: `tx:<transaction id>`. */
const TRANSACTION_GROUP_PREFIX = "tx:";

/** The group a change belongs to on the timeline: its correlation id, else its transaction. */
export function dataChangeGroupKey(change: { readonly correlationId: string | null; readonly transactionId: bigint }): string {
	return change.correlationId ?? `${TRANSACTION_GROUP_PREFIX}${change.transactionId.toString()}`;
}

/** {@link dataChangeGroupKey} in SQL (alias `d`). */
function groupKeySql(): Prisma.Sql {
	return Prisma.sql`COALESCE(d.correlation_id, ${TRANSACTION_GROUP_PREFIX} || d.transaction_id::text)`;
}

/** How many rows a request / job changed, and where. */
export interface ChangeSummary {
	readonly changeCount: number;
	readonly changedTables: readonly string[];
}

/** The change summaries of a page's groups, keyed by {@link dataChangeGroupKey} (a request's: its correlation id). */
export type ChangeSummaries = ReadonlyMap<string, ChangeSummary>;

/** `AND` of every condition; `TRUE` for none. */
function allOf(conditions: readonly Prisma.Sql[]): Prisma.Sql {
	return conditions.length === 0 ? Prisma.sql`TRUE` : Prisma.join([...conditions], " AND ");
}

/** `%`, `_` and `\` matched literally inside a LIKE pattern. */
function likeLiteral(value: string): string {
	return value.replace(/[\\%_]/g, (character: string): string => `\\${character}`);
}

/** True when the query sets a filter only HTTP requests have — background entries are then out. */
function hasRequestOnlyFilter(filter: AuditTrailListQuery["filter"]): boolean {
	return [filter?.outcome, filter?.method, filter?.authMethod, filter?.deviceType, filter?.ipScope].some((value) => value !== undefined);
}

/** The `audit_logs` conditions of a query (alias `a`); `FALSE` when the query keeps background entries only. */
export function requestEntryConditions(query: AuditTrailListQuery): Prisma.Sql {
	const filter = query.filter;
	if (filter?.kind?.eq === "BACKGROUND" || filter?.actorKind !== undefined) {
		return Prisma.sql`FALSE`;
	}
	const changedRow: Prisma.Sql[] = [
		...(filter?.tableName?.eq === undefined ? [] : [Prisma.sql`d.table_name = ${filter.tableName.eq}`]),
		...(filter?.rowId?.eq === undefined ? [] : [Prisma.sql`d.row_id = ${filter.rowId.eq}`]),
	];
	return allOf([
		...(filter?.actorUserId?.eq === undefined ? [] : [Prisma.sql`a.actor_user_id = ${filter.actorUserId.eq}`]),
		...(filter?.organizationId?.eq === undefined ? [] : [Prisma.sql`a.organization_id = ${filter.organizationId.eq}`]),
		...(filter?.correlationId?.eq === undefined ? [] : [Prisma.sql`a.correlation_id = ${filter.correlationId.eq}`]),
		...(filter?.occurredAt?.gte === undefined ? [] : [Prisma.sql`a.occurred_at >= ${filter.occurredAt.gte}`]),
		...(filter?.occurredAt?.lte === undefined ? [] : [Prisma.sql`a.occurred_at <= ${filter.occurredAt.lte}`]),
		...(filter?.outcome?.eq === undefined ? [] : [Prisma.sql`a.outcome = ${filter.outcome.eq}::"AuditOutcome"`]),
		...(filter?.method?.eq === undefined ? [] : [Prisma.sql`a.method = ${filter.method.eq}`]),
		...(filter?.authMethod?.eq === undefined ? [] : [Prisma.sql`a.auth_method = ${filter.authMethod.eq}::"AuditAuthMethod"`]),
		...(filter?.deviceType?.eq === undefined ? [] : [Prisma.sql`a.device_type = ${filter.deviceType.eq}::"DeviceType"`]),
		...(filter?.ipScope?.eq === undefined ? [] : [Prisma.sql`a.ip_scope = ${filter.ipScope.eq}::"IpAddressScope"`]),
		...(changedRow.length === 0 ? [] : [Prisma.sql`EXISTS (SELECT 1 FROM public.data_change_logs d WHERE d.correlation_id = a.correlation_id AND ${allOf(changedRow)})`]),
		...(query.search === undefined
			? []
			: [Prisma.sql`(a.path ILIKE ${`%${likeLiteral(query.search)}%`} OR a.endpoint ILIKE ${`%${likeLiteral(query.search)}%`} OR a.correlation_id = ${query.search})`]),
	]);
}

/** The `data_change_logs` row conditions (alias `d`) and group conditions (`HAVING`); `null` when the query keeps requests only. */
export function backgroundEntryConditions(query: AuditTrailListQuery): { readonly rows: Prisma.Sql; readonly groups: Prisma.Sql } | null {
	const filter = query.filter;
	if (filter?.kind?.eq === "REQUEST" || hasRequestOnlyFilter(filter)) {
		return null;
	}
	const changedRow: Prisma.Sql[] = [
		...(filter?.tableName?.eq === undefined ? [] : [Prisma.sql`d.table_name = ${filter.tableName.eq}`]),
		...(filter?.rowId?.eq === undefined ? [] : [Prisma.sql`d.row_id = ${filter.rowId.eq}`]),
	];
	return {
		rows: allOf([
			// Changes made by an HTTP request belong to that request's entry.
			Prisma.sql`NOT EXISTS (SELECT 1 FROM public.audit_logs a WHERE a.correlation_id = d.correlation_id)`,
			...(filter?.actorUserId?.eq === undefined ? [] : [Prisma.sql`d.actor_user_id = ${filter.actorUserId.eq}`]),
			...(filter?.organizationId?.eq === undefined ? [] : [Prisma.sql`d.organization_id = ${filter.organizationId.eq}`]),
			...(filter?.correlationId?.eq === undefined ? [] : [Prisma.sql`d.correlation_id = ${filter.correlationId.eq}`]),
			...(filter?.occurredAt?.gte === undefined ? [] : [Prisma.sql`d.occurred_at >= ${filter.occurredAt.gte}`]),
			...(filter?.occurredAt?.lte === undefined ? [] : [Prisma.sql`d.occurred_at <= ${filter.occurredAt.lte}`]),
			...(filter?.actorKind?.eq === undefined ? [] : [Prisma.sql`d.actor_kind = ${filter.actorKind.eq}::"DataChangeActorKind"`]),
		]),
		// A job is kept whole when ANY of its changes matches the row / search conditions.
		groups: allOf([
			...(changedRow.length === 0 ? [] : [Prisma.sql`bool_or(${allOf(changedRow)})`]),
			...(query.search === undefined
				? []
				: [Prisma.sql`bool_or(d.table_name LIKE ${`${likeLiteral(query.search)}%`} OR d.row_id = ${query.search} OR d.correlation_id = ${query.search})`]),
		]),
	};
}

/** The timeline as a derived table `t (kind, id, occurred_at)`. */
export function buildAuditTrailTimeline(query: AuditTrailListQuery): Prisma.Sql {
	const requests: Prisma.Sql = Prisma.sql`SELECT 'REQUEST'::text AS kind, a.id::text AS id, a.occurred_at FROM public.audit_logs a WHERE ${requestEntryConditions(query)}`;
	const background = backgroundEntryConditions(query);
	if (background === null) {
		return requests;
	}
	return Prisma.sql`${requests}
		UNION ALL
		SELECT 'BACKGROUND'::text AS kind, (array_agg(d.id::text ORDER BY d.change_sequence))[1] AS id, min(d.occurred_at) AS occurred_at
		  FROM public.data_change_logs d
		 WHERE ${background.rows}
		 GROUP BY ${groupKeySql()}
		HAVING ${background.groups}`;
}

const SQL_DIRECTION: Readonly<Record<"asc" | "desc", Prisma.Sql>> = { asc: Prisma.sql`ASC`, desc: Prisma.sql`DESC` };

const AUDIT_TRAIL_SORT_COLUMNS: SortColumns<AuditTrailListSortField, Prisma.Sql> = {
	occurredAt: (direction) => Prisma.sql`t.occurred_at ${SQL_DIRECTION[direction]}`,
};

export function buildAuditTrailOrder(query: AuditTrailListQuery): ListOrder<Prisma.Sql> {
	return buildListOrder(auditTrailListQuery.resolveSort(query.sort), {
		columns: AUDIT_TRAIL_SORT_COLUMNS,
		tieBreaker: (direction) => Prisma.sql`t.id ${SQL_DIRECTION[direction]}`,
	});
}

/** Keyset for the default order (`occurred_at desc, id desc`) over the timeline. */
const AUDIT_TRAIL_KEYSET: ListKeyset<AuditTrailEntryRow, Prisma.Sql> = timestampIdKeyset(
	(row: AuditTrailEntryRow) => ({ at: row.occurredAt, id: row.id }),
	({ at, id }): Prisma.Sql => Prisma.sql`(t.occurred_at < ${at} OR (t.occurred_at = ${at} AND t.id < ${id}))`,
);

/**
 * Read-side access to the audit trail — both bypass-only audit stores as one
 * timeline (ADR 025 + ADR 051). Never writes; every read runs on the caller's
 * `audit.trail.read` system-operation transaction (`db`). Parameters are
 * always bound (`Prisma.sql`), never interpolated.
 */
@Injectable()
export class AuditTrailRepository {
	/** One page of timeline positions (offset or keyset, like every list). */
	public async listEntries(query: AuditTrailListQuery, db: Prisma.TransactionClient): Promise<RepositoryListResult<AuditTrailEntryRow>> {
		const timeline: Prisma.Sql = buildAuditTrailTimeline(query);
		return fetchListPage(query, {
			where: Prisma.sql`TRUE`,
			order: buildAuditTrailOrder(query),
			keyset: AUDIT_TRAIL_KEYSET,
			and: (left, right) => Prisma.sql`${left} AND ${right}`,
			count: async (where) => {
				const [row] = CountRowSchema.parse(await db.$queryRaw`SELECT count(*) AS total FROM (${timeline}) t WHERE ${where}`);
				return row.total;
			},
			findMany: async ({ where, orderBy, take, skip }) => {
				const rows =
					await db.$queryRaw`SELECT t.kind, t.id, t.occurred_at FROM (${timeline}) t WHERE ${where} ORDER BY ${Prisma.join(orderBy, ", ")} LIMIT ${take} OFFSET ${skip ?? 0}`;
				return z
					.array(AuditTrailEntryRowSchema)
					.parse(rows)
					.map((row): AuditTrailEntryRow => ({ kind: row.kind, id: row.id, occurredAt: row.occurred_at }));
			},
		});
	}

	/** The request rows of a page. */
	public async findRequests(ids: readonly string[], db: Prisma.TransactionClient): Promise<readonly AuditLogSummaryRow[]> {
		if (ids.length === 0) {
			return [];
		}
		return db.auditLog.findMany({ where: { id: { in: [...ids] } }, select: AUDIT_LOG_SUMMARY_SELECT });
	}

	/** The first change of each background entry of a page. */
	public async findChanges(ids: readonly string[], db: Prisma.TransactionClient): Promise<readonly DataChangeLogSummaryRow[]> {
		if (ids.length === 0) {
			return [];
		}
		return db.dataChangeLog.findMany({ where: { id: { in: [...ids] } }, select: DATA_CHANGE_LOG_SUMMARY_SELECT });
	}

	/** How many rows each group changed, and in which tables (alphabetical, capped): by correlation id, and by transaction for uncorrelated changes. */
	public async summarizeChanges(correlationIds: readonly string[], transactionIds: readonly bigint[], db: Prisma.TransactionClient): Promise<ChangeSummaries> {
		if (correlationIds.length === 0 && transactionIds.length === 0) {
			return new Map();
		}
		const rows = await db.$queryRaw`SELECT ${groupKeySql()} AS group_key, count(*) AS change_count,
			(array_agg(DISTINCT d.table_name ORDER BY d.table_name))[1:${AUDIT_TRAIL_MAX_LISTED_TABLES}] AS tables
			FROM public.data_change_logs d
			WHERE d.correlation_id = ANY(${[...correlationIds]}) OR (d.correlation_id IS NULL AND d.transaction_id = ANY(${[...transactionIds]}))
			GROUP BY 1`;
		return new Map(
			z
				.array(ChangeSummaryRowSchema)
				.parse(rows)
				.map((row): [string, ChangeSummary] => [row.group_key, { changeCount: row.change_count, changedTables: row.tables }]),
		);
	}
}
