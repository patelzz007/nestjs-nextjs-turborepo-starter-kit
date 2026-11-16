import ArrowDownIcon from "lucide-react-native/icons/arrow-down";
import ArrowRightIcon from "lucide-react-native/icons/arrow-right";
import ArrowUpIcon from "lucide-react-native/icons/arrow-up";
import { DropdownMenu, type DropdownMenuItemData } from "@workspace/ui-native/components/dropdown-menu";
import * as React from "react";

type Position = "top" | "bottom" | "right";

export function DropdownMenu7Example(): React.JSX.Element {
	const [position, setPosition] = React.useState<Position>("bottom");
	const items: readonly DropdownMenuItemData<Position>[] = [
		{ value: "top", label: "Top", icon: ArrowUpIcon, kind: "radio", checked: position === "top", group: "Panel position" },
		{ value: "bottom", label: "Bottom", icon: ArrowDownIcon, kind: "radio", checked: position === "bottom", group: "Panel position" },
		{ value: "right", label: "Right", icon: ArrowRightIcon, kind: "radio", checked: position === "right", disabled: true, group: "Panel position" },
	];
	const choose = React.useCallback((value: Position): void => {
		setPosition(value);
	}, []);
	return <DropdownMenu label={`Panel: ${position}`} items={items} onSelect={choose} />;
}
