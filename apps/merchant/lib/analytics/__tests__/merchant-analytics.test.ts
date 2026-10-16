import { analyticsFormatters } from "@workspace/client/lib/analytics/analytics-presentation";
import { describe, expect, it } from "vitest";

import { NO_STORE_LABEL, reportTimeZone, toRedemptionMethodSegments, toRewardItems, toStoreItems } from "@/lib/analytics/merchant-analytics";
import { buildMerchantDashboard } from "@/test/analytics-dashboard";
import { organizationContextFixture } from "@/test/tenant-context";

const FORMATTERS = analyticsFormatters("MYR", "en-MY");

function spaced(value: string | undefined): string {
	return (value ?? "").replace(/\s/g, " ");
}

describe("toStoreItems", () => {
	it("ranks stores by sales with city, bills, average bill and redemptions", () => {
		const items = toStoreItems(buildMerchantDashboard(), FORMATTERS);

		expect(items.map((item) => [item.label, spaced(item.valueLabel), spaced(item.detail)])).toEqual([
			["Bangsar", "RM 2,000.00", "Kuala Lumpur · 8 bills · avg RM 250.00 · 12 redemptions"],
			["Mont Kiara", "RM 500.00", "2 bills · avg RM 250.00 · 3 redemptions"],
		]);
	});

	it("names bills paid without a known store", () => {
		const dashboard = buildMerchantDashboard({ byStore: [{ locationId: null, name: null, city: null, salesMinor: 100, bills: 1, averageBillMinor: 100, redemptions: 0 }] });

		const [item] = toStoreItems(dashboard, FORMATTERS);
		expect(item?.label).toBe(NO_STORE_LABEL);
		expect(item?.key).toBe("no-store");
		expect(spaced(item?.detail)).toBe("1 bill · avg RM 1.00 · 0 redemptions");
	});
});

describe("toRewardItems", () => {
	it("ranks rewards by claims with redemptions and conversion", () => {
		expect(toRewardItems(buildMerchantDashboard(), FORMATTERS).map((item) => [item.label, item.valueLabel, item.detail])).toEqual([
			["Free refill", "12 claims", "10 redemptions · 83.3% redeemed"],
			["Pastry deal", "8 claims", "5 redemptions · 62.5% redeemed"],
		]);
	});
});

describe("toRedemptionMethodSegments", () => {
	it("names each method, keeps its fixed colour and states its share", () => {
		expect(toRedemptionMethodSegments(buildMerchantDashboard(), FORMATTERS)).toEqual([
			{ key: "SCAN", label: "QR code scan", color: "chart-1", value: 12, valueLabel: "12", shareLabel: "80%" },
			{ key: "MANUAL", label: "Backup code", color: "chart-2", value: 3, valueLabel: "3", shareLabel: "20%" },
		]);
	});
});

describe("reportTimeZone", () => {
	it("is the organization's own zone from its context, the platform's without one", () => {
		const context = organizationContextFixture({ locations: [] });

		expect(reportTimeZone({ ...context, organization: { ...context.organization, timeZone: "Asia/Tokyo" } })).toBe("Asia/Tokyo");
		expect(reportTimeZone(undefined)).toBe("Asia/Kuala_Lumpur");
	});
});
