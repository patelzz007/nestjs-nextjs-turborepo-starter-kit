import { z } from "zod";

import { EpochMsSchema } from "../../../schemas/api/common";
import { defineListQuery, listFilter, ListSearchSchema } from "../../../schemas/api/list-query";
import { JsonValueSchema } from "../../../schemas/runtime/json";
import { AuditLogOrganizationSchema, AuditLogUserSchema } from "./http-audit-log";

/**
 * Row-level data-change trail — the admin viewer's contract
 * (`GET /admin/data-changes`, `GET /admin/data-changes/:id`). One record per
 * INSERT / UPDATE / DELETE (and per TRUNCATE) on every captured table, written
 * by a database trigger in the same transaction as the change, whatever wrote
 * it: an HTTP request, a queue job, a scheduler, a CLI or a manual SQL session
 * (docs/adr/051-database-change-audit-trail.md). Row images were redacted
 * (secrets), masked (personal data) and capped inside the database BEFORE they
 * were stored; this contract only exposes them. `correlationId` joins a record
 * to the HTTP request (`GET /admin/audit-logs`) that caused it.
 */

// ── Enums (mirror the Prisma enums / stored values) ─────────────────────────

/** The kind of change. Mirrors the Prisma enum `DataChangeOperation`. */
export const DataChangeOperationSchema = z.enum(["INSERT", "UPDATE", "DELETE", "TRUNCATE"]);
export type DataChangeOperation = z.output<typeof DataChangeOperationSchema>;

/**
 * Who the change is attributed to (from the database session it ran in). Mirrors the Prisma enum
 * `DataChangeActorKind`. `UNATTRIBUTED` = no user, key or system operation: a migration, the seed,
 * a manual SQL session — or a code path that skipped its context, which is itself a finding.
 */
export const DataChangeActorKindSchema = z.enum(["USER", "API_KEY", "SYSTEM", "UNATTRIBUTED"]);
export type DataChangeActorKind = z.output<typeof DataChangeActorKindSchema>;

// ── Column budgets (apps/api/prisma/schema.prisma `DataChangeLog`) ──────────

const CHANGE_ID_MAX_LENGTH = 64;
const TABLE_NAME_MAX_LENGTH = 63;
const ROW_ID_MAX_LENGTH = 512;
const SYSTEM_OPERATION_MAX_LENGTH = 100;
const ACTOR_PURPOSE_MAX_LENGTH = 512;
const ROLE_NAME_MAX_LENGTH = 63;
const APPLICATION_NAME_MAX_LENGTH = 64;
const CLIENT_ADDRESS_MAX_LENGTH = 64;
/** Longest PostgreSQL identifier (NAMEDATALEN - 1) — a column name. */
const COLUMN_NAME_MAX_LENGTH = 63;
/** PostgreSQL's hard limit on the columns of one table. */
const MAX_COLUMNS_PER_TABLE = 1_600;

const ChangeReferenceIdSchema = z.string().min(1).max(CHANGE_ID_MAX_LENGTH);

// ── Records ─────────────────────────────────────────────────────────────────

/** One record as listed by `GET /admin/data-changes` — everything except the row images. */
export const DataChangeLogSummarySchema = z.object({
	id: z.uuid(),
	/** Write order across the whole trail — orders the changes of one transaction exactly. */
	changeSequence: z.number().int().positive(),
	/** When the row changed (epoch ms). */
	occurredAt: EpochMsSchema,
	/** The database transaction: records sharing it committed together. */
	transactionId: z.number().int().nonnegative(),
	tableName: z.string().min(1).max(TABLE_NAME_MAX_LENGTH),
	operation: DataChangeOperationSchema,
	/** The changed row's primary key (composite keys joined with `/`); `null` for a TRUNCATE. */
	rowId: z.string().max(ROW_ID_MAX_LENGTH).nullable(),
	/** UPDATE: the columns whose value changed (secret ones included — their values are redacted). Empty otherwise. */
	changedColumns: z.array(z.string().min(1).max(COLUMN_NAME_MAX_LENGTH)).max(MAX_COLUMNS_PER_TABLE),
	actorKind: DataChangeActorKindSchema,
	actor: AuditLogUserSchema.nullable(),
	organization: AuditLogOrganizationSchema.nullable(),
	apiKeyId: ChangeReferenceIdSchema.nullable(),
	/** The allowlisted system operation (RLS bypass) the change ran under. */
	systemOperation: z.string().min(1).max(SYSTEM_OPERATION_MAX_LENGTH).nullable(),
	/** Joins the HTTP request (`audit_logs.correlation_id`) or job that caused the change. */
	correlationId: ChangeReferenceIdSchema.nullable(),
	/** The PostgreSQL role that executed the statement. */
	databaseRole: z.string().min(1).max(ROLE_NAME_MAX_LENGTH),
});
export type DataChangeLogSummary = z.output<typeof DataChangeLogSummarySchema>;

