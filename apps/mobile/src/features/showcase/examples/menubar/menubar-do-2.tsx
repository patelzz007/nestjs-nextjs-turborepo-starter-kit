import FilePlusIcon from "lucide-react-native/icons/file-plus";
import FolderOpenIcon from "lucide-react-native/icons/folder-open";
import LogOutIcon from "lucide-react-native/icons/log-out";
import SaveIcon from "lucide-react-native/icons/save";
import UserIcon from "lucide-react-native/icons/user";
import { Menubar, type MenubarMenu } from "@workspace/ui-native/components/menubar";
import * as React from "react";

import { ignorePress } from "../example-support";

export function MenubarDo2Example(): React.JSX.Element {
	const menus: readonly MenubarMenu[] = [
		{
			key: "file",
			label: "File",
			onSelect: ignorePress,
			items: [
				{ value: "new", label: "New file", icon: FilePlusIcon },
				{ value: "open", label: "Open", icon: FolderOpenIcon },
				{ value: "save", label: "Save", icon: SaveIcon },
			],
		},
		{
			key: "account",
			label: "Account",
			onSelect: ignorePress,
			items: [
				{ value: "profile", label: "Profile", icon: UserIcon },
				{ value: "signout", label: "Sign out", icon: LogOutIcon, variant: "destructive" },
			],
		},
	];
	return <Menubar menus={menus} />;
}
