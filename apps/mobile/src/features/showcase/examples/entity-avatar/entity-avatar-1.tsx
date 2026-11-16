import { Avatar } from "@workspace/ui-native/components/avatar";
import * as React from "react";
import { View } from "react-native";

const MERCHANTS: readonly string[] = ["Acme Coffee", "Bayview Books", "Corner Bakery", "Delta Fitness"];

// Shops without logos: a monogram tinted from each name (the same name, the same colour), and one in a circle.
export function EntityAvatar1Example(): React.JSX.Element {
	return (
		<View className="flex-row flex-wrap items-center gap-3">
			{MERCHANTS.map((name: string): React.JSX.Element => (
				<Avatar key={name} name={name} imageUrl={null} shape="rounded" tone="name" size="row" />
			))}
			<Avatar name="Circle" imageUrl={null} tone="name" size="row" />
		</View>
	);
}
