import { ToggleGroup, type ToggleGroupOption } from "@workspace/ui-native/components/toggle-group";
import * as React from "react";
import { View } from "react-native";

const POSITIONS: readonly ToggleGroupOption<string>[] = [
	{ value: "top", label: "Top" },
	{ value: "bottom", label: "Bottom" },
];

export function ToggleGroup3Example(): React.JSX.Element {
	const [small, setSmall] = React.useState<string | null>("top");
	const [medium, setMedium] = React.useState<string | null>("top");
	return (
		<View className="gap-3">
			<ToggleGroup type="single" label="Position, small" options={POSITIONS} value={small} onChange={setSmall} variant="outline" size="sm" spacing="attached" />
			<ToggleGroup type="single" label="Position" options={POSITIONS} value={medium} onChange={setMedium} variant="outline" spacing="attached" />
		</View>
	);
}
