import { eqFilter, listStateToListQuery, type TableListQueryInput } from "@workspace/client/lib/api/list-query";
import { listFilterKey, listSearchParam, listUrlParams } from "@workspace/client/lib/url-state/list-url-state";
import { defineUrlState, optionalUrlParam } from "@workspace/client/lib/url-state/url-state";
import {
	AuditAuthMethodSchema,
	AuditHttpMethodSchema,
	AuditOutcomeSchema,
	auditTrailListQuery,
	AuditTrailEntryKindSchema,
	DataChangeActorKindSchema,
	DataChangeLogSummarySchema,
	DeviceTypeSchema,
	IpAddressScopeSchema,
	type AuditAuthMethod,
	type AuditHttpMethod,
	type AuditOutcome,
	type AuditTrailEntryKind,
	type DataChangeActorKind,
	type DeviceType,
	type IpAddressScope,
} from "@workspace/shared";
import { z } from "zod";

import { ROUTES } from "@/lib/routes";

/** Page sizes the audit log offers. */
export const AUDIT_LOG_PAGE_SIZE_OPTIONS: readonly number[] = [25, 50, 100];
/** Default page size — omitted from the URL. */
export const AUDIT_LOG_PAGE_SIZE = 50;

/** Longest correlation id the API stores (`audit_logs.correlation_id`). */
const CORRELATION_ID_MAX_LENGTH = 64;

const UuidUrlSchema = z.uuid();
const CorrelationIdUrlSchema = z.string().trim().min(1).max(CORRELATION_ID_MAX_LENGTH);
const { tableName: TableNameUrlSchema, rowId: RowIdShape } = DataChangeLogSummarySchema.shape;
/** A row id from the URL — the contract's bound, never `null`. */
const RowIdUrlSchema = RowIdShape.unwrap().min(1);

/**
 * `/audit-logs` state — the keys of `GET /admin/audit-trail`: ONE timeline of
 * HTTP requests and background database writes (ADR 051). Besides the select
 * filters, links land here pre-filtered: by actor, tenant, correlation
 * id ("everything in this request / job"), or by table + row ("this row's
 * history").
 */
export const AUDIT_LOG_URL_STATE = defineUrlState(
	{
		...listUrlParams(auditTrailListQuery, { pageSizes: AUDIT_LOG_PAGE_SIZE_OPTIONS, defaultLimit: AUDIT_LOG_PAGE_SIZE }),
		search: listSearchParam(),
		kind: optionalUrlParam(AuditTrailEntryKindSchema),
		outcome: optionalUrlParam(AuditOutcomeSchema),
		method: optionalUrlParam(AuditHttpMethodSchema),
		authMethod: optionalUrlParam(AuditAuthMethodSchema),
		deviceType: optionalUrlParam(DeviceTypeSchema),
		ipScope: optionalUrlParam(IpAddressScopeSchema),
		actorKind: optionalUrlParam(DataChangeActorKindSchema),
		actorUserId: optionalUrlParam(UuidUrlSchema),
		tenantId: optionalUrlParam(UuidUrlSchema),
		correlationId: optionalUrlParam(CorrelationIdUrlSchema),
		tableName: optionalUrlParam(TableNameUrlSchema),
		rowId: optionalUrlParam(RowIdUrlSchema),
	},
	{
		urlKeys: {
			kind: listFilterKey("kind"),
			outcome: listFilterKey("outcome"),
			method: listFilterKey("method"),
			authMethod: listFilterKey("authMethod"),
			deviceType: listFilterKey("deviceType"),
			ipScope: listFilterKey("ipScope"),
			actorKind: listFilterKey("actorKind"),
			actorUserId: listFilterKey("actorUserId"),
			tenantId: listFilterKey("tenantId"),
			correlationId: listFilterKey("correlationId"),
			tableName: listFilterKey("tableName"),
			rowId: listFilterKey("rowId"),
		},
	},
);

export type AuditLogUrlState = typeof AUDIT_LOG_URL_STATE.defaults;

export type AuditLogListFilter = Readonly<{
	kind: { eq: AuditTrailEntryKind } | undefined;
	outcome: { eq: AuditOutcome } | undefined;
	method: { eq: AuditHttpMethod } | undefined;
	authMethod: { eq: AuditAuthMethod } | undefined;
	deviceType: { eq: DeviceType } | undefined;
	ipScope: { eq: IpAddressScope } | undefined;
	actorKind: { eq: DataChangeActorKind } | undefined;
	actorUserId: { eq: string } | undefined;
	tenantId: { eq: string } | undefined;
	correlationId: { eq: string } | undefined;
	tableName: { eq: string } | undefined;
	rowId: { eq: string } | undefined;
}>;

/** Every filter key of the audit log — what "clear filters" resets and what makes the table "filtered". */
export const AUDIT_LOG_FILTER_KEYS: readonly (keyof AuditLogListFilter)[] = [
	"kind",
	"outcome",
	"method",
	"authMethod",
	"deviceType",
	"ipScope",
	"actorKind",
	"actorUserId",
	"tenantId",
	"correlationId",
	"tableName",
	"rowId",
];

/** True when any filter or the search narrows the table. */
export function isAuditLogFiltered(state: AuditLogUrlState): boolean {
	return state.search !== undefined || AUDIT_LOG_FILTER_KEYS.some((key) => state[key] !== undefined);
}

/** The `GET /admin/audit-trail` input for a URL state (server prefetch and client query). */
export function toAuditLogListQuery(state: AuditLogUrlState): TableListQueryInput<AuditLogListFilter> {
	return listStateToListQuery(auditTrailListQuery, {
		pagination: state,
		sort: state.sort,
		search: state.search,
		filter: {
			kind: eqFilter(state.kind),
			outcome: eqFilter(state.outcome),
			method: eqFilter(state.method),
			authMethod: eqFilter(state.authMethod),
			deviceType: eqFilter(state.deviceType),
			ipScope: eqFilter(state.ipScope),
			actorKind: eqFilter(state.actorKind),
			actorUserId: eqFilter(state.actorUserId),
			tenantId: eqFilter(state.tenantId),
			correlationId: eqFilter(state.correlationId),
			tableName: eqFilter(state.tableName),
			rowId: eqFilter(state.rowId),
		},
	});
}

/** The id filters other pages link to the audit log with. */
export type AuditLogIdFilter = Partial<Pick<AuditLogUrlState, "actorUserId" | "tenantId" | "correlationId" | "tableName" | "rowId">>;

/** `/audit-logs` filtered by one actor / tenant / request or job / row ("everything this person did"). */
export function auditLogListHref(filter: AuditLogIdFilter): string {
	return AUDIT_LOG_URL_STATE.href(ROUTES.auditLogs.list, { ...AUDIT_LOG_URL_STATE.defaults, ...filter });
}
