import BoldIcon from "lucide-react-native/icons/bold";
import ItalicIcon from "lucide-react-native/icons/italic";
import UnderlineIcon from "lucide-react-native/icons/underline";
import { ToggleGroup, type ToggleGroupOption } from "@workspace/ui-native/components/toggle-group";
import * as React from "react";

const STYLES: readonly ToggleGroupOption<string>[] = [
	{ value: "bold", label: "Bold", icon: BoldIcon },
	{ value: "italic", label: "Italic", icon: ItalicIcon },
	{ value: "underline", label: "Underline", icon: UnderlineIcon },
];

export function ToggleGroup1Example(): React.JSX.Element {
	const [value, setValue] = React.useState<readonly string[]>([]);
	return <ToggleGroup type="multiple" label="Text style" options={STYLES} value={value} onChange={setValue} hideLabels />;
}
