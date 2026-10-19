import { Prisma } from "@prisma/client";
import {
	AUDIT_TRAIL_MAX_LISTED_TABLES,
	AuditTrailEntryKindSchema,
	auditTrailListQuery,
	type AuditTrailEntry,
	type AuditTrailEntryKind,
	type AuditTrailListQuery,
	type AuditTrailListSortField,
	type PaginatedServiceResult,
} from "@workspace/shared";
import { z } from "zod";

import type { AuditTrailReader } from "../../application/ports/audit-read-session.port";
import { fetchListPage, toPaginatedServiceResult } from "../../../../platform/infrastructure/persistence/list-page";
import { timestampIdKeyset, type ListKeyset } from "../../../../platform/infrastructure/persistence/list-query/keyset-cursor";
import { buildListOrder, type ListOrder, type SortColumns } from "../../../../platform/infrastructure/persistence/list-query/list-order";
import type { RepositoryListResult } from "../../../../platform/infrastructure/persistence/types";
import { auditTrailChangeGroups, auditTrailReferenceIds, toAuditTrailEntry, type AuditTrailPageRows } from "./audit-trail.mapper";
import type { PrismaAuditReferenceReader } from "./prisma-audit-reference.reader";
import { DATA_CHANGE_LOG_SUMMARY_SELECT, type DataChangeLogSummaryRow } from "./prisma-data-change-log.read-repository";
import { AUDIT_LOG_SUMMARY_SELECT, type AuditLogSummaryRow } from "./prisma-http-audit-log.read-repository";

// ── The timeline: both audit stores as one ordered list ─────────────────────
//
// One page of the audit trail is a UNION ALL of two entry sources, each
// filtered by the parts of the list query that apply to it:
//   - REQUEST    — `AuditLog` rows (one per HTTP request);
//   - BACKGROUND — `DataChangeLog` rows NO request made (no `AuditLog` row
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

const AuditTrailEntryRowSchema = z.object({ kind: AuditTrailEntryKindSchema, id: z.string(), occurredAt: z.coerce.number().int().nonnegative() });
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
	return Prisma.sql`COALESCE(d."correlationId", ${TRANSACTION_GROUP_PREFIX} || d."transactionId"::text)`;
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

/**
 * The search matched against who acted: the actor's user id exactly, or any
 * account whose email or full name contains it. The audit stores keep bare
 * ids (a record outlives its actor), so the people are matched in `User` —
 * deleted accounts included, because the id on the record is the fact.
 */
export function actorSearchSql(actorColumn: Prisma.Sql, search: string): Prisma.Sql {
	const pattern = `%${likeLiteral(search)}%`;
	return Prisma.sql`(${actorColumn} = ${search} OR ${actorColumn} IN (SELECT u.id FROM public."User" u WHERE u.email ILIKE ${pattern} OR u."fullName" ILIKE ${pattern}))`;
}

/** True when the query sets a filter only HTTP requests have — background entries are then out. */
function hasRequestOnlyFilter(filter: AuditTrailListQuery["filter"]): boolean {
	return [filter?.outcome, filter?.method, filter?.authMethod, filter?.deviceType, filter?.ipScope].some((value) => value !== undefined);
}

