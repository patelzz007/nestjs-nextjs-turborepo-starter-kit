import { ToggleGroup, type ToggleGroupOption } from "@workspace/ui-native/components/toggle-group";
import * as React from "react";

const RANGES: readonly ToggleGroupOption<string>[] = [
	{ value: "1h", label: "1H", accessibilityLabel: "1 hour" },
	{ value: "6h", label: "6H", accessibilityLabel: "6 hours" },
	{ value: "24h", label: "24H", accessibilityLabel: "24 hours" },
	{ value: "7d", label: "7D", accessibilityLabel: "7 days" },
	{ value: "30d", label: "30D", accessibilityLabel: "30 days" },
	{ value: "all", label: "All" },
];

export function ToggleGroup12Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string | null>("24h");
	return <ToggleGroup type="single" label="Time range" options={RANGES} value={value} onChange={setValue} variant="outline" size="sm" />;
}
