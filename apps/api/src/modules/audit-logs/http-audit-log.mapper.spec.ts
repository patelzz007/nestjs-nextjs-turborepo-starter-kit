import type { AuditLog } from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
	referencedOrganizationIds,
	referencedUserIds,
	toAuditLogReferences,
	toHttpAuditLogDetail,
	toHttpAuditLogSummary,
	type AuditLogReferences,
} from "./http-audit-log.mapper";

const OCCURRED_AT = 1_790_812_800_000;
const DURATION_MS = 37;
const ACTOR_ID = "11111111-1111-4111-8111-111111111111";
const IMPERSONATOR_ID = "22222222-2222-4222-8222-222222222222";
const ORGANIZATION_ID = "33333333-3333-4333-8333-333333333333";
const UNKNOWN_USER_ID = "44444444-4444-4444-8444-444444444444";

function auditRow(overrides: Partial<AuditLog> = {}): AuditLog {
	return {
		id: "55555555-5555-4555-8555-555555555555",
		correlationId: "corr-1",
		traceId: "corr-1",
		occurredAt: BigInt(OCCURRED_AT),
		completedAt: BigInt(OCCURRED_AT + DURATION_MS),
		method: "PATCH",
		endpoint: "/api/v1/auth/profile",
		path: "/api/v1/auth/profile",
		outcome: "FAILED",
		responseStatus: 403,
		errorCode: "PROFILE_UPDATE_DURING_IMPERSONATION",
		actorUserId: ACTOR_ID,
		impersonatorUserId: IMPERSONATOR_ID,
		impersonationSessionId: "session-1",
		authMethod: "SESSION_COOKIE",
		apiKeyId: null,
		terminalId: null,
		organizationId: ORGANIZATION_ID,
		storeId: null,
		locationId: null,
		ipAddress: "203.0.113.24",
		userAgent: "vitest-agent",
		browserName: "Safari",
		browserVersion: "18.0",
		osName: "iOS",
		osVersion: "18.0",
		deviceType: "MOBILE",
		deviceModel: "iPhone",
		ipVersion: 4,
		ipScope: "PUBLIC",
		geoCountry: "MY",
		geoRegion: "Kuala Lumpur",
		geoCity: "Kuala Lumpur",
		geoTimeZone: "Asia/Kuala_Lumpur",
		clientType: "admin",
		httpVersion: "1.1",
		host: "api.example.com",
		origin: "https://admin.example.com",
		referer: "https://admin.example.com/account/profile",
		acceptLanguage: "en-GB",
		requestContentType: "application/json",
		requestBytes: 42,
		idempotencyKey: null,
		requestParams: { params: {}, query: {} },
		requestBody: { fullName: "[PII]" },
		responseBody: { success: false },
		systemOperations: ["audit.http_request.record"],
		createdAt: BigInt(OCCURRED_AT + DURATION_MS),
		...overrides,
	};
}

const REFERENCES: AuditLogReferences = toAuditLogReferences(
	[
		{ id: ACTOR_ID, email: "user@example.com", fullName: "Demo Customer" },
		{ id: IMPERSONATOR_ID, email: "superadmin@example.com", fullName: "Super Admin" },
	],
	[{ id: ORGANIZATION_ID, displayName: "Kopi Corner" }],
);

describe("referencedUserIds / referencedOrganizationIds", () => {
	it("collects each distinct non-null id once", () => {
		const rows = [auditRow(), auditRow({ impersonatorUserId: null }), auditRow({ actorUserId: null, organizationId: null })];

		expect(referencedUserIds(rows)).toEqual([ACTOR_ID, IMPERSONATOR_ID]);
		expect(referencedOrganizationIds(rows)).toEqual([ORGANIZATION_ID]);
	});

	it("returns nothing for anonymous, untenanted rows", () => {
		const rows = [auditRow({ actorUserId: null, impersonatorUserId: null, organizationId: null })];

		expect(referencedUserIds(rows)).toEqual([]);
		expect(referencedOrganizationIds(rows)).toEqual([]);
	});
});

