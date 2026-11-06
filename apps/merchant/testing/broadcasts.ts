import { epochMs, type BroadcastResponse } from "@workspace/shared";

const CREATED = epochMs(Date.UTC(2026, 9, 30, 8, 0));

/** A saved broadcast to all customers; override what a test is about. */
export function broadcastFixture(overrides: Partial<BroadcastResponse> = {}): BroadcastResponse {
	return {
		id: "0193f2c4-0000-7000-8000-0000000000b1",
		tenantId: "0193f2c4-0000-7000-8000-0000000000c1",
		status: "DRAFT",
		title: "Weekend specials",
		body: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Half price lattes on Saturday." }] }] },
		audience: { kind: "tenant-customers", claimedWithinDays: 60, redeemed: "any", locationId: null, customerIds: null },
		channels: ["IN_APP", "EMAIL"],
		category: "MARKETING",
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
		createdAt: CREATED,
		updatedAt: CREATED,
		isDeleted: false,
		deletedAt: null,
		...overrides,
	};
}
