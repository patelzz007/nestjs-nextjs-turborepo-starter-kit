import ArrowUpDownIcon from "lucide-react-native/icons/arrow-up-down";
import LayoutGridIcon from "lucide-react-native/icons/layout-grid";
import ListIcon from "lucide-react-native/icons/list";
import PlusIcon from "lucide-react-native/icons/plus";
import { ButtonGroup } from "@workspace/ui-native/components/button-group";
import { DropdownMenu, type DropdownMenuItemData } from "@workspace/ui-native/components/dropdown-menu";
import { IconButton } from "@workspace/ui-native/components/icon-button";
import * as React from "react";

import { ignorePress } from "../example-support";

const SORTS: readonly DropdownMenuItemData<string>[] = [
	{ value: "newest", label: "Newest first" },
	{ value: "oldest", label: "Oldest first" },
	{ value: "name", label: "Name" },
];

const CREATE: readonly DropdownMenuItemData<string>[] = [
	{ value: "customer", label: "Customer" },
	{ value: "order", label: "Order" },
];

export function ButtonGroup32Example(): React.JSX.Element {
	const [view, setView] = React.useState<"grid" | "list">("grid");
	const showGrid = React.useCallback((): void => {
		setView("grid");
	}, []);
	const showList = React.useCallback((): void => {
		setView("list");
	}, []);
	return (
		<ButtonGroup variant="separated" accessibilityLabel="List controls" className="self-start">
			<DropdownMenu label="Sort" size="icon" icon={ArrowUpDownIcon} items={SORTS} onSelect={ignorePress} />
			<ButtonGroup accessibilityLabel="View">
				<IconButton icon={LayoutGridIcon} label="Grid view" variant={view === "grid" ? "primary" : "secondary"} onPress={showGrid} />
				<IconButton icon={ListIcon} label="List view" variant={view === "list" ? "primary" : "secondary"} onPress={showList} />
			</ButtonGroup>
			<DropdownMenu label="Add new" variant="primary" icon={PlusIcon} items={CREATE} onSelect={ignorePress} />
		</ButtonGroup>
	);
}
