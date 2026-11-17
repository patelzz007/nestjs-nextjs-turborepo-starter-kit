import { describe, expect, it } from "vitest";

import { analyticsFormatters } from "../../reporting";
import { CUSTOMER_TIER_CHART_COLORS, toTierShareSegments } from "../tier-share-segments";

const FORMATTERS = analyticsFormatters("MYR", "en-MY");

describe("toTierShareSegments", () => {
	it("names each tier, keeps its fixed colour and states its share, zero tiers kept", () => {
		expect(
			toTierShareSegments(
				[
					{ tier: "BRONZE", count: 3 },
					{ tier: "GOLD", count: 1 },
					{ tier: "DIAMOND", count: 0 },
				],
				FORMATTERS,
			),
		).toEqual([
			{ key: "BRONZE", label: "Bronze", color: "chart-1", value: 3, valueLabel: "3", shareLabel: "75%" },
			{ key: "GOLD", label: "Gold", color: "chart-3", value: 1, valueLabel: "1", shareLabel: "25%" },
			{ key: "DIAMOND", label: "Diamond", color: "chart-4", value: 0, valueLabel: "0", shareLabel: "0%" },
		]);
	});

	it("gives every tier its own colour", () => {
		expect(new Set(Object.values(CUSTOMER_TIER_CHART_COLORS)).size).toBe(Object.keys(CUSTOMER_TIER_CHART_COLORS).length);
	});
});
