import { StatTiles, type StatTile } from "@workspace/ui-native/components/stat-tiles";
import * as React from "react";

const STATS: readonly StatTile[] = [
	{ label: "Orders today", value: "128" },
	{ label: "Revenue", value: "RM 4,210" },
];

export function StatCardDo1Example(): React.JSX.Element {
	return <StatTiles items={STATS} />;
}
