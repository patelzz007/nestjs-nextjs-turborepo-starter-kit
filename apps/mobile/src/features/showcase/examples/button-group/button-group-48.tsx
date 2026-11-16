import ChevronDownIcon from "lucide-react-native/icons/chevron-down";
import DownloadIcon from "lucide-react-native/icons/download";
import FunnelIcon from "lucide-react-native/icons/funnel";
import { Button } from "@workspace/ui-native/components/button";
import { ButtonGroup } from "@workspace/ui-native/components/button-group";
import { DropdownMenu, type DropdownMenuItemData } from "@workspace/ui-native/components/dropdown-menu";
import * as React from "react";

import { ignorePress } from "../example-support";

const FORMATS: readonly DropdownMenuItemData<string>[] = [
	{ value: "xlsx", label: "Excel" },
	{ value: "json", label: "JSON" },
	{ value: "pdf", label: "PDF" },
];

export function ButtonGroup48Example(): React.JSX.Element {
	return (
		<ButtonGroup variant="separated" accessibilityLabel="Toolbar" className="self-start">
			<Button label="Filter" variant="outline" icon={FunnelIcon} onPress={ignorePress} />
			<ButtonGroup accessibilityLabel="Export">
				<Button label="Export CSV" variant="outline" icon={DownloadIcon} onPress={ignorePress} />
				<DropdownMenu label="Other formats" size="icon" icon={ChevronDownIcon} items={FORMATS} onSelect={ignorePress} />
			</ButtonGroup>
		</ButtonGroup>
	);
}
