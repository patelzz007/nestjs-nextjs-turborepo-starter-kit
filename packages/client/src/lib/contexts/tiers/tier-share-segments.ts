// One count per customer tier as parts of a share bar (ADR 085): the merchant's redemptions by tier and the
// platform's customers by tier read the same way, in the same colours.

import { CUSTOMER_TIER_LABELS, type CustomerTier } from "@workspace/shared";
import type { ShareSegment } from "@workspace/ui/components/share-bar";
import type { ChartColorSlot } from "@workspace/ui/lib/charts/chart-colors";

import { formatShareOfTotal, type AnalyticsFormatters } from "../reporting";

/** Each tier's colour on a share bar (fixed per tier, never by rank). */
export const CUSTOMER_TIER_CHART_COLORS: Readonly<Record<CustomerTier, ChartColorSlot>> = { BRONZE: "chart-1", SILVER: "chart-2", GOLD: "chart-3", DIAMOND: "chart-4" };

/** One tier's count. */
export interface TierCount {
	readonly tier: CustomerTier;
	readonly count: number;
}

/** Each tier's count, named and coloured, with its share of the whole (zero tiers kept, in the order given). */
export function toTierShareSegments(counts: readonly TierCount[], formatters: AnalyticsFormatters): readonly ShareSegment[] {
	const total = counts.reduce((sum, row) => sum + row.count, 0);
	return counts.map((row): ShareSegment => ({
		key: row.tier,
		label: CUSTOMER_TIER_LABELS[row.tier],
		color: CUSTOMER_TIER_CHART_COLORS[row.tier],
		value: row.count,
		valueLabel: formatters.count(row.count),
		shareLabel: formatShareOfTotal(row.count, total, formatters.locale),
	}));
}
