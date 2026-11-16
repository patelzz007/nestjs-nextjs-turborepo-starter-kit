import { Avatar } from "@workspace/ui-native/components/avatar";
import * as React from "react";
import type { AvatarColor } from "@workspace/ui-native/components/avatar";
import { View } from "react-native";

const FILLS: readonly { readonly name: string; readonly color: AvatarColor }[] = [
	{ name: "Ada Lovelace", color: "primary" },
	{ name: "Grace Hopper", color: "success" },
	{ name: "Alan Turing", color: "warning" },
	{ name: "Linus Torvalds", color: "destructive" },
	{ name: "Barbara Liskov", color: "info" },
];

// Initials on full-strength fills.
export function Avatar15Example(): React.JSX.Element {
	return (
		<View className="flex-row flex-wrap gap-3">
			{FILLS.map((fill): React.JSX.Element => (
				<Avatar key={fill.name} name={fill.name} imageUrl={null} tone="filled" color={fill.color} size="row" />
			))}
		</View>
	);
}
