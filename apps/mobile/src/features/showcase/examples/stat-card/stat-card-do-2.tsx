import { StatTiles, type StatTile } from "@workspace/ui-native/components/stat-tiles";
import * as React from "react";

const STATS: readonly StatTile[] = [
	{ label: "Orders today", value: "128" },
	{ label: "Revenue", value: "RM 4,210" },
	{ label: "Refunds", value: "3" },
];

export function StatCardDo2Example(): React.JSX.Element {
	return <StatTiles items={STATS} />;
}
