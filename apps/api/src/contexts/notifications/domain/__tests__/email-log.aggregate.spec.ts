import { EmailLogStatusSchema, epochMs, type EmailLogStatus, type EpochMs } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { ALLOWED_FROM, EmailLog } from "../aggregates/email-log.aggregate";
import { CorruptEmailLogStateError } from "../errors/notifications.errors";
import { EmailAttemptFinalized } from "../events/email-log-updated.event";

const ID = "6b1f3e2a-9c4d-4e5f-8a7b-1c2d3e4f5a6b";
const NOW: EpochMs = epochMs(1_800_000_000_000);
const STATUSES: readonly EmailLogStatus[] = EmailLogStatusSchema.options;

function log(status: string): EmailLog {
	return EmailLog.rehydrate({ id: ID, templateKey: "welcome", to: "a@example.com", status });
}

describe("EmailLog.rehydrate (D32)", () => {
	it.each(STATUSES)("loads a stored %s row", (status: EmailLogStatus) => {
		expect(log(status).status).toBe(status);
		expect(log(status).concurrencyToken).toBe(status);
	});

	it.each(["queued", "", "SENT", "delivered "])("refuses an unknown stored status %j with CORRUPT_AGGREGATE_STATE — never a guess", (status: string) => {
		expect(() => log(status)).toThrow(CorruptEmailLogStateError);
		expect(() => EmailLog.parseStoredStatus(ID, status)).toThrow(expect.objectContaining({ code: "CORRUPT_AGGREGATE_STATE", details: { aggregateId: ID } }));
	});
});

describe("EmailLog forward-only transitions (ALLOWED_FROM)", () => {
	it("lets every outcome follow pending (a webhook can beat the send call back)", () => {
		for (const next of STATUSES) {
			expect(EmailLog.allowedFrom(next)).toContain("pending");
		}
	});

	it("never lets a progressed row regress to sent or pending", () => {
		expect(ALLOWED_FROM.sent).toEqual(["pending", "sent"]);
		expect(ALLOWED_FROM.pending).toEqual(["pending"]);
	});

	it("lets delivered follow a soft bounce, and failed follow everything", () => {
		expect(ALLOWED_FROM.delivered).toContain("bounced");
		expect(ALLOWED_FROM.failed).toEqual(STATUSES);
	});

	it("allows each status to repeat itself (an idempotent redelivery)", () => {
		for (const status of STATUSES) {
			expect(ALLOWED_FROM[status]).toContain(status);
		}
	});
});

describe("EmailLog outcomes", () => {
	it("waits for delivery only while pending", () => {
		expect(log("pending").isAwaitingDelivery()).toBe(true);
		for (const status of STATUSES.filter((value) => value !== "pending")) {
			expect(log(status).isAwaitingDelivery()).toBe(false);
		}
	});

	it("records one outcome event without the recipient address (PII stays off the Kafka wire)", () => {
		const sent = log("pending");
		sent.recordSent("resend-1", 12, NOW);
		const failed = log("pending");
		failed.recordFailed("bounced hard", null, NOW);

		const [sentEvent] = sent.pullEvents();
		expect(sentEvent).toBeInstanceOf(EmailAttemptFinalized);
		expect(sentEvent?.attempt).toEqual({ templateKey: "welcome", status: "sent", resendId: "resend-1", error: null, durationMs: 12 });
		expect(failed.pullEvents().at(0)?.attempt).toEqual({ templateKey: "welcome", status: "failed", resendId: null, error: "bounced hard", durationMs: null });
		expect(sent.pullEvents()).toEqual([]);
	});
});
