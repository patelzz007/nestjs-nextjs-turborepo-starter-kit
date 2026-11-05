import { describe, expect, it } from "vitest";

import { epochMs } from "../../../../schemas/api/common";

import {
	ReceivedWebhookDetailSchema,
	ReceivedWebhookIdParamSchema,
	ReceivedWebhookListQuerySchema,
	ReceivedWebhookSummarySchema,
	type ReceivedWebhookDetail,
	type ReceivedWebhookSummary,
} from "../received-webhooks";

const SUMMARY: ReceivedWebhookSummary = {
	id: "0193f3a8-3b1c-7c4e-9d2a-5b6c7d8e9f01",
	provider: "GITHUB",
	providerDeliveryId: "72d3162e-cc78-11e3-81ab-4c9367dc0958",
	eventType: "pull_request",
	verification: "VALID",
	outcome: "RECORDED",
	httpStatus: 200,
	attempts: 1,
	duplicateCount: 0,
	receivedAt: epochMs(1_762_000_000_000),
	lastReceivedAt: epochMs(1_762_000_000_000),
	completedAt: epochMs(1_762_000_000_050),
	correlationId: "req-1",
};

const DETAIL: ReceivedWebhookDetail = {
	...SUMMARY,
	payloadSha256: "a".repeat(64),
	payloadBytes: 1_024,
	headers: { "content-type": "application/json", "x-github-event": "pull_request" },
	errorSummary: null,
	claimedAt: epochMs(1_762_000_000_001),
};

describe("ReceivedWebhookSummarySchema", () => {
	it("round-trips a row and strips unknown keys", () => {
		expect(ReceivedWebhookSummarySchema.parse({ ...SUMMARY, payload: "never sent" })).toEqual(SUMMARY);
	});

	it("allows a rejected request with no delivery id and a still-processing one with no status", () => {
		expect(ReceivedWebhookSummarySchema.safeParse({ ...SUMMARY, providerDeliveryId: null, verification: "INVALID", outcome: "REJECTED", httpStatus: 401 }).success).toBe(true);
		expect(ReceivedWebhookSummarySchema.safeParse({ ...SUMMARY, outcome: "PROCESSING", httpStatus: null, completedAt: null }).success).toBe(true);
	});

	it("rejects a provider, verification or outcome the server does not know", () => {
		expect(ReceivedWebhookSummarySchema.safeParse({ ...SUMMARY, provider: "STRIPE" }).success).toBe(false);
		expect(ReceivedWebhookSummarySchema.safeParse({ ...SUMMARY, verification: "MAYBE" }).success).toBe(false);
		expect(ReceivedWebhookSummarySchema.safeParse({ ...SUMMARY, outcome: "LOST" }).success).toBe(false);
	});
});

describe("ReceivedWebhookDetailSchema", () => {
	it("round-trips a complete row", () => {
		expect(ReceivedWebhookDetailSchema.parse(DETAIL)).toEqual(DETAIL);
	});

	it("requires a full hex SHA-256", () => {
		expect(ReceivedWebhookDetailSchema.safeParse({ ...DETAIL, payloadSha256: "abc" }).success).toBe(false);
	});
});

describe("ReceivedWebhookIdParamSchema", () => {
	it("takes a UUID and nothing else", () => {
		expect(ReceivedWebhookIdParamSchema.safeParse({ id: SUMMARY.id }).success).toBe(true);
		expect(ReceivedWebhookIdParamSchema.safeParse({ id: "not-a-uuid" }).success).toBe(false);
		expect(ReceivedWebhookIdParamSchema.safeParse({ id: SUMMARY.id, extra: 1 }).success).toBe(false);
	});
});

describe("ReceivedWebhookListQuerySchema", () => {
	it("defaults to newest first and reads the provider and outcome filters", () => {
		const query = ReceivedWebhookListQuerySchema.parse({ filter: { provider: { in: "GITHUB,CHIP" }, outcome: "FAILED" } });

		expect(query.sort).toBeUndefined();
		expect(query.filter).toEqual({ provider: { in: ["GITHUB", "CHIP"] }, outcome: { eq: "FAILED" } });
	});

	it("refuses a filter on a provider it does not know, and a sort field it does not offer", () => {
		expect(ReceivedWebhookListQuerySchema.safeParse({ filter: { provider: "STRIPE" } }).success).toBe(false);
		expect(ReceivedWebhookListQuerySchema.safeParse({ sort: "payloadBytes" }).success).toBe(false);
	});
});
