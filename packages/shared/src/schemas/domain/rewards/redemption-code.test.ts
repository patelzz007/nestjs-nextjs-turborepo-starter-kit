import { describe, expect, it } from "vitest";

import { merchantRedemptionListQuery, RedemptionCodeSchema } from "./rewards-entities";

const TOKEN = "t".repeat(32);

describe("RedemptionCodeSchema", () => {
	it("accepts exactly one of token or backupCode", () => {
		expect(RedemptionCodeSchema.safeParse({ token: TOKEN }).success).toBe(true);
		expect(RedemptionCodeSchema.safeParse({ backupCode: "ABCD2345" }).success).toBe(true);
	});

	it("rejects both at once, and neither", () => {
		expect(RedemptionCodeSchema.safeParse({ token: TOKEN, backupCode: "ABCD2345" }).success).toBe(false);
		expect(RedemptionCodeSchema.safeParse({}).success).toBe(false);
	});
});

describe("merchantRedemptionListQuery", () => {
	it("accepts a redeemedAt window (e.g. today) so meta.total counts it server-side", () => {
		const parsed = merchantRedemptionListQuery.schema.parse({ filter: { redeemedAt: { gte: "1790899200000", lt: "1790985600000" } } });
		expect(parsed.filter?.redeemedAt).toMatchObject({ gte: 1790899200000, lt: 1790985600000 });
	});
});
