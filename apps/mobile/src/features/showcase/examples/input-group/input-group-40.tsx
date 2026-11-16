import CopyIcon from "lucide-react-native/icons/copy";
import GlobeIcon from "lucide-react-native/icons/globe";
import LockIcon from "lucide-react-native/icons/lock";
import { DropdownMenu, type DropdownMenuItemData } from "@workspace/ui-native/components/dropdown-menu";
import { IconButton } from "@workspace/ui-native/components/icon-button";
import { InputGroup } from "@workspace/ui-native/components/input-group";
import * as React from "react";

import { ignorePress } from "../example-support";

const VISIBILITY: readonly DropdownMenuItemData<string>[] = [
	{ value: "Private", label: "Private" },
	{ value: "Team", label: "Team" },
	{ value: "Public", label: "Public" },
];

export function InputGroup40Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string>("acme.com/s/q3-plan");
	const [visibility, setVisibility] = React.useState<string>("Team");
	return (
		<InputGroup
			value={value}
			onChange={setValue}
			autoCapitalize="none"
			accessibilityLabel="Share link"
			leading={
				<DropdownMenu
					label={visibility}
					title="Who can open it"
					icon={visibility === "Private" ? LockIcon : GlobeIcon}
					variant="ghost"
					size="sm"
					items={VISIBILITY}
					onSelect={setVisibility}
				/>
			}
			trailing={<IconButton icon={CopyIcon} label="Copy the link" variant="ghost" size="sm" onPress={ignorePress} />}
		/>
	);
}
