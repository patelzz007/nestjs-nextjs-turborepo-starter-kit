import { ToggleGroup, type ToggleGroupOption } from "@workspace/ui-native/components/toggle-group";
import * as React from "react";

const SIZES: readonly ToggleGroupOption<string>[] = [
	{ value: "s", label: "S", accessibilityLabel: "Small" },
	{ value: "m", label: "M", accessibilityLabel: "Medium" },
	{ value: "l", label: "L", accessibilityLabel: "Large" },
	{ value: "xl", label: "XL", accessibilityLabel: "Extra large" },
];

export function ToggleGroup11Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string | null>("m");
	return <ToggleGroup type="single" label="Text size" options={SIZES} value={value} onChange={setValue} variant="outline" size="sm" />;
}