/** One complete record (`GET /admin/data-changes/:id`): the summary plus the row images and connection facts. */
export const DataChangeLogDetailSchema = DataChangeLogSummarySchema.extend({
	/** The row before the change (UPDATE, DELETE) — redacted / masked / capped. */
	oldData: JsonValueSchema.nullable(),
	/** The row after the change (INSERT, UPDATE) — redacted / masked / capped. */
	newData: JsonValueSchema.nullable(),
	/** Why the transaction ran (the tenant purpose, or the system operation's reason). */
	actorPurpose: z.string().min(1).max(ACTOR_PURPOSE_MAX_LENGTH).nullable(),
	/** The role the connection logged in as. */
	loginRole: z.string().min(1).max(ROLE_NAME_MAX_LENGTH),
	/** The connecting client's `application_name` (`prisma-seed`, `psql`, …). */
	applicationName: z.string().min(1).max(APPLICATION_NAME_MAX_LENGTH).nullable(),
	/** The connecting client's address; `null` over a Unix socket. */
	clientAddress: z.string().min(1).max(CLIENT_ADDRESS_MAX_LENGTH).nullable(),
	/** When the record was written (epoch ms). */
	createdAt: EpochMsSchema,
});
export type DataChangeLogDetail = z.output<typeof DataChangeLogDetailSchema>;

// ── Inputs ──────────────────────────────────────────────────────────────────

/** `GET /admin/data-changes/:id` path params. */
export const DataChangeLogIdParamSchema = z.object({ id: z.uuid() }).strict();
export type DataChangeLogIdParam = z.output<typeof DataChangeLogIdParamSchema>;

/**
 * `GET /admin/data-changes` list query (newest first) — see docs/technical/api/list-queries.md.
 * The identifier filters (table name, system operation, correlation id, row id) match EXACTLY
 * (case-sensitive), so each is served by its index. `search` matches a table-name prefix, or
 * exactly a row id or correlation id.
 */
export const dataChangeLogListQuery = defineListQuery({
	sortable: ["occurredAt"],
	defaultSort: [{ field: "occurredAt", direction: "desc" }],
	filter: {
		tableName: listFilter.string({ eq: true, in: true }),
		operation: listFilter.enumeration(DataChangeOperationSchema, { eq: true, in: true }),
		actorKind: listFilter.enumeration(DataChangeActorKindSchema, { eq: true, in: true }),
		actorUserId: listFilter.uuid({ eq: true, isNull: true }),
		organizationId: listFilter.uuid({ eq: true, isNull: true }),
		apiKeyId: listFilter.uuid({ eq: true }),
		systemOperation: listFilter.string({ eq: true, in: true, isNull: true }),
		correlationId: listFilter.string({ eq: true }),
		rowId: listFilter.string({ eq: true }),
		transactionId: listFilter.number({ eq: true }),
		occurredAt: listFilter.epochMs({ gte: true, lte: true }),
	},
	params: { search: ListSearchSchema },
});
export const DataChangeLogListQuerySchema = dataChangeLogListQuery.schema;
export type DataChangeLogListQuery = z.output<typeof DataChangeLogListQuerySchema>;
export type DataChangeLogListSortField = (typeof dataChangeLogListQuery.sortable)[number];
