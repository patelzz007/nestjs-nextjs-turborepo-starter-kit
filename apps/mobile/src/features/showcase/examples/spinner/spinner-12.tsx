import { Spinner } from "@workspace/ui-native/components/spinner";
import * as React from "react";
import { View } from "react-native";

/** Colours of the caller's, as `accent-*` utilities. */
const COLORS: readonly string[] = ["accent-info", "accent-success", "accent-destructive", "accent-warning", "accent-tone-violet"];

export function Spinner12Example(): React.JSX.Element {
	return (
		<View className="flex-row items-center justify-center gap-4">
			{COLORS.map((color: string): React.JSX.Element => (
				<Spinner key={color} colorClassName={color} />
			))}
		</View>
	);
}