/** The `AuditLog` conditions of a query (alias `a`); `FALSE` when the query keeps background entries only. */
export function requestEntryConditions(query: AuditTrailListQuery): Prisma.Sql {
	const filter = query.filter;
	if (filter?.kind?.eq === "BACKGROUND" || filter?.actorKind !== undefined) {
		return Prisma.sql`FALSE`;
	}
	const changedRow: Prisma.Sql[] = [
		...(filter?.tableName?.eq === undefined ? [] : [Prisma.sql`d."tableName" = ${filter.tableName.eq}`]),
		...(filter?.rowId?.eq === undefined ? [] : [Prisma.sql`d."rowId" = ${filter.rowId.eq}`]),
	];
	return allOf([
		...(filter?.actorUserId?.eq === undefined ? [] : [Prisma.sql`a."actorUserId" = ${filter.actorUserId.eq}`]),
		...(filter?.organizationId?.eq === undefined ? [] : [Prisma.sql`a."organizationId" = ${filter.organizationId.eq}`]),
		...(filter?.correlationId?.eq === undefined ? [] : [Prisma.sql`a."correlationId" = ${filter.correlationId.eq}`]),
		...(filter?.occurredAt?.gte === undefined ? [] : [Prisma.sql`a."occurredAt" >= ${filter.occurredAt.gte}`]),
		...(filter?.occurredAt?.lte === undefined ? [] : [Prisma.sql`a."occurredAt" <= ${filter.occurredAt.lte}`]),
		...(filter?.outcome?.eq === undefined ? [] : [Prisma.sql`a.outcome = ${filter.outcome.eq}::"AuditOutcome"`]),
		...(filter?.method?.eq === undefined ? [] : [Prisma.sql`a.method = ${filter.method.eq}`]),
		...(filter?.authMethod?.eq === undefined ? [] : [Prisma.sql`a."authMethod" = ${filter.authMethod.eq}::"AuditAuthMethod"`]),
		...(filter?.deviceType?.eq === undefined ? [] : [Prisma.sql`a."deviceType" = ${filter.deviceType.eq}::"DeviceType"`]),
		...(filter?.ipScope?.eq === undefined ? [] : [Prisma.sql`a."ipScope" = ${filter.ipScope.eq}::"IpAddressScope"`]),
		...(changedRow.length === 0 ? [] : [Prisma.sql`EXISTS (SELECT 1 FROM public."DataChangeLog" d WHERE d."correlationId" = a."correlationId" AND ${allOf(changedRow)})`]),
		...(query.search === undefined
			? []
			: [
					Prisma.sql`(a.path ILIKE ${`%${likeLiteral(query.search)}%`} OR a.endpoint ILIKE ${`%${likeLiteral(query.search)}%`} OR a."correlationId" = ${query.search} OR ${actorSearchSql(Prisma.sql`a."actorUserId"`, query.search)})`,
				]),
	]);
}

/** The `DataChangeLog` row conditions (alias `d`) and group conditions (`HAVING`); `null` when the query keeps requests only. */
export function backgroundEntryConditions(query: AuditTrailListQuery): { readonly rows: Prisma.Sql; readonly groups: Prisma.Sql } | null {
	const filter = query.filter;
	if (filter?.kind?.eq === "REQUEST" || hasRequestOnlyFilter(filter)) {
		return null;
	}
	const changedRow: Prisma.Sql[] = [
		...(filter?.tableName?.eq === undefined ? [] : [Prisma.sql`d."tableName" = ${filter.tableName.eq}`]),
		...(filter?.rowId?.eq === undefined ? [] : [Prisma.sql`d."rowId" = ${filter.rowId.eq}`]),
	];
	return {
		rows: allOf([
			// Changes made by an HTTP request belong to that request's entry.
			Prisma.sql`NOT EXISTS (SELECT 1 FROM public."AuditLog" a WHERE a."correlationId" = d."correlationId")`,
			...(filter?.actorUserId?.eq === undefined ? [] : [Prisma.sql`d."actorUserId" = ${filter.actorUserId.eq}`]),
			...(filter?.organizationId?.eq === undefined ? [] : [Prisma.sql`d."organizationId" = ${filter.organizationId.eq}`]),
			...(filter?.correlationId?.eq === undefined ? [] : [Prisma.sql`d."correlationId" = ${filter.correlationId.eq}`]),
			...(filter?.occurredAt?.gte === undefined ? [] : [Prisma.sql`d."occurredAt" >= ${filter.occurredAt.gte}`]),
			...(filter?.occurredAt?.lte === undefined ? [] : [Prisma.sql`d."occurredAt" <= ${filter.occurredAt.lte}`]),
			...(filter?.actorKind?.eq === undefined ? [] : [Prisma.sql`d."actorKind" = ${filter.actorKind.eq}::"DataChangeActorKind"`]),
		]),
		// A job is kept whole when ANY of its changes matches the row / search conditions.
		groups: allOf([
			...(changedRow.length === 0 ? [] : [Prisma.sql`bool_or(${allOf(changedRow)})`]),
			...(query.search === undefined
				? []
				: [
						Prisma.sql`bool_or(d."tableName" LIKE ${`${likeLiteral(query.search)}%`} OR d."rowId" = ${query.search} OR d."correlationId" = ${query.search} OR ${actorSearchSql(Prisma.sql`d."actorUserId"`, query.search)})`,
					]),
		]),
	};
}

