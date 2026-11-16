import { Marker, MarkerContent, type MarkerVariant } from "@workspace/ui-native/components/marker";
import * as React from "react";
import { View } from "react-native";

interface VariantLine {
	readonly variant: MarkerVariant;
	readonly text: string;
}

const LINES: readonly VariantLine[] = [
	{ variant: "default", text: "Read 14 files under src/billing" },
	{ variant: "separator", text: "Planning" },
	{ variant: "border", text: "Wrote 3 files, 128 lines changed" },
];

// A wide gap: the border variant draws its own space under itself, and on a tight gap the three would read as one block.
export function Marker1Example(): React.JSX.Element {
	return (
		<View className="gap-6">
			{LINES.map((line: VariantLine): React.JSX.Element => (
				<Marker key={line.variant} variant={line.variant}>
					<MarkerContent>{line.text}</MarkerContent>
				</Marker>
			))}
		</View>
	);
}