describe("toHttpAuditLogSummary", () => {
	it("maps epochs to numbers, derives the duration and resolves actor, impersonator and organization", () => {
		const summary = toHttpAuditLogSummary(auditRow(), REFERENCES);

		expect(summary).toMatchObject({
			occurredAt: OCCURRED_AT,
			completedAt: OCCURRED_AT + DURATION_MS,
			durationMs: DURATION_MS,
			method: "PATCH",
			outcome: "FAILED",
			authMethod: "SESSION_COOKIE",
			actor: { id: ACTOR_ID, email: "user@example.com", fullName: "Demo Customer" },
			impersonator: { id: IMPERSONATOR_ID, email: "superadmin@example.com", fullName: "Super Admin" },
			organization: { id: ORGANIZATION_ID, name: "Kopi Corner" },
			clientType: "admin",
			browserName: "Safari",
			osName: "iOS",
			deviceType: "MOBILE",
			deviceModel: "iPhone",
			ipVersion: 4,
			ipScope: "PUBLIC",
			geoCountry: "MY",
			geoTimeZone: "Asia/Kuala_Lumpur",
		});
	});

	it("keeps the id of a reference that no longer resolves (no foreign keys: the id is the forensic fact)", () => {
		const summary = toHttpAuditLogSummary(auditRow({ actorUserId: UNKNOWN_USER_ID, impersonatorUserId: null, organizationId: null }), REFERENCES);

		expect(summary.actor).toEqual({ id: UNKNOWN_USER_ID, email: null, fullName: null });
		expect(summary.impersonator).toBeNull();
		expect(summary.organization).toBeNull();
	});

	it("never reports a negative duration for a clock-skewed row", () => {
		expect(toHttpAuditLogSummary(auditRow({ completedAt: BigInt(OCCURRED_AT - 1) }), REFERENCES).durationMs).toBe(0);
	});

	it("never carries the payloads (they are detail-only)", () => {
		expect(toHttpAuditLogSummary(auditRow(), REFERENCES)).not.toHaveProperty("requestBody");
	});

	it("keeps any method a client sent — every request is audited, not only the standard methods", () => {
		expect(toHttpAuditLogSummary(auditRow({ method: "PROPFIND" }), REFERENCES).method).toBe("PROPFIND");
	});

	it("rejects a stored IP version that is neither 4 nor 6", () => {
		expect(() => toHttpAuditLogSummary(auditRow({ ipVersion: 5 }), REFERENCES)).toThrow();
	});
});

describe("toHttpAuditLogDetail", () => {
	it("adds the request metadata and the stored (already redacted) payloads", () => {
		const detail = toHttpAuditLogDetail(auditRow(), REFERENCES);

		expect(detail).toMatchObject({
			traceId: "corr-1",
			impersonationSessionId: "session-1",
			httpVersion: "1.1",
			host: "api.example.com",
			origin: "https://admin.example.com",
			referer: "https://admin.example.com/account/profile",
			acceptLanguage: "en-GB",
			requestContentType: "application/json",
			requestBytes: 42,
			idempotencyKey: null,
			requestParams: { params: {}, query: {} },
			requestBody: { fullName: "[PII]" },
			responseBody: { success: false },
			systemOperations: ["audit.http_request.record"],
			createdAt: OCCURRED_AT + DURATION_MS,
		});
	});

	it("reads a row written before the request-metadata columns existed (all NULL)", () => {
		const legacy = auditRow({
			traceId: null,
			impersonationSessionId: null,
			authMethod: null,
			clientType: null,
			httpVersion: null,
			host: null,
			origin: null,
			referer: null,
			acceptLanguage: null,
			requestContentType: null,
			requestBytes: null,
			requestParams: null,
			requestBody: null,
			responseBody: null,
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
		});

		expect(toHttpAuditLogDetail(legacy, REFERENCES)).toMatchObject({ traceId: null, authMethod: null, requestBody: null, responseBody: null });
	});
});
