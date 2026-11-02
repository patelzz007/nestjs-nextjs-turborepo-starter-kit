import { epochMs, type BroadcastResponse, type RichTextDocument } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import {
	broadcastScheduleProblemOf,
	broadcastScheduleValuesOf,
	broadcastTimingFields,
	broadcastTotals,
	buildBroadcastDraft,
	formatWallClock,
	isBroadcastCancellable,
	isBroadcastEditable,
	toBroadcastBody,
	wallClockOf,
	type BroadcastDraftParts,
	type BroadcastScheduleValues,
} from "../broadcast-draft";

const KL = "Asia/Kuala_Lumpur";
const NOW = Date.UTC(2026, 10, 1, 0, 0);
const BODY: RichTextDocument = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Planned maintenance on Sunday" }] }] };

function parts(overrides: Partial<BroadcastDraftParts> = {}): BroadcastDraftParts {
	return {
		title: "Maintenance",
		body: BODY,
		channels: ["IN_APP", "EMAIL"],
		schedule: { timing: "now", sendDate: "2026-11-03", sendTime: "09:00" },
		audience: { kind: "platform-users", surfaces: ["CUSTOMER"], signedUpAfter: null, tenantStates: null },
		category: "PRODUCT",
		audienceProblem: null,
		...overrides,
	};
}

describe("wallClockOf", () => {
	it("reads a date and a time as a floating wall-clock instant", () => {
		expect(wallClockOf("2026-11-03", "09:30")).toBe(Date.UTC(2026, 10, 3, 9, 30));
	});

	it("is null for anything malformed", () => {
		expect(wallClockOf("3/11/2026", "09:30")).toBeNull();
		expect(wallClockOf("2026-11-03", "9am")).toBeNull();
	});
});

describe("formatWallClock", () => {
	it("reads a floating time as written, whatever the browser's zone", () => {
		expect(formatWallClock(Date.UTC(2026, 10, 3, 9, 0))).toBe("3 Nov 2026, 09:00");
	});
});

describe("broadcastTimingFields", () => {
	it("sends at once, at an instant in the sender's zone, or at a floating time for each recipient", () => {
		const at = { sendDate: "2026-11-03", sendTime: "09:00" };
		expect(broadcastTimingFields({ timing: "now", ...at }, KL)).toEqual({ sendMode: "INSTANT", sendAt: null, localSendAt: null });
		expect(broadcastTimingFields({ timing: "at-time", ...at }, KL)).toEqual({ sendMode: "INSTANT", sendAt: Date.UTC(2026, 10, 3, 1, 0), localSendAt: null });
		expect(broadcastTimingFields({ timing: "recipient-local-time", ...at }, KL)).toEqual({
			sendMode: "RECIPIENT_LOCAL_TIME",
			sendAt: null,
			localSendAt: Date.UTC(2026, 10, 3, 9, 0),
		});
	});

	it("names a missing or past send time", () => {
		expect(broadcastScheduleProblemOf({ timing: "now", sendDate: "", sendTime: "" }, KL, NOW)).toBeNull();
		expect(broadcastScheduleProblemOf({ timing: "at-time", sendDate: "", sendTime: "09:00" }, KL, NOW)).toBe("Pick a date and a time.");
		expect(broadcastScheduleProblemOf({ timing: "at-time", sendDate: "2026-10-01", sendTime: "09:00" }, KL, NOW)).toBe("Pick a time that has not passed yet.");
		expect(broadcastScheduleProblemOf({ timing: "recipient-local-time", sendDate: "2026-10-01", sendTime: "09:00" }, KL, NOW)).toBeNull();
	});
});

describe("buildBroadcastDraft", () => {
	it("builds the draft of the sender's audience and kind", () => {
		const result = buildBroadcastDraft(parts(), KL, NOW);
		expect(result.ok ? result.draft : null).toMatchObject({ title: "Maintenance", category: "PRODUCT", channels: ["IN_APP", "EMAIL"], sendMode: "INSTANT", sendAt: null });
	});

	it("names every gap in the sender's words, the audience's own problem included", () => {
		const result = buildBroadcastDraft(parts({ title: " ", body: null, channels: [], audienceProblem: "Choose who gets it." }), KL, NOW);
		expect(result.ok ? {} : result.errors).toEqual({
			title: "Give it a title.",
			body: "Write the message.",
			audience: "Choose who gets it.",
			channels: "Choose at least one way to send it.",
		});
	});

	it("points an invalid audience at the audience", () => {
		const result = buildBroadcastDraft(parts({ audience: { kind: "platform-users", surfaces: [], signedUpAfter: null, tenantStates: null } }), KL, NOW);
		expect(result.ok ? null : result.errors.audience).toBe("Choose who gets it.");
	});
});

describe("toBroadcastBody", () => {
	it("keeps a document with words in it", () => {
		expect(toBroadcastBody(BODY)).toEqual(BODY);
	});

	it("is null for an empty document or one a broadcast may not hold", () => {
		expect(toBroadcastBody({ type: "doc", content: [{ type: "paragraph" }] })).toBeNull();
		expect(toBroadcastBody({ type: "doc", content: [{ type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "x" }] }] })).toBeNull();
	});
});

const SAVED: BroadcastResponse = {
	id: "0193f2c4-0000-7000-8000-0000000000b1",
	tenantId: null,
	status: "DRAFT",
	title: "Maintenance",
	body: BODY,
	audience: { kind: "platform-users", surfaces: ["CUSTOMER"], signedUpAfter: null, tenantStates: null },
	channels: ["EMAIL"],
	category: "PRODUCT",
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

describe("broadcastScheduleValuesOf", () => {
	const fallback: BroadcastScheduleValues = { timing: "now", sendDate: "2026-11-01", sendTime: "09:00" };

	it("reads a set time back in the sender's zone, and a floating one as written", () => {
		expect(broadcastScheduleValuesOf(SAVED, KL, fallback)).toEqual({ timing: "at-time", sendDate: "2026-11-03", sendTime: "09:00" });
		const local: BroadcastResponse = { ...SAVED, sendMode: "RECIPIENT_LOCAL_TIME", sendAt: null, localSendAt: epochMs(Date.UTC(2026, 10, 4, 18, 30)) };
		expect(broadcastScheduleValuesOf(local, KL, fallback)).toEqual({ timing: "recipient-local-time", sendDate: "2026-11-04", sendTime: "18:30" });
		expect(broadcastScheduleValuesOf({ ...SAVED, sendAt: null }, KL, fallback)).toEqual(fallback);
	});
});

describe("broadcast state", () => {
	it("is editable only as a draft, and cancellable until it finishes", () => {
		expect(isBroadcastEditable("DRAFT")).toBe(true);
		expect(isBroadcastEditable("SCHEDULED")).toBe(false);
		expect(isBroadcastCancellable("SCHEDULED")).toBe(true);
		expect(isBroadcastCancellable("SENT")).toBe(false);
	});

	it("totals what was delivered, failed and held back across channels", () => {
		expect(broadcastTotals(SAVED)).toEqual({ delivered: 11, failed: 1, suppressed: 2 });
	});
});
