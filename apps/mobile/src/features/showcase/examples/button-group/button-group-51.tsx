import EllipsisIcon from "lucide-react-native/icons/ellipsis";
import PlusIcon from "lucide-react-native/icons/plus";
import { Button } from "@workspace/ui-native/components/button";
import { ButtonGroup } from "@workspace/ui-native/components/button-group";
import { DropdownMenu, type DropdownMenuItemData } from "@workspace/ui-native/components/dropdown-menu";
import * as React from "react";

import { ignorePress } from "../example-support";

const CREATE: readonly DropdownMenuItemData<string>[] = [
	{ value: "customer", label: "Customer" },
	{ value: "order", label: "Order" },
	{ value: "invoice", label: "Invoice" },
];

export function ButtonGroup51Example(): React.JSX.Element {
	return (
		<ButtonGroup size="sm" accessibilityLabel="Create" className="self-start">
			<Button label="New" size="sm" icon={PlusIcon} onPress={ignorePress} />
			<DropdownMenu label="Create a record" variant="primary" size="sm" hideChevron icon={EllipsisIcon} items={CREATE} onSelect={ignorePress} />
		</ButtonGroup>
	);
}
