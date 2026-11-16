import { ToggleGroup, type ToggleGroupOption } from "@workspace/ui-native/components/toggle-group";
import * as React from "react";

const CALLS: readonly ToggleGroupOption<string>[] = [
	{ value: "all", label: "All" },
	{ value: "missed", label: "Missed" },
];

export function ToggleGroup2Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string | null>("all");
	return <ToggleGroup type="single" label="Calls" options={CALLS} value={value} onChange={setValue} variant="outline" spacing="attached" />;
}
