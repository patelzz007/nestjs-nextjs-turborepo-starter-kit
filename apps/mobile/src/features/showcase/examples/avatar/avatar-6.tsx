import { Avatar } from "@workspace/ui-native/components/avatar";
import * as React from "react";
import type { AvatarColor } from "@workspace/ui-native/components/avatar";
import { View } from "react-native";

import { FIRST } from "./avatar-sample";

const STATES: readonly { readonly label: string; readonly color: AvatarColor }[] = [
	{ label: "Available", color: "primary" },
	{ label: "Online", color: "success" },
	{ label: "Away", color: "warning" },
	{ label: "Busy", color: "destructive" },
];

// Presence dots in the bottom-right corner, in four colours, each named.
export function Avatar6Example(): React.JSX.Element {
	return (
		<View className="flex-row gap-4">
			{STATES.map((state): React.JSX.Element => (
				<Avatar key={state.label} name={FIRST.name} imageUrl={FIRST.photo} badges={[{ label: state.label, color: state.color }]} />
			))}
		</View>
	);
}
