import { DropdownMenu, type DropdownMenuItemData } from "@workspace/ui-native/components/dropdown-menu";
import * as React from "react";
import { View } from "react-native";

import { ignorePress } from "../example-support";

const ITEMS: readonly DropdownMenuItemData<string>[] = [
	{ value: "profile", label: "Profile" },
	{ value: "billing", label: "Billing" },
	{ value: "settings", label: "Settings" },
];
const PLACES: readonly string[] = ["Top bar", "Card", "Footer"];

export function DropdownMenu2Example(): React.JSX.Element {
	return (
		<View className="flex-row flex-wrap gap-2">
			{PLACES.map((place: string): React.JSX.Element => (
				<DropdownMenu key={place} label={place} title={`Menu from the ${place.toLowerCase()}`} items={ITEMS} onSelect={ignorePress} />
			))}
		</View>
	);
}
