import { z } from "zod";

import { defineListQuery, listFilter, ListSearchSchema } from "../../api/list-query";
import { DataChangeActorKindSchema, DataChangeLogSummarySchema } from "./data-change-log";
import { DeviceTypeSchema, IpAddressScopeSchema } from "./enums";
import { AuditAuthMethodSchema, AuditHttpMethodSchema, AuditOutcomeSchema, HttpAuditLogSummarySchema } from "./http-audit-log";

/**
 * The audit trail — ONE timeline over both audit stores, the admin audit log's
 * contract (`GET /admin/audit-trail`). Each entry is either:
 *
 * - `REQUEST` — one HTTP request (`audit_logs`, ADR 025), with how many rows it
 *   changed in the database and in which tables (`data_change_logs`, ADR 051,
 *   joined by correlation id);
 * - `BACKGROUND` — database writes no HTTP request made: a queue job, a
 *   scheduler, the outbox, a CLI, the seed or a manual SQL session. The changes
 *   of one job (one correlation id) form one entry; a change with no
 *   correlation id is an entry of its own.
 *
 * The full records stay one click away: `GET /admin/audit-logs/:id` and
 * `GET /admin/data-changes/:id`.
 */

/** The two kinds of entry. */
export const AuditTrailEntryKindSchema = z.enum(["REQUEST", "BACKGROUND"]);
export type AuditTrailEntryKind = z.output<typeof AuditTrailEntryKindSchema>;

/** Most distinct table names one entry lists (the rest are counted, never listed). */
export const AUDIT_TRAIL_MAX_LISTED_TABLES = 10;

/** Rows an entry changed, and where — a summary; the rows themselves are one click away. */
const ChangeSummaryShape = {
	/** How many rows the request / job inserted, updated, deleted or truncated. */
	changeCount: z.number().int().nonnegative(),
	/** The distinct tables it changed (alphabetical, at most {@link AUDIT_TRAIL_MAX_LISTED_TABLES}). */
	changedTables: z.array(DataChangeLogSummarySchema.shape.tableName).max(AUDIT_TRAIL_MAX_LISTED_TABLES),
};

/** An HTTP request, with the rows it changed. */
export const AuditTrailRequestEntrySchema = HttpAuditLogSummarySchema.extend({
	kind: z.literal(AuditTrailEntryKindSchema.enum.REQUEST),
	...ChangeSummaryShape,
});
export type AuditTrailRequestEntry = z.output<typeof AuditTrailRequestEntrySchema>;

/** Database writes made outside any HTTP request. `id` is the first change's id (`GET /admin/data-changes/:id`). */
export const AuditTrailBackgroundEntrySchema = DataChangeLogSummarySchema.pick({
	id: true,
	occurredAt: true,
	actorKind: true,
	actor: true,
	organization: true,
	apiKeyId: true,
	systemOperation: true,
	correlationId: true,
	databaseRole: true,
}).extend({
	kind: z.literal(AuditTrailEntryKindSchema.enum.BACKGROUND),
	/** The first change's operation and row — what a single-change entry did. */
	operation: DataChangeLogSummarySchema.shape.operation,
	rowId: DataChangeLogSummarySchema.shape.rowId,
	...ChangeSummaryShape,
});
export type AuditTrailBackgroundEntry = z.output<typeof AuditTrailBackgroundEntrySchema>;

export const AuditTrailEntrySchema = z.discriminatedUnion("kind", [AuditTrailRequestEntrySchema, AuditTrailBackgroundEntrySchema]);
export type AuditTrailEntry = z.output<typeof AuditTrailEntrySchema>;

/**
 * `GET /admin/audit-trail` list query (newest first) — see docs/technical/api/list-queries.md.
 *
 * - Shared filters (`actorUserId`, `organizationId`, `correlationId`, `occurredAt`) narrow both kinds.
 * - `tableName` / `rowId` keep the requests and jobs that changed that table / row — a row's history.
 * - Request-only filters (`outcome`, `method`, `authMethod`, `deviceType`, `ipScope`) leave only
 *   requests; `actorKind` (who a background write is attributed to) leaves only background entries.
 * - `search` matches a request's path / route template, or a background entry's table (prefix);
 *   a correlation id matches either exactly; and either kind by who acted — the actor's user id
 *   exactly, or part of their email address or full name.
 */
export const auditTrailListQuery = defineListQuery({
	sortable: ["occurredAt"],
	defaultSort: [{ field: "occurredAt", direction: "desc" }],
	filter: {
		kind: listFilter.enumeration(AuditTrailEntryKindSchema, { eq: true }),
		actorUserId: listFilter.uuid({ eq: true }),
		organizationId: listFilter.uuid({ eq: true }),
		correlationId: listFilter.string({ eq: true }),
		tableName: listFilter.string({ eq: true }),
		rowId: listFilter.string({ eq: true }),
		occurredAt: listFilter.epochMs({ gte: true, lte: true }),
		outcome: listFilter.enumeration(AuditOutcomeSchema, { eq: true }),
		method: listFilter.enumeration(AuditHttpMethodSchema, { eq: true }),
		authMethod: listFilter.enumeration(AuditAuthMethodSchema, { eq: true }),
		deviceType: listFilter.enumeration(DeviceTypeSchema, { eq: true }),
		ipScope: listFilter.enumeration(IpAddressScopeSchema, { eq: true }),
		actorKind: listFilter.enumeration(DataChangeActorKindSchema, { eq: true }),
	},
	params: { search: ListSearchSchema },
});
export const AuditTrailListQuerySchema = auditTrailListQuery.schema;
export type AuditTrailListQuery = z.output<typeof AuditTrailListQuerySchema>;
export type AuditTrailListSortField = (typeof auditTrailListQuery.sortable)[number];
