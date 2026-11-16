import SettingsIcon from "lucide-react-native/icons/settings";
import TagIcon from "lucide-react-native/icons/tag";
import { Avatar } from "@workspace/ui-native/components/avatar";
import { ButtonGroup } from "@workspace/ui-native/components/button-group";
import { DropdownMenu, type DropdownMenuItemData } from "@workspace/ui-native/components/dropdown-menu";
import { IconButton } from "@workspace/ui-native/components/icon-button";
import * as React from "react";

import { ignorePress } from "../example-support";

const MEMBERS: readonly string[] = ["Avery Chen", "Jordan Lee", "Sam Patel"];

export function ButtonGroup26Example(): React.JSX.Element {
	const [member, setMember] = React.useState<string>("Avery Chen");
	const members = React.useMemo(
		(): readonly DropdownMenuItemData<string>[] =>
			MEMBERS.map((name: string): DropdownMenuItemData<string> => ({ value: name, label: name, kind: "radio", checked: name === member })),
		[member],
	);
	return (
		<ButtonGroup accessibilityLabel="Assignee" className="self-start">
			<DropdownMenu label={member} title="Assign to" leading={<Avatar name={member} imageUrl={null} size="sm" />} items={members} onSelect={setMember} />
			<IconButton icon={TagIcon} label="Add a tag" onPress={ignorePress} className="h-11 w-11" />
			<IconButton icon={SettingsIcon} label="Settings" onPress={ignorePress} className="h-11 w-11" />
		</ButtonGroup>
	);
}
