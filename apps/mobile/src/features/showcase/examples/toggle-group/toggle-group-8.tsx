import KanbanIcon from "lucide-react-native/icons/kanban";
import LayoutGridIcon from "lucide-react-native/icons/layout-grid";
import ListIcon from "lucide-react-native/icons/list";
import { ToggleGroup, type ToggleGroupOption } from "@workspace/ui-native/components/toggle-group";
import * as React from "react";

const VIEWS: readonly ToggleGroupOption<string>[] = [
	{ value: "list", label: "List view", icon: ListIcon },
	{ value: "grid", label: "Grid view", icon: LayoutGridIcon },
	{ value: "kanban", label: "Board view", icon: KanbanIcon },
];

export function ToggleGroup8Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string | null>("list");
	return <ToggleGroup type="single" label="View" options={VIEWS} value={value} onChange={setValue} variant="outline" spacing="attached" hideLabels />;
}
