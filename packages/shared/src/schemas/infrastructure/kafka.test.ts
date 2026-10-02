import { describe, expect, it } from "vitest";

import {
	KAFKA_TOPICS,
	PLATFORM_EVENT_TOPICS,
	PlatformEventEnvelopeSchema,
	PlatformEventInputSchema,
	PlatformEventMessageSchema,
	readPlatformEventOrganizationId,
	type PlatformEventEnvelope,
	type PlatformEventType,
} from "./kafka";

const EVENT_ID = "0b8f5a52-6a3c-4c3e-9d8e-5d8b5f0f4a11";
const ORGANIZATION_ID = "5c1f7a9e-2b4d-4e8f-a1b2-c3d4e5f60718";
const OCCURRED_AT_MS = 1_790_812_800_000;

function buildSessionEnvelope(): PlatformEventEnvelope {
	return PlatformEventEnvelopeSchema.parse({
		type: "session.action",
		correlationId: "corr-1",
		occurredAt: OCCURRED_AT_MS,
		payload: { action: "logout-all", userId: "user-1", status: "succeeded", error: null, durationMs: 4 },
	});
}

describe("PlatformEventMessageSchema", () => {
	it("accepts a stored envelope plus a uuid eventId", () => {
		const message = PlatformEventMessageSchema.parse({ ...buildSessionEnvelope(), eventId: EVENT_ID });

		expect(message.eventId).toBe(EVENT_ID);
		expect(message.type).toBe("session.action");
	});

	it("rejects a message without an eventId — consumers could not dedupe it", () => {
		expect(PlatformEventMessageSchema.safeParse(buildSessionEnvelope()).success).toBe(false);
	});

	it("rejects a non-uuid eventId", () => {
		expect(PlatformEventMessageSchema.safeParse({ ...buildSessionEnvelope(), eventId: "not-a-uuid" }).success).toBe(false);
	});

	it("stays strict — unknown top-level keys are rejected", () => {
		expect(PlatformEventMessageSchema.safeParse({ ...buildSessionEnvelope(), eventId: EVENT_ID, extra: true }).success).toBe(false);
	});

	it("rejects a payload that does not match its discriminated type", () => {
		const result = PlatformEventMessageSchema.safeParse({
			type: "auth.flow",
			eventId: EVENT_ID,
			correlationId: null,
			occurredAt: OCCURRED_AT_MS,
			payload: { action: "logout-all", userId: "user-1", status: "succeeded", error: null, durationMs: 4 },
		});

		expect(result.success).toBe(false);
	});
});

describe("PlatformEventEnvelopeSchema", () => {
	it("rejects an eventId — the stored envelope never duplicates the outbox row id", () => {
		expect(PlatformEventEnvelopeSchema.safeParse({ ...buildSessionEnvelope(), eventId: EVENT_ID }).success).toBe(false);
	});
});

describe("PlatformEventInputSchema", () => {
	it("accepts only the type and payload a producer owns", () => {
		const input = PlatformEventInputSchema.parse({
			type: "reward.platform",
			payload: { event: "reward.auto_published", actorUserId: null, organizationId: ORGANIZATION_ID, metadata: { rewardId: "reward-1" } },
		});

		expect(input.type).toBe("reward.platform");
	});

	it("rejects producer-supplied correlationId / occurredAt — the outbox stamps them", () => {
		const result = PlatformEventInputSchema.safeParse({
			type: "session.action",
			correlationId: "forged",
			payload: { action: "logout-all", userId: "user-1", status: "succeeded", error: null, durationMs: 4 },
		});

		expect(result.success).toBe(false);
	});
});

describe("PLATFORM_EVENT_TOPICS", () => {
	it("routes every event type to a declared Kafka topic", () => {
		const types: PlatformEventType[] = ["auth.flow", "session.action", "impersonation.action", "email.log.updated", "reward.platform"];

		for (const type of types) {
			expect(KAFKA_TOPICS).toContain(PLATFORM_EVENT_TOPICS[type]);
		}
	});
});

describe("readPlatformEventOrganizationId", () => {
	it("returns the tenant tag when the payload carries one", () => {
		expect(readPlatformEventOrganizationId({ event: "reward.claim_expired", actorUserId: null, organizationId: ORGANIZATION_ID, metadata: {} })).toBe(ORGANIZATION_ID);
	});

	it("returns null for payloads without a tenant tag", () => {
		expect(readPlatformEventOrganizationId(buildSessionEnvelope().payload)).toBeNull();
	});
});
