import { StatTiles, type StatTile } from "@workspace/ui-native/components/stat-tiles";
import GiftIcon from "lucide-react-native/icons/gift";
import StoreIcon from "lucide-react-native/icons/store";
import WalletIcon from "lucide-react-native/icons/wallet";
import * as React from "react";

const STATS: readonly StatTile[] = [
	{ label: "Active merchants", value: "1,284", hint: "+42 this week", icon: StoreIcon, iconTone: "brand" },
	{ label: "Rewards claimed", value: "18,930", hint: "Across every store", icon: GiftIcon, iconTone: "green" },
	{ label: "Open disputes", value: "7", hint: "2 need a reply today", icon: WalletIcon, iconTone: "red" },
];

export function StatCard1Example(): React.JSX.Element {
	return <StatTiles items={STATS} variant="outline" />;
}
