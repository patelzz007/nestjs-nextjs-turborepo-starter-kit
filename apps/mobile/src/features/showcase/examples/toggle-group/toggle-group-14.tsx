import Columns2Icon from "lucide-react-native/icons/columns-2";
import Columns3Icon from "lucide-react-native/icons/columns-3";
import Columns4Icon from "lucide-react-native/icons/columns-4";
import RectangleHorizontalIcon from "lucide-react-native/icons/rectangle-horizontal";
import { ToggleGroup, type ToggleGroupOption } from "@workspace/ui-native/components/toggle-group";
import * as React from "react";

const COLUMNS: readonly ToggleGroupOption<string>[] = [
	{ value: "1", label: "1 column", icon: RectangleHorizontalIcon },
	{ value: "2", label: "2 columns", icon: Columns2Icon },
	{ value: "3", label: "3 columns", icon: Columns3Icon },
	{ value: "4", label: "4 columns", icon: Columns4Icon },
];

export function ToggleGroup14Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string | null>("2");
	return <ToggleGroup type="single" label="Columns" options={COLUMNS} value={value} onChange={setValue} variant="outline" spacing="attached" hideLabels />;
}
