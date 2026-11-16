import { ToggleGroup, type ToggleGroupOption } from "@workspace/ui-native/components/toggle-group";
import * as React from "react";

const PERIODS: readonly ToggleGroupOption<string>[] = [
	{ value: "day", label: "Day" },
	{ value: "week", label: "Week" },
	{ value: "month", label: "Month" },
];

export function ToggleGroup4Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string | null>("week");
	return <ToggleGroup type="single" label="Period" options={PERIODS} value={value} onChange={setValue} variant="outline" />;
}
