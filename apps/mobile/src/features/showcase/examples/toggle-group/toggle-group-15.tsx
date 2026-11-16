import ArrowDownWideNarrowIcon from "lucide-react-native/icons/arrow-down-wide-narrow";
import ArrowUpNarrowWideIcon from "lucide-react-native/icons/arrow-up-narrow-wide";
import { ToggleGroup, type ToggleGroupOption } from "@workspace/ui-native/components/toggle-group";
import * as React from "react";

const DIRECTIONS: readonly ToggleGroupOption<string>[] = [
	{ value: "ascending", label: "Ascending", icon: ArrowUpNarrowWideIcon },
	{ value: "descending", label: "Descending", icon: ArrowDownWideNarrowIcon },
];

export function ToggleGroup15Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string | null>("ascending");
	return <ToggleGroup type="single" label="Sort" options={DIRECTIONS} value={value} onChange={setValue} variant="outline" size="sm" spacing="attached" />;
}
