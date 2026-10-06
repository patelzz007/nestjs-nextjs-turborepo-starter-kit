import { describe, expect, it } from "vitest";

import { captureFastifyRequest } from "../../../test/support/fastify-request";
import type { RequestContext, RequestPrincipal } from "../context/request-context";
import { REDACTED } from "../logging/redaction";
import {
	AUDIT_PAYLOAD_MAX_BYTES,
	buildHttpAuditEntry,
	defaultSuccessStatus,
	isAuditedRoute,
	PII_MASK,
	toAuditPayload,
	toWireJson,
	UNMATCHED_ENDPOINT,
} from "./http-audit-entry";

const RECEIVED_AT = 1_790_812_800_000;
const COMPLETED_AT = RECEIVED_AT + 25;

function context(overrides: Partial<RequestContext> = {}): RequestContext {
	return {
		correlationId: "corr-audit-1",
		traceId: "corr-audit-1",
		ip: "203.0.113.9",
		userAgent: "vitest-agent",
		edgeLocation: undefined,
		principal: { userId: "user-1", impersonatorId: "admin-9", impersonationSessionId: "imp-session-3", authMethod: "SESSION_COOKIE" },
		apiKey: undefined,
		tenant: { organizationId: "org-1", storeId: "store-1", locationId: undefined },
		systemOperations: ["platform.superadmin", "geo.reference_data.write"],
		receivedAtEpochMs: RECEIVED_AT,
		isAuditRecorded: false,
		...overrides,
	};
}

describe("isAuditedRoute / defaultSuccessStatus", () => {
	it("audits every request, reads and unmatched routes included", () => {
		expect(["/api/v1/geo/stats", "/api/v1/product", "/health/deep", "/", undefined].map(isAuditedRoute)).toEqual([true, true, true, true, true]);
		expect(UNMATCHED_ENDPOINT).toBe("(unmatched)");
	});

	it("exempts only the automated health probes", () => {
		expect(["/health/live", "/health/ready", "/health"].map(isAuditedRoute)).toEqual([false, false, false]);
	});

	it("mirrors Nest's default status (201 for POST, 200 otherwise)", () => {
		expect(defaultSuccessStatus("post")).toBe(201);
		expect(defaultSuccessStatus("PATCH")).toBe(200);
	});
});

describe("toAuditPayload", () => {
	it("redacts secrets at any depth and masks personal data", () => {
		expect(
			toAuditPayload({
				email: "jane.doe@example.com",
				password: "hunter2",
				profile: { fullName: "Jane Doe", phone: "+60123456789", nested: [{ refreshToken: "t" }] },
				name: "Mug",
			}),
		).toEqual({
			email: "j***@example.com",
			password: REDACTED,
			profile: { fullName: PII_MASK, phone: PII_MASK, nested: [{ refreshToken: REDACTED }] },
			name: "Mug",
		});
	});

	it("masks a non-email value in an email field completely", () => {
		expect(toAuditPayload({ email: "not-an-email" })).toEqual({ email: PII_MASK });
	});

	it("replaces an oversized payload with a truncation marker instead of cutting it mid-structure", () => {
		const big = { blob: "x".repeat(AUDIT_PAYLOAD_MAX_BYTES) };

		const marker = toAuditPayload(big);
		const bytes: number = Buffer.byteLength(JSON.stringify(big), "utf8");

		expect(marker).toEqual({ truncated: true, originalBytes: bytes });
	});

	it("keeps null as SQL NULL", () => {
		expect(toAuditPayload(null)).toBeNull();
	});
});

describe("toWireJson", () => {
	it("converts the pre-serialization form exactly like the response hook (bigint → number)", () => {
		expect(toWireJson({ count: BigInt(7), list: [BigInt(1)] })).toEqual({ count: 7, list: [1] });
		expect(toWireJson(undefined)).toBeNull();
	});
});