/** The timeline as a derived table `t (kind, id, occurred_at)`. */
export function buildAuditTrailTimeline(query: AuditTrailListQuery): Prisma.Sql {
	const requests: Prisma.Sql = Prisma.sql`SELECT 'REQUEST'::text AS kind, a.id::text AS id, a."occurredAt" FROM public."AuditLog" a WHERE ${requestEntryConditions(query)}`;
	const background = backgroundEntryConditions(query);
	if (background === null) {
		return requests;
	}
	return Prisma.sql`${requests}
		UNION ALL
		SELECT 'BACKGROUND'::text AS kind, (array_agg(d.id::text ORDER BY d."changeSequence"))[1] AS id, min(d."occurredAt") AS "occurredAt"
		  FROM public."DataChangeLog" d
		 WHERE ${background.rows}
		 GROUP BY ${groupKeySql()}
		HAVING ${background.groups}`;
}

const SQL_DIRECTION: Readonly<Record<"asc" | "desc", Prisma.Sql>> = { asc: Prisma.sql`ASC`, desc: Prisma.sql`DESC` };

const AUDIT_TRAIL_SORT_COLUMNS: SortColumns<AuditTrailListSortField, Prisma.Sql> = {
	occurredAt: (direction) => Prisma.sql`t."occurredAt" ${SQL_DIRECTION[direction]}`,
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
	({ at, id }): Prisma.Sql => Prisma.sql`(t."occurredAt" < ${at} OR (t."occurredAt" = ${at} AND t.id < ${id}))`,
);

/**
 * Read-side access to the audit trail — both bypass-only audit stores as one
 * timeline (ADR 025 + ADR 051). Never writes; bound to one `audit.trail.read`
 * system-operation transaction (`db`). Parameters are always bound
 * (`Prisma.sql`), never interpolated. A page costs a fixed number of
 * statements whatever its size: the positions, the request rows, the change
 * rows, the change summaries and the names (no N+1).
 */
export class PrismaAuditTrailReadRepository implements AuditTrailReader {
	public constructor(
		private readonly db: Prisma.TransactionClient,
		private readonly references: PrismaAuditReferenceReader,
	) {}

	/** One page of the timeline, each entry with its change summary and names resolved. */
	public async list(query: AuditTrailListQuery): Promise<PaginatedServiceResult<AuditTrailEntry>> {
		const positions: RepositoryListResult<AuditTrailEntryRow> = await this.listEntries(query);
		const rows: AuditTrailPageRows = await this.loadPageRows(positions.items);
		return toPaginatedServiceResult(
			{
				...positions,
				items: positions.items.flatMap((position: AuditTrailEntryRow): AuditTrailEntry[] => {
					const entry: AuditTrailEntry | null = toAuditTrailEntry(position, rows);
					return entry === null ? [] : [entry];
				}),
			},
			query,
		);
	}

