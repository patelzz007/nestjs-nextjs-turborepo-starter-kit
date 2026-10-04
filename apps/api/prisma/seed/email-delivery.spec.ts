import { DeliveryEventOutcomeSchema, EmailLogStatusSchema } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { buildEmailDeliverySeed } from "./email-delivery";

const NOW_MS = 1_790_812_800_000;
const ADMIN_ID = "8b6f1f0e-0c5e-4c55-9d3c-2f3b5f6a7c01";

describe("buildEmailDeliverySeed", () => {
	const seed = buildEmailDeliverySeed(NOW_MS, ADMIN_ID);
	const events = [...seed.logs.flatMap((row) => row.events), ...seed.unmatchedEvents];

	it("is deterministic (stable ids and content across runs)", () => {
		expect(buildEmailDeliverySeed(NOW_MS, ADMIN_ID)).toEqual(seed);
	});

	it("covers every email status and every delivery outcome the API writes", () => {
		expect(new Set(seed.logs.map((row) => row.status))).toEqual(new Set(EmailLogStatusSchema.options));
		expect(new Set(events.map((event) => event.outcome))).toEqual(new Set(DeliveryEventOutcomeSchema.options));
	});

	it("uses unique webhook ids (the dedupe key)", () => {
		const webhookIds = events.map((event) => event.webhookId);
		expect(new Set(webhookIds).size).toBe(webhookIds.length);
	});

	it("stamps last_event_at with the newest APPLIED event, as the ordering guard does", () => {
		for (const row of seed.logs) {
			const applied = row.events.filter((event) => event.outcome === "applied").map((event) => event.occurredAt);
			const newest = applied.length === 0 ? null : applied.reduce((latest, at) => (at > latest ? at : latest));
			expect(row.lastEventAt).toBe(newest);
		}
	});

	it("never records a stale event newer than the row's latest applied event", () => {
		for (const row of seed.logs) {
			for (const event of row.events.filter((candidate) => candidate.outcome === "stale")) {
				expect(event.occurredAt <= (row.lastEventAt ?? 0n)).toBe(true);
			}
		}
	});

	it("gives provider ids only to attempts the provider accepted", () => {
		for (const row of seed.logs) {
			expect(row.resendId === null).toBe(row.status === "pending" || row.status === "failed");
		}
	});

	it("records the full audit context on the admin test-send, and nowhere else", () => {
		const audited = seed.logs.filter((row) => row.metadata.trigger !== undefined);

		expect(audited).toHaveLength(1);
		expect(audited.at(0)?.metadata).toMatchObject({ trigger: "admin-test-send", actorUserId: ADMIN_ID, mode: "send" });
		expect(Object.keys(audited.at(0)?.metadata ?? {})).toEqual(expect.arrayContaining(["correlationId", "ipAddress", "userAgent"]));
	});
});
