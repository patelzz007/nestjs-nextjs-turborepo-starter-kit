import { ToggleGroup, type ToggleGroupOption } from "@workspace/ui-native/components/toggle-group";
import * as React from "react";

const COUNTRIES: readonly ToggleGroupOption<string>[] = [
	{ value: "my", label: "Malaysia" },
	{ value: "sg", label: "Singapore" },
	{ value: "id", label: "Indonesia" },
	{ value: "th", label: "Thailand" },
	{ value: "vn", label: "Vietnam" },
	{ value: "ph", label: "Philippines" },
];

export function ToggleGroupDont1Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string | null>("my");
	return <ToggleGroup type="single" label="Country" options={COUNTRIES} value={value} onChange={setValue} variant="outline" />;
}
