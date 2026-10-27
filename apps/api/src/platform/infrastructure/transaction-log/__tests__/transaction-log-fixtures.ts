import type { TransactionLogConfig } from "../../../../config/api-config.schema";
import type { HttpAuditEntry } from "../../audit/http-audit-entry";

/** 26 October 2026, 01:44:26.123 UTC — 09:44:26.123 in Kuala Lumpur. */
export const OCCURRED_AT = Date.UTC(2026, 9, 26, 1, 44, 26, 123);

/** The zone the tests read the log in (UTC+8 all year, no DST). */
export const TIME_ZONE = "Asia/Kuala_Lumpur";

/** A log config for the writer and sinks under test. */
export function transactionLogConfig(directory: string): TransactionLogConfig {
	return { directory, retentionDays: 30, timeZone: TIME_ZONE };
}

/** A complete audit row with every optional fact unset; tests set what they look at. */
export function auditEntry(overrides: Partial<HttpAuditEntry> = {}): HttpAuditEntry {
	return {
		correlationId: "corr-1",
		traceId: "corr-1",
		occurredAt: OCCURRED_AT,
		completedAt: OCCURRED_AT + 42,
		method: "POST",
		endpoint: "/api/v1/rewards",
		path: "/api/v1/rewards",
		outcome: "SUCCEEDED",
		responseStatus: 201,
		errorCode: null,
		actorUserId: null,
		impersonatorUserId: null,
		impersonationSessionId: null,
		supportAccessGrantId: null,
		sessionId: null,
		authMethod: null,
		apiKeyId: null,
		terminalId: null,
		tenantId: null,
		locationId: null,
		claimedTenantId: null,
		claimedLocationId: null,
		ipAddress: null,
		userAgent: null,
		browserName: null,
		browserVersion: null,
		osName: null,
		osVersion: null,
		deviceType: null,
		deviceModel: null,
		ipVersion: null,
		ipScope: null,
		geoCountry: null,
		geoRegion: null,
		geoCity: null,
		geoTimeZone: null,
		clientType: null,
		httpVersion: null,
		host: null,
		origin: null,
		referer: null,
		acceptLanguage: null,
		requestContentType: null,
		requestBytes: null,
		idempotencyKey: null,
		requestHeaders: null,
		requestParams: null,
		requestBody: null,
		responseBody: null,
		errorDetail: null,
		systemOperations: [],
		actorIdentity: null,
		...overrides,
	};
}
