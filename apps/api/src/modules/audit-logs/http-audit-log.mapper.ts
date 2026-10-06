import type { AuditLog } from "@prisma/client";
import {
	epochMs,
	HttpAuditLogDetailSchema,
	HttpAuditLogSummarySchema,
	type AuditLogOrganization,
	type AuditLogUser,
	type HttpAuditLogDetail,
	type HttpAuditLogSummary,
} from "@workspace/shared";

import type { AuditLogOrganizationRow, AuditLogSummaryRow, AuditLogUserRow } from "./repositories/http-audit-log.repository";

/** The user and organization rows a page of audit records references, keyed by id. */
export interface AuditLogReferences {
	readonly users: ReadonlyMap<string, AuditLogUserRow>;
	readonly organizations: ReadonlyMap<string, AuditLogOrganizationRow>;
}

type UserReferencingRow = Pick<AuditLogSummaryRow, "actorUserId" | "impersonatorUserId">;
type OrganizationReferencingRow = Pick<AuditLogSummaryRow, "organizationId">;

function distinct(ids: readonly (string | null)[]): string[] {
	return [...new Set(ids.filter((id): id is string => id !== null))];
}

/** Every distinct actor / impersonator id the rows name. */
export function referencedUserIds(rows: readonly UserReferencingRow[]): string[] {
	return distinct(rows.flatMap((row) => [row.actorUserId, row.impersonatorUserId]));
}

/** Every distinct organization id the rows name. */
export function referencedOrganizationIds(rows: readonly OrganizationReferencingRow[]): string[] {
	return distinct(rows.map((row) => row.organizationId));
}

/** Index looked-up rows by id. */
export function toAuditLogReferences(users: readonly AuditLogUserRow[], organizations: readonly AuditLogOrganizationRow[]): AuditLogReferences {
	return {
		users: new Map(users.map((user): [string, AuditLogUserRow] => [user.id, user])),
		organizations: new Map(organizations.map((organization): [string, AuditLogOrganizationRow] => [organization.id, organization])),
	};
}

function toUser(id: string | null, references: AuditLogReferences): AuditLogUser | null {
	if (id === null) {
		return null;
	}
	const user: AuditLogUserRow | undefined = references.users.get(id);
	return { id, email: user?.email ?? null, fullName: user?.fullName ?? null };
}

function toOrganization(id: string | null, references: AuditLogReferences): AuditLogOrganization | null {
	if (id === null) {
		return null;
	}
	return { id, name: references.organizations.get(id)?.displayName ?? null };
}

/** A list row → the public summary contract (bigint epochs → numbers, ids → resolved references). */
export function toHttpAuditLogSummary(row: AuditLogSummaryRow, references: AuditLogReferences): HttpAuditLogSummary {
	const occurredAt = Number(row.occurredAt);
	const completedAt = Number(row.completedAt);
	return HttpAuditLogSummarySchema.parse({
		id: row.id,
		correlationId: row.correlationId,
		occurredAt: epochMs(occurredAt),
		completedAt: epochMs(completedAt),
		// Clocks never run backwards within one request, but a clamp keeps a skewed row readable.
		durationMs: Math.max(0, completedAt - occurredAt),
		method: row.method,
		endpoint: row.endpoint,
		path: row.path,
		outcome: row.outcome,
		responseStatus: row.responseStatus,
		errorCode: row.errorCode,
		authMethod: row.authMethod,
		actor: toUser(row.actorUserId, references),
		impersonator: toUser(row.impersonatorUserId, references),
		apiKeyId: row.apiKeyId,
		terminalId: row.terminalId,
		organization: toOrganization(row.organizationId, references),
		storeId: row.storeId,
		locationId: row.locationId,
		ipAddress: row.ipAddress,
		userAgent: row.userAgent,
		browserName: row.browserName,
		browserVersion: row.browserVersion,
		osName: row.osName,
		osVersion: row.osVersion,
		deviceType: row.deviceType,
		deviceModel: row.deviceModel,
		ipVersion: row.ipVersion,
		ipScope: row.ipScope,
		geoCountry: row.geoCountry,
		geoRegion: row.geoRegion,
		geoCity: row.geoCity,
		geoTimeZone: row.geoTimeZone,
		clientType: row.clientType,
	});
}

/** A complete row → the public detail contract (the summary plus request metadata and the redacted payloads). */
export function toHttpAuditLogDetail(row: AuditLog, references: AuditLogReferences): HttpAuditLogDetail {
	return HttpAuditLogDetailSchema.parse({
		...toHttpAuditLogSummary(row, references),
		traceId: row.traceId,
		impersonationSessionId: row.impersonationSessionId,
		httpVersion: row.httpVersion,
		host: row.host,
		origin: row.origin,
		referer: row.referer,
		acceptLanguage: row.acceptLanguage,
		requestContentType: row.requestContentType,
		requestBytes: row.requestBytes,
		idempotencyKey: row.idempotencyKey,
		requestParams: row.requestParams,
		requestBody: row.requestBody,
		responseBody: row.responseBody,
		systemOperations: row.systemOperations,
		createdAt: epochMs(Number(row.createdAt)),
	});
}
