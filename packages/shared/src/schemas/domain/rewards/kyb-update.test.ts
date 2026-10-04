import { describe, expect, it } from "vitest";

import { AdminKybUpdateSchema, KYB_STATUSES_REQUIRING_REASON } from "./rewards-kyb";

describe("AdminKybUpdateSchema", () => {
	it.each(KYB_STATUSES_REQUIRING_REASON)("rejects %s without a reason, and accepts it with one", (kybStatus) => {
		expect(AdminKybUpdateSchema.safeParse({ kybStatus }).success).toBe(false);
		expect(AdminKybUpdateSchema.safeParse({ kybStatus, kybFields: { reviewNotes: "checked" } }).success).toBe(false);
		expect(AdminKybUpdateSchema.safeParse({ kybStatus, kybFields: { rejectionReason: "   " } }).success).toBe(false);
		expect(AdminKybUpdateSchema.safeParse({ kybStatus, kybFields: { rejectionReason: "Upload a readable SSM certificate." } }).success).toBe(true);
	});

	it("accepts approval without a reason", () => {
		expect(AdminKybUpdateSchema.safeParse({ kybStatus: "APPROVED" }).success).toBe(true);
	});

	it("types kybFields: unknown keys and wrong types are refused (never free JSON)", () => {
		expect(AdminKybUpdateSchema.safeParse({ kybStatus: "APPROVED", kybFields: { anything: "goes" } }).success).toBe(false);
		expect(AdminKybUpdateSchema.safeParse({ kybStatus: "APPROVED", kybFields: { reviewedAt: "yesterday" } }).success).toBe(false);
	});
});
