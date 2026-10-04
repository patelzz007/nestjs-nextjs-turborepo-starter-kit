import { describe, expect, it } from "vitest";

import { captureFastifyRequest } from "../../../test/support/fastify-request";
import type { RequestContext } from "../context/request-context";
import { REDACTED } from "../logging/redaction";
import { AUDIT_PAYLOAD_MAX_BYTES, buildHttpAuditEntry, defaultSuccessStatus, isAuditedMethod, PII_MASK, toAuditPayload, toWireJson } from "./http-audit-entry";

const RECEIVED_AT = 1_790_812_800_000;
const COMPLETED_AT = RECEIVED_AT + 25;

function context(overrides: Partial<RequestContext> = {}): RequestContext {
	return {
		correlationId: "corr-audit-1",
		traceId: "corr-audit-1",
		ip: "203.0.113.9",
		userAgent: "vitest-agent",
		principal: { userId: "user-1", impersonatorId: "admin-9" },
		apiKey: undefined,
		tenant: { organizationId: "org-1", storeId: "store-1", locationId: undefined },
		systemOperations: ["platform.superadmin", "geo.reference_data.write"],
		receivedAtEpochMs: RECEIVED_AT,
		isAuditRecordedInTransaction: false,
		...overrides,
	};
}

describe("isAuditedMethod / defaultSuccessStatus", () => {
	it("audits exactly the state-changing methods", () => {
		expect(["POST", "put", "PATCH", "DELETE"].map(isAuditedMethod)).toEqual([true, true, true, true]);
		expect(["GET", "HEAD", "OPTIONS"].map(isAuditedMethod)).toEqual([false, false, false]);
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
		const request = await captureFastifyRequest({
			headers: { "content-type": "application/json", "x-organization-id": "org-forged" },
			payload: JSON.stringify({ name: "Mug", password: "secret" }),
		});

		const entry = buildHttpAuditEntry(request, context(), { outcome: "SUCCEEDED", status: 201, responseBody: { id: "p-1", token: "abc" } }, COMPLETED_AT);

		expect(entry).toEqual({
			correlationId: "corr-audit-1",
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
			apiKeyId: null,
			terminalId: null,
			organizationId: "org-1",
			storeId: "store-1",
			locationId: null,
			ipAddress: "203.0.113.9",
			userAgent: "vitest-agent",
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
});
