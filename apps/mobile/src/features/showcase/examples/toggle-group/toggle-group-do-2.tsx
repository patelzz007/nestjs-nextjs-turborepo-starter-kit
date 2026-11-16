import AlignLeftIcon from "lucide-react-native/icons/align-left";
import AlignRightIcon from "lucide-react-native/icons/align-right";
import { ToggleGroup, type ToggleGroupOption } from "@workspace/ui-native/components/toggle-group";
import * as React from "react";

const ALIGN: readonly ToggleGroupOption<string>[] = [
	{ value: "left", label: "Align left", icon: AlignLeftIcon },
	{ value: "right", label: "Align right", icon: AlignRightIcon },
];

export function ToggleGroupDo2Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string | null>("left");
	return <ToggleGroup type="single" label="Text alignment" options={ALIGN} value={value} onChange={setValue} hideLabels />;
}
