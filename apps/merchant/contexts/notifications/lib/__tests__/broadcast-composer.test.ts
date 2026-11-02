import { epochMs, type BroadcastResponse, type RichTextDocument } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import {
	broadcastComposerValuesOf,
	emptyBroadcastComposerValues,
	toBroadcastAudience,
	toBroadcastDraft,
	type BroadcastComposerValues,
} from "@/contexts/notifications/lib/broadcast-composer";

const KL = "Asia/Kuala_Lumpur";
const NOW = Date.UTC(2026, 10, 1, 0, 0);
const CUSTOMER = "0193f2c4-0000-7000-8000-0000000000a1";
const BODY: RichTextDocument = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Half price lattes this Saturday" }] }] };

function values(overrides: Partial<BroadcastComposerValues> = {}): BroadcastComposerValues {
	return { ...emptyBroadcastComposerValues("2026-11-03"), title: "Weekend specials", body: BODY, ...overrides };
}

describe("toBroadcastAudience", () => {
	it("sends everyone the filters match when no one is picked", () => {
		expect(toBroadcastAudience(values())).toEqual({ kind: "tenant-customers", claimedWithinDays: 60, redeemed: "any", locationId: null, customerIds: null });
	});

	it("sends only the picked people when the merchant picked", () => {
		expect(toBroadcastAudience(values({ recipients: "chosen-customers", customerIds: [CUSTOMER] })).customerIds).toEqual([CUSTOMER]);
	});

	it("ignores an earlier pick once the merchant switches back to all customers", () => {
		expect(toBroadcastAudience(values({ recipients: "all-customers", customerIds: [CUSTOMER] })).customerIds).toBeNull();
	});
});

describe("toBroadcastDraft", () => {
	it("builds a marketing draft sent as soon as it is scheduled", () => {
		const result = toBroadcastDraft(values(), KL, NOW);

		expect(result.ok).toBe(true);
		expect(result.ok ? result.draft : null).toMatchObject({ title: "Weekend specials", category: "MARKETING", sendMode: "INSTANT", sendAt: null, localSendAt: null });
	});

	it("turns a set time into the instant it is in the store's zone", () => {
		const result = toBroadcastDraft(values({ timing: "at-time", sendDate: "2026-11-03", sendTime: "09:00" }), KL, NOW);

		// 09:00 in Kuala Lumpur (UTC+8) is 01:00 UTC.
		expect(result.ok ? result.draft.sendAt : null).toBe(Date.UTC(2026, 10, 3, 1, 0));
	});

	it("keeps a customer-local time floating, for each customer's own zone", () => {
		const result = toBroadcastDraft(values({ timing: "recipient-local-time", sendDate: "2026-11-03", sendTime: "09:00" }), KL, NOW);

		expect(result.ok ? result.draft : null).toMatchObject({ sendMode: "RECIPIENT_LOCAL_TIME", sendAt: null, localSendAt: Date.UTC(2026, 10, 3, 9, 0) });
	});

	it("names every gap in the merchant's words", () => {
		const result = toBroadcastDraft(values({ title: " ", body: null, recipients: "chosen-customers", customerIds: [], channels: [] }), KL, NOW);

		expect(result.ok ? {} : result.errors).toEqual({
			title: "Give it a title.",
			body: "Write the message.",
			audience: "Pick at least one customer, or send it to all your customers.",
			channels: "Choose at least one way to send it.",
		});
	});

	it("refuses a set time that has already passed", () => {
		const result = toBroadcastDraft(values({ timing: "at-time", sendDate: "2026-10-01", sendTime: "09:00" }), KL, NOW);

		expect(result.ok ? null : result.errors.schedule).toBe("Pick a time that has not passed yet.");
	});
});

const SAVED: BroadcastResponse = {
	id: "0193f2c4-0000-7000-8000-0000000000b1",
	tenantId: "0193f2c4-0000-7000-8000-0000000000c1",
	status: "DRAFT",
	title: "Weekend specials",
	body: BODY,
	audience: { kind: "tenant-customers", claimedWithinDays: 30, redeemed: "redeemed", locationId: null, customerIds: [CUSTOMER] },
	channels: ["EMAIL"],
	category: "MARKETING",
	sendMode: "INSTANT",
	sendAt: epochMs(Date.UTC(2026, 10, 3, 1, 0)),
	localSendAt: null,
	audienceCount: null,
	authorUserId: "0193f2c4-0000-7000-8000-0000000000d1",
	approverUserId: null,
	sendingStartedAt: null,
	completedAt: null,
	cancelledAt: null,
	pausedAt: null,
	pauseReason: null,
	results: [
		{ channel: "EMAIL", targeted: 10, delivered: 7, failed: 1, suppressed: [{ reason: "no-consent", count: 2 }], engaged: null },
		{ channel: "PUSH", targeted: 5, delivered: 4, failed: 0, suppressed: [], engaged: 1 },
	],
	openReports: 0,
	createdAt: epochMs(NOW),
	updatedAt: epochMs(NOW),
	isDeleted: false,
	deletedAt: null,
};

describe("broadcastComposerValuesOf", () => {
	it("opens a saved draft with its audience, channels and send time in the store's zone", () => {
		expect(broadcastComposerValuesOf(SAVED, KL, "2026-11-01")).toMatchObject({
			title: "Weekend specials",
			recipients: "chosen-customers",
			customerIds: [CUSTOMER],
			claimedWithinDays: 30,
			redeemed: "redeemed",
			channels: ["EMAIL"],
			timing: "at-time",
			sendDate: "2026-11-03",
			sendTime: "09:00",
		});
	});

	it("opens a customer-local broadcast at its floating time", () => {
		const local: BroadcastResponse = { ...SAVED, sendMode: "RECIPIENT_LOCAL_TIME", sendAt: null, localSendAt: epochMs(Date.UTC(2026, 10, 4, 18, 30)) };
		expect(broadcastComposerValuesOf(local, KL, "2026-11-01")).toMatchObject({ timing: "recipient-local-time", sendDate: "2026-11-04", sendTime: "18:30" });
	});
});
