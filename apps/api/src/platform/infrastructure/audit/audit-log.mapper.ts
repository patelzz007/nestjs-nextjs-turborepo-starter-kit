import { Prisma } from "@prisma/client";
import type { JsonValue } from "@workspace/shared";

import { parsePrismaNullableJson } from "../utils/prisma-json";
import type { HttpAuditEntry } from "./http-audit-entry";

/** The `AuditLog` row for an entry — shared by the repository and the seed, so seeded rows obey the same mapping. */
export function toAuditLogCreateInput(entry: HttpAuditEntry): Prisma.AuditLogCreateInput {
	const json = (value: JsonValue | null): Prisma.InputJsonValue | typeof Prisma.DbNull => parsePrismaNullableJson(value);
	return {
		correlationId: entry.correlationId,
		traceId: entry.traceId,
		occurredAt: BigInt(entry.occurredAt),
		completedAt: BigInt(entry.completedAt),
		method: entry.method,
		endpoint: entry.endpoint,
		path: entry.path,
		outcome: entry.outcome,
		responseStatus: entry.responseStatus,
		errorCode: entry.errorCode,
		actorUserId: entry.actorUserId,
		impersonatorUserId: entry.impersonatorUserId,
		impersonationSessionId: entry.impersonationSessionId,
		supportAccessGrantId: entry.supportAccessGrantId,
		sessionId: entry.sessionId,
		authMethod: entry.authMethod,
		apiKeyId: entry.apiKeyId,
		terminalId: entry.terminalId,
		tenantId: entry.tenantId,
		locationId: entry.locationId,
		claimedTenantId: entry.claimedTenantId,
		claimedLocationId: entry.claimedLocationId,
		ipAddress: entry.ipAddress,
		userAgent: entry.userAgent,
		browserName: entry.browserName,
		browserVersion: entry.browserVersion,
		osName: entry.osName,
		osVersion: entry.osVersion,
		deviceType: entry.deviceType,
		deviceModel: entry.deviceModel,
		ipVersion: entry.ipVersion,
		ipScope: entry.ipScope,
		geoCountry: entry.geoCountry,
		geoRegion: entry.geoRegion,
		geoCity: entry.geoCity,
		geoTimeZone: entry.geoTimeZone,
		clientType: entry.clientType,
		httpVersion: entry.httpVersion,
		host: entry.host,
		origin: entry.origin,
		referer: entry.referer,
		acceptLanguage: entry.acceptLanguage,
		requestContentType: entry.requestContentType,
		requestBytes: entry.requestBytes,
		idempotencyKey: entry.idempotencyKey,
		requestHeaders: json(entry.requestHeaders),
		requestParams: json(entry.requestParams),
		requestBody: json(entry.requestBody),
		responseBody: json(entry.responseBody),
		errorDetail: json(entry.errorDetail),
		systemOperations: [...entry.systemOperations],
	};
}
