import AlignCenterIcon from "lucide-react-native/icons/align-center";
import AlignJustifyIcon from "lucide-react-native/icons/align-justify";
import AlignLeftIcon from "lucide-react-native/icons/align-left";
import AlignRightIcon from "lucide-react-native/icons/align-right";
import { ToggleGroup, type ToggleGroupOption } from "@workspace/ui-native/components/toggle-group";
import * as React from "react";

const ALIGNMENTS: readonly ToggleGroupOption<string>[] = [
	{ value: "left", label: "Align left", icon: AlignLeftIcon },
	{ value: "center", label: "Align centre", icon: AlignCenterIcon },
	{ value: "right", label: "Align right", icon: AlignRightIcon },
	{ value: "justify", label: "Justify", icon: AlignJustifyIcon },
];

export function ToggleGroup7Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string | null>("left");
	return <ToggleGroup type="single" label="Text alignment" options={ALIGNMENTS} value={value} onChange={setValue} hideLabels />;
}
