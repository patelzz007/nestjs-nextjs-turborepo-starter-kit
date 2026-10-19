import type { AuditLog } from "@prisma/client";
import { epochMs, HttpAuditLogDetailSchema, HttpAuditLogSummarySchema, type HttpAuditLogDetail, type HttpAuditLogSummary } from "@workspace/shared";

import { distinctReferenceIds, toAuditLogOrganization, toAuditLogUser, type AuditLogReferenceIds, type AuditLogReferences } from "./audit-references";
import type { AuditLogSummaryRow } from "./prisma-http-audit-log.read-repository";

/** Every distinct actor / impersonator and organization id the rows name. */
export function httpAuditLogReferenceIds(rows: readonly Pick<AuditLogSummaryRow, "actorUserId" | "impersonatorUserId" | "organizationId">[]): AuditLogReferenceIds {
	return {
		userIds: distinctReferenceIds(rows.flatMap((row) => [row.actorUserId, row.impersonatorUserId])),
		organizationIds: distinctReferenceIds(rows.map((row) => row.organizationId)),
	};
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
		actor: toAuditLogUser(row.actorUserId, references),
		impersonator: toAuditLogUser(row.impersonatorUserId, references),
		apiKeyId: row.apiKeyId,
		terminalId: row.terminalId,
		organization: toAuditLogOrganization(row.organizationId, references),
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