describe("buildHttpAuditEntry", () => {
	it("builds a complete row from the request and the VERIFIED request context", async () => {
		const payload: string = JSON.stringify({ name: "Mug", password: "secret" });
		const request = await captureFastifyRequest({
			headers: {
				"content-type": "application/json",
				"x-organization-id": "org-forged",
				"x-client-type": "admin",
				origin: "https://admin.example.com",
				referer: "https://admin.example.com/catalog/products/new",
				"accept-language": "en-GB,en;q=0.9",
				"idempotency-key": "create-mug-0001",
			},
			payload,
		});

		const entry = buildHttpAuditEntry(request, context(), { outcome: "SUCCEEDED", status: 201, responseBody: { id: "p-1", token: "abc" } }, COMPLETED_AT);

		expect(entry).toEqual({
			correlationId: "corr-audit-1",
			traceId: "corr-audit-1",
			occurredAt: RECEIVED_AT,
			completedAt: COMPLETED_AT,
			method: "POST",
			endpoint: "/capture",
			path: "/capture",
			outcome: "SUCCEEDED",
			responseStatus: 201,
			errorCode: null,
			actorUserId: "user-1",
			impersonatorUserId: "admin-9",
			impersonationSessionId: "imp-session-3",
			authMethod: "SESSION_COOKIE",
			apiKeyId: null,
			terminalId: null,
			organizationId: "org-1",
			storeId: "store-1",
			locationId: null,
			ipAddress: "203.0.113.9",
			userAgent: "vitest-agent",
			browserName: null,
			browserVersion: null,
			osName: null,
			osVersion: null,
			deviceType: "UNKNOWN",
			deviceModel: null,
			ipVersion: 4,
			ipScope: "DOCUMENTATION",
			geoCountry: null,
			geoRegion: null,
			geoCity: null,
			geoTimeZone: null,
			clientType: "admin",
			httpVersion: "1.1",
			host: "localhost:80",
			origin: "https://admin.example.com",
			referer: "https://admin.example.com/catalog/products/new",
			acceptLanguage: "en-GB,en;q=0.9",
			requestContentType: "application/json",
			requestBytes: Buffer.byteLength(payload, "utf8"),
			idempotencyKey: "create-mug-0001",
			requestParams: { params: {}, query: {} },
			requestBody: { name: "Mug", password: REDACTED },
			responseBody: { id: "p-1", token: REDACTED },
			systemOperations: ["platform.superadmin", "geo.reference_data.write"],
		});
	});

	it("records an API-key caller and its organization when no user principal exists", async () => {
		const request = await captureFastifyRequest({ headers: {} });

		const entry = buildHttpAuditEntry(
			request,
			context({
				principal: undefined,
				tenant: { organizationId: undefined, storeId: undefined, locationId: undefined },
				apiKey: { apiKeyId: "key-1", organizationId: "org-pos", terminalId: "T-1", locationId: null },
			}),
			{ outcome: "FAILED", status: 409, errorCode: "CONFLICT", responseBody: { success: false } },
			COMPLETED_AT,
		);

		expect(entry).toMatchObject({
			actorUserId: null,
			authMethod: "API_KEY",
			impersonationSessionId: null,
			apiKeyId: "key-1",
			terminalId: "T-1",
			organizationId: "org-pos",
			outcome: "FAILED",
			errorCode: "CONFLICT",
			requestBody: null,
		});
	});

	it("never stores a non-JSON body, only a marker naming its content type", async () => {
		const request = await captureFastifyRequest({ headers: { "content-type": "text/plain" }, payload: "raw text" });

		const entry = buildHttpAuditEntry(request, context(), { outcome: "SUCCEEDED", status: 201, responseBody: undefined }, COMPLETED_AT);

		expect(entry.requestBody).toEqual({ omitted: "non-JSON body", contentType: "text/plain" });
		expect(entry.responseBody).toBeNull();
	});

	it("records an anonymous request with no auth method and no browser headers", async () => {
		const request = await captureFastifyRequest({ headers: {} });

		const entry = buildHttpAuditEntry(
			request,
			context({ principal: undefined }),
			{ outcome: "FAILED", status: 401, errorCode: "UNAUTHORIZED", responseBody: null },
			COMPLETED_AT,
		);

		expect(entry).toMatchObject({
			actorUserId: null,
			authMethod: null,
			impersonationSessionId: null,
			clientType: null,
			origin: null,
			referer: null,
			acceptLanguage: null,
			idempotencyKey: null,
			requestContentType: null,
		});
	});

	it("records the credential a user principal authenticated with", async () => {
		const request = await captureFastifyRequest({ headers: {} });
		const principal: Omit<RequestPrincipal, "authMethod"> = { userId: "user-1", impersonatorId: undefined, impersonationSessionId: undefined };

		const bearer = buildHttpAuditEntry(
			request,
			context({ principal: { ...principal, authMethod: "BEARER_TOKEN" } }),
			{ outcome: "SUCCEEDED", status: 200, responseBody: undefined },
			COMPLETED_AT,
		);
		const refresh = buildHttpAuditEntry(
			request,
			context({ principal: { ...principal, authMethod: "REFRESH_COOKIE" } }),
			{ outcome: "SUCCEEDED", status: 200, responseBody: undefined },
			COMPLETED_AT,
		);

		expect(bearer.authMethod).toBe("BEARER_TOKEN");
		expect(refresh.authMethod).toBe("REFRESH_COOKIE");
	});

	it("describes the device, the address and the CDN edge location", async () => {
		const request = await captureFastifyRequest({ headers: {} });
		const chromeOnMac = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36";

		const entry = buildHttpAuditEntry(
			request,
			context({
				userAgent: chromeOnMac,
				ip: "::ffff:10.1.2.3",
				edgeLocation: { country: "MY", region: "Selangor", city: "Shah Alam", timeZone: "Asia/Kuala_Lumpur" },
			}),
			{ outcome: "SUCCEEDED", status: 200, responseBody: undefined },
			COMPLETED_AT,
		);

		expect(entry).toMatchObject({
			browserName: "Chrome",
			browserVersion: "129.0.0.0",
			osName: "macOS",
			osVersion: "10.15.7",
			deviceType: "DESKTOP",
			ipVersion: 4,
			ipScope: "PRIVATE",
			geoCountry: "MY",
			geoRegion: "Selangor",
			geoCity: "Shah Alam",
			geoTimeZone: "Asia/Kuala_Lumpur",
		});
	});

	it("leaves the device and network columns empty when the request carried neither", async () => {
		const request = await captureFastifyRequest({ headers: {} });

		const entry = buildHttpAuditEntry(request, context({ userAgent: undefined, ip: undefined }), { outcome: "SUCCEEDED", status: 200, responseBody: undefined }, COMPLETED_AT);

		expect(entry).toMatchObject({ deviceType: null, browserName: null, ipVersion: null, ipScope: null });
	});

	it("redacts sensitive query parameters in the Referer exactly like in the path", async () => {
		const request = await captureFastifyRequest({ headers: { referer: "https://admin.example.com/auth/reset-password?token=abc123&step=2" } });

		const entry = buildHttpAuditEntry(request, context(), { outcome: "SUCCEEDED", status: 201, responseBody: undefined }, COMPLETED_AT);

		expect(entry.referer).toBe(`https://admin.example.com/auth/reset-password?token=${REDACTED}&step=2`);
	});

	it("bounds every free-text header to its column", async () => {
		const request = await captureFastifyRequest({ headers: { "x-client-type": "x".repeat(100), "accept-language": "y".repeat(1_000) } });

		const entry = buildHttpAuditEntry(request, context(), { outcome: "SUCCEEDED", status: 201, responseBody: undefined }, COMPLETED_AT);

		expect(entry.clientType).toHaveLength(32);
		expect(entry.acceptLanguage).toHaveLength(256);
	});
});
