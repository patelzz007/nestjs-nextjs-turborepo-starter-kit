import AlignLeftIcon from "lucide-react-native/icons/align-left";
import AlignRightIcon from "lucide-react-native/icons/align-right";
import { ToggleGroup, type ToggleGroupOption } from "@workspace/ui-native/components/toggle-group";
import * as React from "react";

const ALIGN: readonly ToggleGroupOption<string>[] = [
	{ value: "left", label: "Option 1", icon: AlignLeftIcon },
	{ value: "right", label: "Option 2", icon: AlignRightIcon },
];

export function ToggleGroupDont2Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string | null>("left");
	return <ToggleGroup type="single" label="Options" options={ALIGN} value={value} onChange={setValue} hideLabels />;
}
