import { StatTiles, type StatTile } from "@workspace/ui-native/components/stat-tiles";
import * as React from "react";

// Eight figures fight for attention: none of them reads as the headline.
const STATS: readonly StatTile[] = ["Orders", "Revenue", "Refunds", "Visitors", "Signups", "Churn", "Tickets", "Uptime"].map((label: string, index: number): StatTile => ({
	label,
	value: String(index + 1),
}));

export function StatCardDont2Example(): React.JSX.Element {
	return <StatTiles items={STATS} size="sm" />;
}
