import { ToggleGroup, type ToggleGroupOption } from "@workspace/ui-native/components/toggle-group";
import * as React from "react";

const STATUSES: readonly ToggleGroupOption<string>[] = [
	{ value: "all", label: "All" },
	{ value: "active", label: "Active" },
	{ value: "completed", label: "Completed" },
	{ value: "archived", label: "Archived" },
];

export function ToggleGroup5Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string | null>("active");
	return <ToggleGroup type="single" label="Status" options={STATUSES} value={value} onChange={setValue} variant="outline" size="sm" />;
}
