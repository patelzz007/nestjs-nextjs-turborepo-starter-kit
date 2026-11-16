import { ToggleGroup, type ToggleGroupOption } from "@workspace/ui-native/components/toggle-group";
import * as React from "react";

const VIEWS: readonly ToggleGroupOption<string>[] = [
	{ value: "list", label: "List" },
	{ value: "grid", label: "Grid" },
];

export function ToggleGroupDo1Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string | null>("list");
	return <ToggleGroup type="single" label="View" options={VIEWS} value={value} onChange={setValue} variant="outline" spacing="attached" />;
}