	private async loadPageRows(positions: readonly AuditTrailEntryRow[]): Promise<AuditTrailPageRows> {
		const idsOf = (kind: AuditTrailEntryRow["kind"]): string[] => positions.filter((position) => position.kind === kind).map((position) => position.id);
		// Sequential: an interactive transaction runs its statements on one connection anyway.
		const requests = await this.findRequests(idsOf("REQUEST"));
		const changes = await this.findChanges(idsOf("BACKGROUND"));
		const groups = auditTrailChangeGroups(requests, changes);
		const summaries = await this.summarizeChanges(groups.correlationIds, groups.transactionIds);
		const references = await this.references.load(auditTrailReferenceIds(requests, changes));
		return {
			requests: new Map(requests.map((row): [string, AuditLogSummaryRow] => [row.id, row])),
			changes: new Map(changes.map((row): [string, DataChangeLogSummaryRow] => [row.id, row])),
			summaries,
			references,
		};
	}

	/** One page of timeline positions (offset or keyset, like every list). */
	private async listEntries(query: AuditTrailListQuery): Promise<RepositoryListResult<AuditTrailEntryRow>> {
		const timeline: Prisma.Sql = buildAuditTrailTimeline(query);
		return fetchListPage(query, {
			where: Prisma.sql`TRUE`,
			order: buildAuditTrailOrder(query),
			keyset: AUDIT_TRAIL_KEYSET,
			and: (left, right) => Prisma.sql`${left} AND ${right}`,
			count: async (where) => {
				const [row] = CountRowSchema.parse(await this.db.$queryRaw`SELECT count(*) AS total FROM (${timeline}) t WHERE ${where}`);
				return row.total;
			},
			findMany: async ({ where, orderBy, take, skip }) => {
				const rows = await this.db
					.$queryRaw`SELECT t.kind, t.id, t."occurredAt" FROM (${timeline}) t WHERE ${where} ORDER BY ${Prisma.join(orderBy, ", ")} LIMIT ${take} OFFSET ${skip ?? 0}`;
				return z
					.array(AuditTrailEntryRowSchema)
					.parse(rows)
					.map((row): AuditTrailEntryRow => ({ kind: row.kind, id: row.id, occurredAt: row.occurredAt }));
			},
		});
	}

	/** The request rows of a page. */
	private async findRequests(ids: readonly string[]): Promise<readonly AuditLogSummaryRow[]> {
		if (ids.length === 0) {
			return [];
		}
		return this.db.auditLog.findMany({ where: { id: { in: [...ids] } }, select: AUDIT_LOG_SUMMARY_SELECT });
	}

	/** The first change of each background entry of a page. */
	private async findChanges(ids: readonly string[]): Promise<readonly DataChangeLogSummaryRow[]> {
		if (ids.length === 0) {
			return [];
		}
		return this.db.dataChangeLog.findMany({ where: { id: { in: [...ids] } }, select: DATA_CHANGE_LOG_SUMMARY_SELECT });
	}

	/** How many rows each group changed, and in which tables (alphabetical, capped): by correlation id, and by transaction for uncorrelated changes. */
	private async summarizeChanges(correlationIds: readonly string[], transactionIds: readonly bigint[]): Promise<ChangeSummaries> {
		if (correlationIds.length === 0 && transactionIds.length === 0) {
			return new Map();
		}
		const rows = await this.db.$queryRaw`SELECT ${groupKeySql()} AS group_key, count(*) AS change_count,
			(array_agg(DISTINCT d."tableName" ORDER BY d."tableName"))[1:${AUDIT_TRAIL_MAX_LISTED_TABLES}] AS tables
			FROM public."DataChangeLog" d
			WHERE d."correlationId" = ANY(${[...correlationIds]}) OR (d."correlationId" IS NULL AND d."transactionId" = ANY(${[...transactionIds]}))
			GROUP BY 1`;
		return new Map(
			z
				.array(ChangeSummaryRowSchema)
				.parse(rows)
				.map((row): [string, ChangeSummary] => [row.group_key, { changeCount: row.change_count, changedTables: row.tables }]),
		);
	}
}
