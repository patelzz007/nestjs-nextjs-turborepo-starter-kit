import { Avatar } from "@workspace/ui-native/components/avatar";
import * as React from "react";
import { DropdownMenu, type DropdownMenuItemData } from "@workspace/ui-native/components/dropdown-menu";
import LogOutIcon from "lucide-react-native/icons/log-out";
import SettingsIcon from "lucide-react-native/icons/settings";
import UserIcon from "lucide-react-native/icons/user";

import { ignorePress } from "../example-support";
import { FIRST } from "./avatar-sample";

const ITEMS: readonly DropdownMenuItemData<string>[] = [
	{ value: "profile", label: "Profile", icon: UserIcon },
	{ value: "settings", label: "Settings", icon: SettingsIcon },
	{ value: "logout", label: "Log out", icon: LogOutIcon, variant: "destructive" },
];

// A pill trigger with a photo and a name that opens Profile, Settings and Log out.
export function Avatar35Example(): React.JSX.Element {
	return (
		<DropdownMenu
			label={FIRST.name}
			leading={<Avatar name={FIRST.name} imageUrl={FIRST.photo} size="xs" />}
			items={ITEMS}
			onSelect={ignorePress}
			variant="outline"
			size="sm"
			className="self-start rounded-full"
		/>
	);
}
