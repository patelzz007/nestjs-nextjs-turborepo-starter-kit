import { StatTiles, type StatTile } from "@workspace/ui-native/components/stat-tiles";
import * as React from "react";

// Raw, unformatted numbers: the reader has to count the digits.
const STATS: readonly StatTile[] = [
	{ label: "Orders today", value: "128" },
	{ label: "Revenue", value: "4210.5" },
];

export function StatCardDont1Example(): React.JSX.Element {
	return <StatTiles items={STATS} />;
}
