import { epochMs, type BroadcastResponse, type RichTextDocument } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import {
	emptyPlatformBroadcastValues,
	needsSecondApproval,
	platformBroadcastValuesOf,
	toPlatformAudience,
	toPlatformBroadcastDraft,
	type PlatformBroadcastValues,
} from "@/contexts/notifications/lib/platform-broadcast-composer";

const KL = "Asia/Kuala_Lumpur";
const NOW = Date.UTC(2026, 10, 1, 0, 0);
const BODY: RichTextDocument = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Planned maintenance on Sunday." }] }] };

function values(overrides: Partial<PlatformBroadcastValues> = {}): PlatformBroadcastValues {
	return { ...emptyPlatformBroadcastValues("2026-11-03"), title: "Maintenance", body: BODY, ...overrides };
}

describe("toPlatformAudience", () => {
	it("reaches the picked apps in their fixed order, with no narrowing by default", () => {
		expect(toPlatformAudience(values({ surfaces: ["ADMIN", "CUSTOMER"] }), KL)).toEqual({
			kind: "platform-users",
			surfaces: ["CUSTOMER", "ADMIN"],
			signedUpAfter: null,
			tenantStates: null,
		});
	});

	it("reads a sign-up date as the start of that day in the sender's zone", () => {
		expect(toPlatformAudience(values({ signedUpAfter: "2026-10-01" }), KL).signedUpAfter).toBe(Date.UTC(2026, 8, 30, 16, 0));
	});

	it("narrows merchant staff by their store's state, and only while merchant staff are in it", () => {
		expect(toPlatformAudience(values({ surfaces: ["MERCHANT"], tenantStates: "active" }), KL).tenantStates).toEqual(["ACTIVE"]);
		expect(toPlatformAudience(values({ surfaces: ["MERCHANT"], tenantStates: "restricted" }), KL).tenantStates).toEqual(["RESTRICTED"]);
		expect(toPlatformAudience(values({ surfaces: ["CUSTOMER"], tenantStates: "active" }), KL).tenantStates).toBeNull();
	});
});

describe("needsSecondApproval", () => {
	it("asks for a second person only for everyone, unnarrowed", () => {
		const everyone = toPlatformAudience(values({ surfaces: ["CUSTOMER", "MERCHANT", "ADMIN"] }), KL);
		expect(needsSecondApproval(everyone)).toBe(true);
		expect(needsSecondApproval({ ...everyone, tenantStates: ["ACTIVE"] })).toBe(false);
		expect(needsSecondApproval({ ...everyone, surfaces: ["CUSTOMER"] })).toBe(false);
	});
});

describe("toPlatformBroadcastDraft", () => {
	it("builds a product notice to customers, sent as soon as it is scheduled", () => {
		const result = toPlatformBroadcastDraft(values(), KL, NOW);
		expect(result.ok ? result.draft : null).toMatchObject({ category: "PRODUCT", audience: { kind: "platform-users", surfaces: ["CUSTOMER"] }, sendMode: "INSTANT" });
	});

	it("asks for at least one group of people", () => {
		const result = toPlatformBroadcastDraft(values({ surfaces: [] }), KL, NOW);
		expect(result.ok ? null : result.errors.audience).toBe("Choose at least one group of people.");
	});
});

const SAVED: BroadcastResponse = {
	id: "0193f2c4-0000-7000-8000-0000000000b1",
	tenantId: null,
	status: "DRAFT",
	title: "Maintenance",
	body: BODY,
	audience: { kind: "platform-users", surfaces: ["MERCHANT"], signedUpAfter: epochMs(Date.UTC(2026, 8, 30, 16, 0)), tenantStates: ["RESTRICTED"] },
	channels: ["EMAIL"],
	category: "ACCOUNT",
	sendMode: "INSTANT",
	sendAt: null,
	localSendAt: null,
	audienceCount: null,
	authorUserId: "0193f2c4-0000-7000-8000-0000000000d1",
	approverUserId: null,
	sendingStartedAt: null,
	completedAt: null,
	cancelledAt: null,
	pausedAt: null,
	pauseReason: null,
	results: [],
	openReports: 0,
	createdAt: epochMs(NOW),
	updatedAt: epochMs(NOW),
	isDeleted: false,
	deletedAt: null,
};

describe("platformBroadcastValuesOf", () => {
	it("opens a saved draft with its audience and kind", () => {
		expect(platformBroadcastValuesOf(SAVED, KL, "2026-11-01")).toMatchObject({
			title: "Maintenance",
			category: "ACCOUNT",
			surfaces: ["MERCHANT"],
			signedUpAfter: "2026-10-01",
			tenantStates: "restricted",
			channels: ["EMAIL"],
			timing: "now",
		});
	});

	it("falls back to product news for a kind a platform notice cannot have, and to everyone for an unnarrowed one", () => {
		const opened = platformBroadcastValuesOf(
			{ ...SAVED, category: "MARKETING", audience: { ...SAVED.audience, kind: "platform-users", surfaces: ["CUSTOMER"], signedUpAfter: null, tenantStates: null } },
			KL,
			"2026-11-01",
		);
		expect(opened).toMatchObject({ category: "PRODUCT", signedUpAfter: "", tenantStates: "any" });
	});
});
