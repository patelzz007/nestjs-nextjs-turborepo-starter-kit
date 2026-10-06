import { eqFilter, listStateToListQuery, type TableListQueryInput } from "@workspace/client/lib/api/list-query";
import { listFilterKey, listSearchParam, listUrlParams } from "@workspace/client/lib/url-state/list-url-state";
import { defineUrlState, optionalUrlParam } from "@workspace/client/lib/url-state/url-state";
import {
	AuditAuthMethodSchema,
	AuditHttpMethodSchema,
	AuditOutcomeSchema,
	DeviceTypeSchema,
	httpAuditLogListQuery,
	IpAddressScopeSchema,
	type AuditAuthMethod,
	type AuditHttpMethod,
	type AuditOutcome,
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

/**
 * `/audit-logs` table state — the keys of `GET /admin/audit-logs`. Besides the
 * select filters, the detail page links back here pre-filtered by actor,
 * organization or correlation id ("everything this person did", "everything in
 * this tenant", "everything in this request").
 */
export const AUDIT_LOG_URL_STATE = defineUrlState(
	{
		...listUrlParams(httpAuditLogListQuery, { pageSizes: AUDIT_LOG_PAGE_SIZE_OPTIONS, defaultLimit: AUDIT_LOG_PAGE_SIZE }),
		search: listSearchParam(),
		outcome: optionalUrlParam(AuditOutcomeSchema),
		method: optionalUrlParam(AuditHttpMethodSchema),
		authMethod: optionalUrlParam(AuditAuthMethodSchema),
		deviceType: optionalUrlParam(DeviceTypeSchema),
		ipScope: optionalUrlParam(IpAddressScopeSchema),
		actorUserId: optionalUrlParam(UuidUrlSchema),
		organizationId: optionalUrlParam(UuidUrlSchema),
		correlationId: optionalUrlParam(CorrelationIdUrlSchema),
	},
	{
		urlKeys: {
			outcome: listFilterKey("outcome"),
			method: listFilterKey("method"),
			authMethod: listFilterKey("authMethod"),
			deviceType: listFilterKey("deviceType"),
			ipScope: listFilterKey("ipScope"),
			actorUserId: listFilterKey("actorUserId"),
			organizationId: listFilterKey("organizationId"),
			correlationId: listFilterKey("correlationId"),
		},
	},
);

export type AuditLogUrlState = typeof AUDIT_LOG_URL_STATE.defaults;

export type AuditLogListFilter = Readonly<{
	outcome: { eq: AuditOutcome } | undefined;
	method: { eq: AuditHttpMethod } | undefined;
	authMethod: { eq: AuditAuthMethod } | undefined;
	deviceType: { eq: DeviceType } | undefined;
	ipScope: { eq: IpAddressScope } | undefined;
	actorUserId: { eq: string } | undefined;
	organizationId: { eq: string } | undefined;
	correlationId: { eq: string } | undefined;
}>;

/** True when any filter or the search narrows the table. */
export function isAuditLogFiltered(state: AuditLogUrlState): boolean {
	return (
		state.search !== undefined ||
		state.outcome !== undefined ||
		state.method !== undefined ||
		state.authMethod !== undefined ||
		state.deviceType !== undefined ||
		state.ipScope !== undefined ||
		state.actorUserId !== undefined ||
		state.organizationId !== undefined ||
		state.correlationId !== undefined
	);
}

/** The `GET /admin/audit-logs` input for a URL state (server prefetch and client query). */
export function toAuditLogListQuery(state: AuditLogUrlState): TableListQueryInput<AuditLogListFilter> {
	return listStateToListQuery(httpAuditLogListQuery, {
		pagination: state,
		sort: state.sort,
		search: state.search,
		filter: {
			outcome: eqFilter(state.outcome),
			method: eqFilter(state.method),
			authMethod: eqFilter(state.authMethod),
			deviceType: eqFilter(state.deviceType),
			ipScope: eqFilter(state.ipScope),
			actorUserId: eqFilter(state.actorUserId),
			organizationId: eqFilter(state.organizationId),
			correlationId: eqFilter(state.correlationId),
		},
	});
}

/** The id filters a detail page links back to the table with. */
export type AuditLogIdFilter = Partial<Pick<AuditLogUrlState, "actorUserId" | "organizationId" | "correlationId">>;

/** `/audit-logs` filtered by one actor / organization / correlation id ("everything this person did"). */
export function auditLogListHref(filter: AuditLogIdFilter): string {
	return AUDIT_LOG_URL_STATE.href(ROUTES.auditLogs.list, { ...AUDIT_LOG_URL_STATE.defaults, ...filter });
}
